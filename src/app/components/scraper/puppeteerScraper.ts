import puppeteer, { Browser } from 'puppeteer';

interface ScrapedItem {
  title: string;
  articleUrl: string;
  imageUrl: string;
}

// Retry function with exponential backoff
async function retryOperation<T>(
  operation: () => Promise<T>,
  retries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry if it's a validation error or similar
      if (!error.message?.includes('timeout') && 
          !error.message?.includes('net::') &&
          !error.message?.includes('Navigation')) {
        throw error;
      }

      if (i === retries - 1) break;

      const delay = baseDelay * Math.pow(2, i);
      console.log(`Scraper retry ${i + 1} after ${delay}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Operation failed after retries');
}

export async function runScraper(url: string): Promise<ScrapedItem[]> {
  let browser: Browser | undefined;
  
  const scrapeOperation = async () => {
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920x1080'
        ],
        timeout: 30000 // 30 second timeout for browser launch
      });

      const page = await browser.newPage();
      
      // Set viewport and user agent
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

      // Set a timeout for the entire navigation
      await Promise.race([
        page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 30000
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Navigation timeout')), 30000)
        )
      ]);

      // Wait for a moment to ensure dynamic content is loaded, but with timeout
      await Promise.race([
        new Promise(resolve => setTimeout(resolve, 2000)),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Content loading timeout')), 5000)
        )
      ]);

      const data = await Promise.race([
        page.evaluate(() => {
          const items: ScrapedItem[] = [];
          
          // Try multiple common selectors for event containers
          const containerSelectors = [
            'article',
            '.event-card',
            '.card',
            '.event-item',
            '.event-listing',
            '[data-type="event"]',
            '.post',
            '.item'
          ];

          let containers: Element[] = [];
          for (const selector of containerSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              containers = Array.from(elements);
              console.log(`Found ${elements.length} events with selector: ${selector}`);
              break;
            }
          }

          containers.forEach(container => {
            try {
              // Try multiple selectors for title
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

              // Try multiple selectors for links
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

              // Try multiple selectors for images
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

              // If we found at least a title and URL, add the item
              if (title && articleUrl) {
                items.push({
                  title,
                  articleUrl,
                  imageUrl: imageUrl || ''
                });
              }
            } catch (error) {
              console.error('Error processing container:', error);
            }
          });

          return items;
        }) as Promise<ScrapedItem[]>,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Data extraction timeout')), 30000)
        )
      ]) as ScrapedItem[];

      return data;
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error('Error closing browser:', closeError);
        }
      }
    }
  };

  // Run the scraping operation with retries
  return retryOperation(scrapeOperation);
}
