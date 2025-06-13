import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';

function isValidHttpUrl(str: string) {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  let browser: any = null;
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: 'URL is required.' }, { status: 400 });
    }
    if (!isValidHttpUrl(url)) {
      return NextResponse.json({ error: 'Invalid URL format. Please enter a valid http(s) URL.' }, { status: 400 });
    }

    try {
      browser = await puppeteer.launch({
        headless: 'new' as any,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    } catch (err: any) {
      return NextResponse.json({ error: 'Failed to launch browser.', details: err.message }, { status: 500 });
    }

    let page;
    try {
      page = await browser.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    } catch (err: any) {
      await browser.close();
      if (err.name === 'TimeoutError') {
        return NextResponse.json({ error: 'Navigation timed out. The site may be slow or unreachable.' }, { status: 504 });
      }
      return NextResponse.json({ error: 'Failed to load the page. Please check the URL and try again.', details: err.message }, { status: 400 });
    }

    let items;
    try {
      items = await page.evaluate(() => {
        const items: { title: string; articleUrl: string; imageUrl: string }[] = [];
        const containerSelectors = [
          'article', '.event-card', '.card', '.event-item', '.event-listing',
          '[data-type="event"]', '.post', '.item'
        ];
        let containers: Element[] = [];
        for (const selector of containerSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            containers = Array.from(elements);
            break;
          }
        }
        containers.forEach(container => {
          try {
            const titleSelectors = [
              'h1', 'h2', 'h3', '.title', '.event-title',
              '[data-type="title"]', '.heading', '.card-title'
            ];
            let title = '';
            for (const selector of titleSelectors) {
              const element = container.querySelector(selector);
              if (element?.textContent) {
                title = element.textContent.trim();
                break;
              }
            }
            const linkSelectors = [
              'a', '.event-link', '.card-link', '.title a',
              '[data-type="link"]', '.read-more'
            ];
            let articleUrl = '';
            for (const selector of linkSelectors) {
              const element = container.querySelector(selector) as HTMLAnchorElement;
              if (element?.href) {
                articleUrl = element.href;
                break;
              }
            }
            const imageSelectors = [
              'img', '.event-image', '.card-image',
              '[data-type="image"]', '.thumbnail img',
              '.featured-image img'
            ];
            let imageUrl = '';
            for (const selector of imageSelectors) {
              const element = container.querySelector(selector) as HTMLImageElement;
              if (element?.src) {
                imageUrl = element.src;
                break;
              }
            }
            if (title && articleUrl) {
              items.push({ title, articleUrl, imageUrl: imageUrl || '' });
            }
          } catch (error) {
            // Optionally log error
          }
        });
        return items;
      });
    } catch (err: any) {
      await browser.close();
      return NextResponse.json({ error: 'Failed to scrape the page. The site structure may not be supported.', details: err.message }, { status: 422 });
    }

    await browser.close();
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No events found on the page. The site may not contain recognizable event data.' }, { status: 404 });
    }

    // Insert into Supabase, skip duplicates
    const inserts = items.map((item: any) => ({
      title: item.title,
      url: item.articleUrl,
      image_url: item.imageUrl,
    }));
    // Use upsert to skip duplicates based on url
    const { data, error } = await supabase
      .from('scraped_listings')
      .upsert(inserts, { onConflict: 'url' })
      .select();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // Fetch all by url to return the full set (inserted + existing)
    const urls = inserts.map((i: any) => i.url);
    const { data: allRows, error: fetchError } = await supabase
      .from('scraped_listings')
      .select('*')
      .in('url', urls);
    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    return NextResponse.json({ items: allRows });
  } catch (error: any) {
    if (browser) await browser.close();
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
} 