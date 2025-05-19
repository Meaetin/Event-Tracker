import puppeteer from 'puppeteer';

interface ScrapedItem {
  title: string;
  articleUrl: string;
  imageUrl: string;
}

export async function runScraper(url: string): Promise<ScrapedItem[]> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(url, {
    waitUntil: 'networkidle2',
  });

  await page.waitForSelector('a.link-secondary');

  const data: ScrapedItem[] = await page.evaluate(() => {
    const items: { title: string; articleUrl: string; imageUrl: string }[] = [];
    const articleLinks = document.querySelectorAll<HTMLAnchorElement>('a.link-secondary');
    articleLinks.forEach(link => {
      const title = link.textContent?.trim() || '';
      const articleUrl = link.href;
      const parent = link.closest('article') || link.closest('div');
      const img = parent?.querySelector<HTMLImageElement>('img');
      const imageUrl = img?.src || '';
      if (title && articleUrl && imageUrl) {
        items.push({ title, articleUrl, imageUrl });
      }
    });
    return items;
  });

  await browser.close();
  return data;
}
