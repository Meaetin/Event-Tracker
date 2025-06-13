import { NextRequest, NextResponse } from 'next/server';
import FirecrawlApp, { ScrapeResponse } from '@mendable/firecrawl-js';
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
    console.log(`Scraping URL with FireCrawl: ${url}`);
    
    // Use FireCrawl to scrape the URL and get markdown content
    const scrapeResult = await firecrawl.scrapeUrl(url, {
      formats: ['markdown']
    });

    // Check if the result is successful and has content
    if (!scrapeResult) {
      throw new Error('FireCrawl returned no result');
    }

    // Handle the response structure properly
    const data = (scrapeResult as any).data || scrapeResult;
    
    // Return the markdown content
    return {
      markdown: data.markdown || ''
    };

  } catch (error: any) {
    console.error(`FireCrawl scraping error for ${url}:`, error);
    throw new Error(`Failed to scrape ${url}: ${error.message}`);
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
    
    // Get items queued for processing
    const { data: queuedItems, error: fetchError } = await supabase
      .from('scraped_listings')
      .select('*')
      .eq('status', 'approved')
      .eq('queued_for_processing', true)
      .order('created_at', { ascending: true })
      .limit(10); // Process max 10 at a time

    if (fetchError) {
      console.error('Error fetching queued items:', fetchError);
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
        
        // Mark as currently processing
        console.log(`📝 Marking item ${item.id} as processing...`);
        const { error: markError } = await supabase
          .from('scraped_listings')
          .update({ processing_started_at: new Date().toISOString() })
          .eq('id', item.id);

        if (markError) {
          console.error(`❌ Error marking item as processing:`, markError);
          // Continue anyway
        }

        // Scrape detailed content using FireCrawl
        console.log(`🕷️ Starting FireCrawl scraping for: ${item.url}`);
        const details = await scrapeDetailedContent(item.url);
        console.log(`✅ FireCrawl completed for: ${item.url}`);

        // Update with detailed content and mark as processed
        console.log(`💾 Updating database for item ${item.id}...`);
        const { error: updateError } = await supabase
          .from('scraped_listings')
          .update({
            queued_for_processing: false,
            processed_at: new Date().toISOString(),
            processing_status: 'completed'
          })
          .eq('id', item.id);

        if (updateError) {
          console.error(`❌ Error updating item ${item.id}:`, updateError);
          // Mark as failed but continue processing others
          await supabase
            .from('scraped_listings')
            .update({
              queued_for_processing: false,
              processing_status: 'failed',
              processing_error: updateError.message
            })
            .eq('id', item.id);
          results.push({ id: item.id, status: 'failed', error: updateError.message });
        } else {
          console.log(`✅ Successfully processed item ${item.id}`);
          results.push({ id: item.id, status: 'completed' });
        }

      } catch (error: any) {
        console.error(`❌ Error processing item ${item.id}:`, error);
        
        // Mark as failed
        try {
          await supabase
            .from('scraped_listings')
            .update({
              queued_for_processing: false,
              processing_status: 'failed',
              processing_error: error.message
            })
            .eq('id', item.id);
        } catch (dbError) {
          console.error(`❌ Error marking item as failed:`, dbError);
        }
        
        results.push({ id: item.id, status: 'failed', error: error.message });
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