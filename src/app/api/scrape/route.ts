import { NextRequest, NextResponse } from 'next/server';
import { runScraper } from '../../components/scraper/puppeteerScraper';
import { createClient } from '@supabase/supabase-js';

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

export const maxDuration = 60; // Set max duration to 60 seconds

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
    }

    console.log('Starting scrape for URL:', url);
    
    // Run scraper with timeout
    const scraped = await Promise.race([
      runScraper(url),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Scraping timeout')), 15000) // 15 seconds timeout
      )
    ]) as Awaited<ReturnType<typeof runScraper>>;

    console.log('Scraped events:', scraped);

    if (!scraped || scraped.length === 0) {
      return NextResponse.json({ error: 'No events found on the page' }, { status: 404 });
    }

    return NextResponse.json(scraped);
  } catch (error: any) {
    console.error('Scraping error:', error);
    
    // Handle different types of errors
    if (error.message.includes('timeout')) {
      return NextResponse.json(
        { error: 'Scraping took too long. Please try again.' },
        { status: 408 }
      );
    } else if (error.message.includes('net::ERR_NAME_NOT_RESOLVED')) {
      return NextResponse.json(
        { error: 'Could not resolve the website URL. Please check the URL and try again.' },
        { status: 400 }
      );
    } else if (error.message.includes('net::ERR_CONNECTION_REFUSED')) {
      return NextResponse.json(
        { error: 'Could not connect to the website. The site might be down or blocking our requests.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { 
        error: error.message || 'Failed to scrape events',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }, 
      { status: 500 }
    );
  }
} 