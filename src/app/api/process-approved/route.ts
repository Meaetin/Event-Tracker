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
    return now.toISOString().split('T')[0]; // Return YYYY-MM-DD format
  }
  
  if (dateStr.toLowerCase().includes('every') || dateStr.toLowerCase().includes('ongoing')) {
    // For recurring events, return null since they don't have specific dates
    return null;
  }

  try {
    // Handle dates without year (like "22 May") by adding current year or next year
    let dateToProcess = dateStr.trim();
    
    // Check if the date string doesn't contain a year (no 4-digit number)
    if (!/\b\d{4}\b/.test(dateToProcess)) {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth();
      
      // Add current year to the date
      dateToProcess = `${dateToProcess} ${currentYear}`;
      
      // Try to parse with current year - use local timezone parsing
      const testDate = new Date(dateToProcess + ' 12:00:00'); // Add midday to avoid timezone issues
      
      // If the date is in the past (more than 1 month ago), use next year instead
      if (testDate.getTime() < Date.now() - (30 * 24 * 60 * 60 * 1000)) {
        dateToProcess = `${dateStr.trim()} ${currentYear + 1}`;
      }
    }
    
    // Parse the date with explicit midday time to avoid timezone shifting
    const dateWithTime = dateToProcess.includes(':') ? dateToProcess : `${dateToProcess} 12:00:00`;
    const parsed = new Date(dateWithTime);
    
    // Check if the parsed date is valid
    if (isNaN(parsed.getTime())) {
      console.warn(`Could not parse date: "${dateStr}" -> "${dateToProcess}"`);
      return null; // Return null if can't parse instead of original string
    }
    
    // Check if the year is reasonable (between 2020 and 2030)
    const year = parsed.getFullYear();
    if (year < 2020 || year > 2030) {
      console.warn(`Date year out of range: "${dateStr}" -> ${year}`);
      return null;
    }
    
    // Return in YYYY-MM-DD format for database
    return parsed.toISOString().split('T')[0];
    
  } catch (error) {
    console.warn(`Error parsing date "${dateStr}":`, error);
    return null;
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

        // Step 3: Use category_ids directly from AI response
        const primaryCategoryId = eventData.category_ids[0]; // First category as primary
        const allCategoryIds = eventData.category_ids;

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
          time: eventData.time,
          location: eventData.location,
          coordinates: eventData.coordinates ? `(${eventData.coordinates.x},${eventData.coordinates.y})` : null,
          description: eventData.description,
          category_id: primaryCategoryId, // Keep for backwards compatibility
          category_ids: allCategoryIds, // New: Multiple categories
          store_type: eventData.store_type,
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