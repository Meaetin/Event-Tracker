import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { JinaScraper } from '../../components/scraper/jinaScraper';
import { OpenAIProcessor } from '../../components/ai/openaiProcessor';

// Create a Supabase client with the service role key for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export const maxDuration = 300; // 5 minutes for processing multiple events

// Helper function to parse flexible date strings into simple date strings
function parseDateString(dateStr: string | null): { startDate: string | null; endDate: string | null } {
  if (!dateStr || dateStr === 'null') {
    return { startDate: null, endDate: null };
  }

  try {
    // Handle date ranges like "23 May 2025 - 28 Sep 2025"
    if (dateStr.includes(' - ')) {
      const [startPart, endPart] = dateStr.split(' - ').map(s => s.trim());
      
      // Keep as formatted date strings
      const startDate = formatDateString(startPart);
      const endDate = formatDateString(endPart);
      
      return { 
        startDate: startDate, 
        endDate: endDate 
      };
    }
    
    // Handle single dates like "24 May 2025"
    const singleDate = formatDateString(dateStr);
    return { 
      startDate: singleDate, 
      endDate: null 
    };
    
  } catch (error) {
    console.warn(`Could not parse date string: "${dateStr}"`, error);
    return { startDate: null, endDate: null };
  }
}

// Helper function to format date strings consistently
function formatDateString(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') {
    return null;
  }

  // Handle special cases
  if (dateStr.toLowerCase().includes('now')) {
    const now = new Date();
    return now.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  }
  
  if (dateStr.toLowerCase().includes('every') || dateStr.toLowerCase().includes('ongoing')) {
    // For recurring events, return the original string
    return dateStr;
  }

  try {
    // Try to parse the date to validate it
    const parsed = new Date(dateStr);
    
    // Check if the parsed date is valid
    if (isNaN(parsed.getTime())) {
      return dateStr; // Return original if can't parse
    }
    
    // Check if the year is reasonable (between 2020 and 2030)
    const year = parsed.getFullYear();
    if (year < 2020 || year > 2030) {
      return dateStr; // Return original if year is unreasonable
    }
    
    // Return a consistent format: "24 May 2025"
    return parsed.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  } catch (error) {
    // If parsing fails, return the original string
    return dateStr;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { listingIds } = await req.json();
    
    if (!listingIds || !Array.isArray(listingIds) || listingIds.length === 0) {
      return NextResponse.json({ error: 'No listing IDs provided' }, { status: 400 });
    }

    console.log('Processing ready listings:', listingIds);

    // Get approved and error scraped listings (for retry)
    const { data: listings, error: fetchError } = await supabase
      .from('scraped_listings')
      .select('*')
      .in('id', listingIds)
      .in('status', ['approved', 'error']);

    if (fetchError) {
      throw new Error(`Failed to fetch listings: ${fetchError.message}`);
    }

    if (!listings || listings.length === 0) {
      return NextResponse.json({ error: 'No ready listings found' }, { status: 404 });
    }

    const approvedCount = listings.filter(l => l.status === 'approved').length;
    const errorCount = listings.filter(l => l.status === 'error').length;
    console.log(`Found ${listings.length} ready listings to process (${approvedCount} approved, ${errorCount} retry)`);

    // Initialize services
    const jinaScraper = new JinaScraper();
    const openaiProcessor = new OpenAIProcessor();

    const processedEvents = [];
    const errors = [];

    // Process each listing
    for (const listing of listings) {
      try {
        console.log(`Processing listing: ${listing.title} (${listing.url})`);

        // Step 1: Scrape with Jina AI
        const scrapedContent = await jinaScraper.scrapeUrl(listing.url);
        console.log(`Scraped content for ${listing.url}, markdown length: ${scrapedContent.markdown.length}`);

        // Step 2: Process with OpenAI
        const eventData = await openaiProcessor.processEventMarkdown(
          scrapedContent.markdown,
          listing.url
        );
        console.log(`Processed event data for ${listing.url}:`, eventData.name);
        console.log('eventData:', eventData);

        // Step 3: Use category_id directly from AI response
        const categoryId = eventData.category_id;

        // Step 4: Create event in database
        // Use the existing image from the listing instead of extracting from markdown
        const eventImages = listing.image_url ? [listing.image_url] : (scrapedContent.images || []);
        
        // Parse the flexible date format into start_date and end_date
        const { startDate, endDate } = parseDateString(eventData.date);
        console.log(`Date parsing: "${eventData.date}" -> start: ${startDate}, end: ${endDate}`);
        
        const eventToInsert = {
          name: eventData.name,
          url: listing.url,
          start_date: startDate,
          end_date: endDate,
          location: eventData.location,
          coordinates: eventData.coordinates ? `(${eventData.coordinates.x},${eventData.coordinates.y})` : null,
          description: eventData.description,
          category_id: categoryId,
          status: 'pending' as const,
          images: eventImages
        };

        const { data: createdEvent, error: insertError } = await supabase
          .from('events')
          .insert(eventToInsert)
          .select('*')
          .single();

        if (insertError) {
          throw new Error(`Failed to create event: ${insertError.message}`);
        }

        processedEvents.push(createdEvent);
        console.log(`Successfully created event: ${createdEvent.name}`);

        // Update listing status to processed
        await supabase
          .from('scraped_listings')
          .update({ status: 'processed' })
          .eq('id', listing.id);

      } catch (error: any) {
        console.error(`Error processing listing ${listing.id}:`, error);
        errors.push({
          listingId: listing.id,
          title: listing.title,
          url: listing.url,
          error: error.message
        });

        // Update listing status to error
        await supabase
          .from('scraped_listings')
          .update({ status: 'error' })
          .eq('id', listing.id);
      }

      // Small delay between processing to avoid overwhelming APIs
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const response = {
      success: true,
      processed: processedEvents.length,
      total: listings.length,
      events: processedEvents,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log('Processing complete:', response);

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Processing error:', error);
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to process approved listings',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }, 
      { status: 500 }
    );
  }
} 