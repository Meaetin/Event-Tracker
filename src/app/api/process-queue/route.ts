import { NextRequest, NextResponse } from 'next/server';
import FirecrawlApp from '@mendable/firecrawl-js';
import { createClient } from '@supabase/supabase-js';

// Create server-side Supabase client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize FireCrawl
const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY!
});

// Rate limiting: process one item every 3 seconds
const PROCESSING_DELAY = 3000;

async function scrapeDetailedContent(url: string) {
  try {
    console.log(`🕷️ Scraping URL with FireCrawl: ${url}`);
    
    // Use FireCrawl to scrape the URL and get markdown content
    const scrapeResult = await firecrawl.scrapeUrl(url, {
      formats: ['markdown'],
      onlyMainContent: false
    });

    // Check if the result is successful and has content
    if (!scrapeResult) {
      throw new Error('FireCrawl returned no result');
    }

    // Handle the response structure properly
    const data = (scrapeResult as any).data || scrapeResult;
    
    // Return the markdown content
    return {
      markdown: data.markdown || '',
    };

  } catch (error: any) {
    console.error(`❌ FireCrawl scraping error for ${url}:`, error);
    throw new Error(`Failed to scrape ${url}: ${error.message}`);
  }
}

async function processWithAI(scrapedData: { markdown: string; url: string }) {
  try {
    console.log(`🤖 Processing with AI: ${scrapedData.url}`);
    
    const apiUrl = `http://localhost:3000/api/ai-processor`;
    console.log(`📡 Calling AI processor at: ${apiUrl}`);
    
    // Call the AI processor API endpoint
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        markdown: scrapedData.markdown,
        url: scrapedData.url
      })
    });

    if (!response.ok) {
      let errorMessage = 'AI processing failed';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (parseError) {
        // If we can't parse the error response as JSON, get the text
        try {
          const errorText = await response.text();
          errorMessage = `HTTP ${response.status}: ${errorText.substring(0, 200)}...`;
        } catch (textError) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
      }
      throw new Error(errorMessage);
    }

    console.log(`📊 AI processor response status: ${response.status} ${response.statusText}`);
    console.log(`📊 AI processor response headers:`, Object.fromEntries(response.headers.entries()));
    
    let aiResult;
    try {
      aiResult = await response.json();
      console.log(`✅ Successfully parsed AI processor response`);
    } catch (parseError) {
      const responseText = await response.text();
      console.error('❌ Failed to parse AI processor response as JSON:', responseText.substring(0, 500));
      console.error('❌ Parse error:', parseError);
      throw new Error(`AI processor returned invalid JSON: ${responseText.substring(0, 100)}...`);
    }
    
    return aiResult;

  } catch (error: any) {
    console.error(`❌ AI processing error for ${scrapedData.url}:`, error);
    throw new Error(`AI processing failed: ${error.message}`);
  }
}

export async function POST(req: NextRequest) {
  console.log('🚀 Starting queue processing...');
  
  try {
    // Check if FireCrawl API key is configured
    if (!process.env.FIRECRAWL_API_KEY) {
      console.error('❌ FIRECRAWL_API_KEY not configured');
      return NextResponse.json({ error: 'FireCrawl API key not configured' }, { status: 500 });
    }

    console.log('📊 Fetching queued items...');
    
    // Get items queued for processing (approved items or error items that are queued for retry)
    const { data: queuedItems, error: fetchError } = await supabase
      .from('scraped_listings')
      .select('*')
      .in('status', ['approved', 'error'])
      .eq('queued_for_processing', true)
      .order('created_at', { ascending: true })
      .limit(10); // Process max 10 at a time

    if (fetchError) {
      console.error('❌ Error fetching queued items:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    console.log(`📋 Found ${queuedItems?.length || 0} items in queue`);

    if (!queuedItems || queuedItems.length === 0) {
      console.log('✅ No items in queue, returning success');
      return NextResponse.json({ message: 'No items in queue' });
    }

    console.log(`🔄 Processing ${queuedItems.length} items from queue`);
    const results = [];

    for (const item of queuedItems) {
      try {
        console.log(`🔍 Processing item: ${item.title} (${item.url})`);
        
        // Mark as currently processing (just set the queue flag to false to prevent duplicate processing)
        console.log(`📝 Marking item ${item.id} as processing...`);
        const { error: markError } = await supabase
          .from('scraped_listings')
          .update({ 
            queued_for_processing: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);

        if (markError) {
          console.error(`❌ Error marking item as processing:`, markError);
          // Continue anyway
        }

        // Step 1: Scrape detailed content using FireCrawl
        console.log(`🕷️ Step 1: Starting FireCrawl scraping for: ${item.url}`);
        const scrapedData = await scrapeDetailedContent(item.url);
        console.log(`✅ FireCrawl completed for: ${item.url}`);

        // Step 2: Process with AI
        console.log(`🤖 Step 2: Starting AI processing for: ${item.title}`);
        const aiProcessedData = await processWithAI({
          ...scrapedData,
          url: item.url
        });
        console.log(`✅ AI processing completed for: ${item.title}`);

        // Step 3: Insert events into events table and update scraped_listings
        console.log(`💾 Step 3: Inserting events and updating database for item ${item.id}...`);
        
        let insertedEventsCount = 0;
        let insertErrors = [];

        // Insert AI processed events into events table if successful
        if (aiProcessedData.success && aiProcessedData.events && aiProcessedData.events.length > 0) {
          console.log(`📝 Inserting ${aiProcessedData.events.length} events into events table...`);
          
          for (const event of aiProcessedData.events) {
            try {
              // Add source reference to the event
              const eventWithSource = {
                ...event,
                image_url: item.image_url,
                page_url: item.url,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };

              const { error: insertError } = await supabase
                .from('events')
                .insert([eventWithSource]);

              if (insertError) {
                console.error(`❌ Error inserting event ${event.event_id}:`, insertError);
                insertErrors.push(`Event ${event.event_id}: ${insertError.message}`);
              } else {
                insertedEventsCount++;
                console.log(`✅ Successfully inserted event: ${event.event_id}`);
              }
            } catch (eventError: any) {
              console.error(`❌ Error processing event ${event.event_id}:`, eventError);
              insertErrors.push(`Event ${event.event_id}: ${eventError.message}`);
            }
          }
        }

        // Update scraped_listings status only
        let newStatus = 'processed'; // Default to processed if AI was successful
        
        if (!aiProcessedData.success || insertedEventsCount === 0) {
          newStatus = 'error'; // Set to error if AI processing failed or no events were inserted
        }

        const { error: updateError } = await supabase
          .from('scraped_listings')
          .update({
            status: newStatus,
            queued_for_processing: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);

        if (updateError) {
          console.error(`❌ Error updating item ${item.id}:`, updateError);
          results.push({ id: item.id, status: 'error', error: updateError.message });
        } else {
          console.log(`✅ Successfully processed item ${item.id}`);
          results.push({ 
            id: item.id, 
            status: 'completed',
            events_inserted: insertedEventsCount,
            insert_errors: insertErrors,
            aiProcessedData: aiProcessedData
          });
        }

      } catch (error: any) {
        console.error(`❌ Error processing item ${item.id}:`, error);
        
        // Mark as failed
        try {
          await supabase
            .from('scraped_listings')
            .update({
              status: 'error',
              queued_for_processing: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', item.id);
        } catch (dbError) {
          console.error(`❌ Error marking item as failed:`, dbError);
        }
        
        results.push({ id: item.id, status: 'error', error: error.message });
      }

      // Rate limiting: wait before processing next item
      if (queuedItems.indexOf(item) < queuedItems.length - 1) {
        console.log(`⏳ Waiting ${PROCESSING_DELAY}ms before next item...`);
        await new Promise(resolve => setTimeout(resolve, PROCESSING_DELAY));
      }
    }

    console.log(`🎉 Queue processing completed. Results:`, results);
    return NextResponse.json({  
      message: `Processed ${results.length} items`,
      results 
    });

  } catch (error: any) {
    console.error('💥 Queue processing error:', error);
    return NextResponse.json({ error: error.message || 'Queue processing failed' }, { status: 500 });
  }
} 