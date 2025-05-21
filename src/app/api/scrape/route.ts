import { NextRequest, NextResponse } from 'next/server';
import { runScraper } from '../../components/scraper/puppeteerScraper';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
    const scraped = await runScraper(url);
    console.log('Scraped:', scraped);
    // Insert each event into the DB
    for (const item of scraped) {
      const { data, error } = await supabase
        .from('scraped_events')
        .insert({
          article_title: item.title,
          article_url: item.articleUrl,
          image_url: item.imageUrl,
        })
        .select();
      
      console.log('Insert result:', data, error);
    }
    return NextResponse.json(scraped);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
} 