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

export async function POST(req: NextRequest) {
  try {
    const { listingIds } = await req.json();
    
    if (!listingIds || !Array.isArray(listingIds) || listingIds.length === 0) {
      return NextResponse.json({ error: 'No listing IDs provided' }, { status: 400 });
    }

    console.log('Processing approved listings:', listingIds);

    // Get approved scraped listings
    const { data: listings, error: fetchError } = await supabase
      .from('scraped_listings')
      .select('*')
      .in('id', listingIds)
      .eq('status', 'approved');

    if (fetchError) {
      throw new Error(`Failed to fetch listings: ${fetchError.message}`);
    }

    if (!listings || listings.length === 0) {
      return NextResponse.json({ error: 'No approved listings found' }, { status: 404 });
    }

    console.log(`Found ${listings.length} approved listings to process`);

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

        // Step 3: Get or create category
        let categoryId = null;
        if (eventData.category) {
          const { data: existingCategory } = await supabase
            .from('categories')
            .select('id')
            .eq('name', eventData.category)
            .single();

          if (existingCategory) {
            categoryId = existingCategory.id;
          } else {
            // Create new category
            const { data: newCategory, error: categoryError } = await supabase
              .from('categories')
              .insert({ name: eventData.category })
              .select('id')
              .single();

            if (!categoryError && newCategory) {
              categoryId = newCategory.id;
            }
          }
        }

        // Step 4: Create event in database
        // Use the existing image from the listing instead of extracting from markdown
        const eventImages = listing.image_url ? [listing.image_url] : (scrapedContent.images || []);
        
        const eventToInsert = {
          name: eventData.name,
          url: listing.url,
          start_date: eventData.date || null, // Use the extracted date as start_date
          end_date: null, // Set end_date to null since we only extract one date
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