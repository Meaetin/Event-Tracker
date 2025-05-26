

interface JinaScrapedContent {
  url: string;
  markdown: string;
  title?: string;
  images?: string[];
}

interface JinaResponse {
  content: string;
  title?: string;
  images?: string[];
}

export class JinaScraper {
  private apiKey: string;
  private baseUrl = 'https://r.jina.ai/';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.JINA_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('Jina API key is required');
    }
  }

  async scrapeUrl(url: string): Promise<JinaScrapedContent> {
    try {
      // Validate URL
      new URL(url);

      const jinaUrl = `${this.baseUrl}${url}`;
      
      const response = await fetch(jinaUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Return-Format': 'markdown',
          'X-With-Generated-Alt': 'true',
          'X-With-Images-Summary': 'true',
          'User-Agent': 'EventMapApp/1.0'
        },
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      if (!response.ok) {
        throw new Error(`Jina API error: ${response.status} ${response.statusText}`);
      }

      const markdown = await response.text();

      if (!markdown || markdown.trim().length === 0) {
        throw new Error('No content returned from Jina API');
      }

            // Extract title from markdown (usually the first # heading)
      const titleMatch = markdown.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1].trim() : undefined;

      // Extract image URLs from markdown
      const imageMatches = markdown.match(/!\[.*?\]\((.*?)\)/g) || [];
      const images = imageMatches
        .map(match => {
          const urlMatch = match.match(/!\[.*?\]\((.*?)\)/);
          return urlMatch ? urlMatch[1] : null;
        })
        .filter(Boolean) as string[];

      return {
        url,
        markdown: markdown.trim(),
        title,
        images
      };

    } catch (error: any) {
      console.error(`Jina scraping error for ${url}:`, error);
      
      if (error.name === 'AbortError') {
        throw new Error('Jina scraping timed out');
      } else if (error.message?.includes('Invalid URL')) {
        throw new Error('Invalid URL provided');
      } else if (error.message?.includes('Jina API error')) {
        throw error;
      } else {
        throw new Error(`Failed to scrape content: ${error.message}`);
      }
    }
  }

  async scrapeMultipleUrls(urls: string[]): Promise<JinaScrapedContent[]> {
    const results: JinaScrapedContent[] = [];
    const errors: { url: string; error: string }[] = [];

    // Process URLs sequentially to avoid overwhelming the API
    for (const url of urls) {
      try {
        const result = await this.scrapeUrl(url);
        results.push(result);
        
        // Small delay between requests to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        console.error(`Failed to scrape ${url}:`, error);
        errors.push({ url, error: error.message });
      }
    }

    if (errors.length > 0) {
      console.warn('Some URLs failed to scrape:', errors);
    }

    return results;
  }
}