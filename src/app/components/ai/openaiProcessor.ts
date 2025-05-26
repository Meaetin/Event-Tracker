import OpenAI from 'openai';

interface ProcessedEventData {
  name: string;
  date: string | null; // ISO timestamp or null if not found
  location: string;
  description: string;
  category: string;
  coordinates?: {
    x: number; // longitude
    y: number; // latitude
  };
}

interface OpenAIProcessorOptions {
  apiKey?: string;
  model?: string;
}

export class OpenAIProcessor {
  private openai: OpenAI;
  private model: string;

  constructor(options: OpenAIProcessorOptions = {}) {
    const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.openai = new OpenAI({ apiKey });
    this.model = options.model || 'gpt-4.1-mini';
  }

  async processEventMarkdown(markdown: string, sourceUrl: string): Promise<ProcessedEventData> {
    try {
      const systemPrompt = `You are an AI assistant that extracts event information from markdown content. 
      
Your task is to analyze the provided markdown content and extract the following information:
- Event name (required)
- Event date and time (required if available)
- Location/venue (required, include full address if available)
- Description (required, short description of the event in 1-2 sentences)
- Category (required, choose from: "Arts and Culture", "Food and Drinks", "Sports and Fitness", "Music and Concerts", "Festivals and Markets", "Nature and Park', "Family and kids", "Entertainment", "Technology", "Education", "Others")

Important guidelines:
- If the date is relative (like "this weekend", "next Friday"), try to infer the actual date based on context
- If they state duration of date (like "from now till 31 Aug"), state the date to be "Now - 'End date' "
- If no specific date is found, return null for the date
- For location, include the full address if available, otherwise just the venue name and city
- Keep descriptions concise but informative
- Choose the most appropriate category from the predefined list

Return the information as a JSON object with the following structure:
{
  "name": "Event Name",
  "date": "24 May 2025 - 31 Aug 2025" OR "24 May 2025" OR "Every Friday" OR "null",
  "location": "Venue Name, Address, City",
  "description": "Brief description of the event",
  "category": "Category Name"
}

If you cannot extract the required information, return an error object:
{
  "error": "Reason why the event information could not be extracted"
}`;

      const userPrompt = `Please extract event information from this markdown content:

Source URL: ${sourceUrl}

Markdown Content:
${markdown}`;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      const parsedResponse = JSON.parse(response);

      if (parsedResponse.error) {
        throw new Error(parsedResponse.error);
      }

      // Validate required fields (date is optional)
      const requiredFields = ['name', 'location', 'description', 'category'];
      for (const field of requiredFields) {
        if (!parsedResponse[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Handle date field - can be string, null, or flexible format
      let processedDate = null;
      if (parsedResponse.date && parsedResponse.date !== null && parsedResponse.date !== "null") {
        // Keep the date as-is since it can be flexible formats like "24 May 2025", "Every Friday", etc.
        processedDate = parsedResponse.date.toString().trim();
      }

      // Try to get coordinates for the location
      let coordinates;
      try {
        coordinates = await this.getCoordinates(parsedResponse.location);
      } catch (error) {
        console.warn('Could not get coordinates for location:', parsedResponse.location);
      }

      return {
        name: parsedResponse.name.trim(),
        date: processedDate,
        location: parsedResponse.location.trim(),
        description: parsedResponse.description.trim(),
        category: parsedResponse.category.trim(),
        coordinates
      };

    } catch (error: any) {
      console.error('OpenAI processing error:', error);
      
      if (error.message?.includes('JSON')) {
        throw new Error('Failed to parse OpenAI response');
      } else if (error.message?.includes('Missing required field')) {
        throw error;
      } else {
        throw new Error(`Failed to process event content: ${error.message}`);
      }
    }
  }

  private async getCoordinates(location: string): Promise<{ x: number; y: number } | undefined> {
    try {
      // Use a simple geocoding approach - in production, you might want to use a proper geocoding service
      const geocodingPrompt = `Convert this location to latitude and longitude coordinates: "${location}"
      
Return only a JSON object with the coordinates:
{
  "latitude": number,
  "longitude": number
}

If you cannot determine the coordinates, return:
{
  "error": "Could not determine coordinates"
}`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'user', content: geocodingPrompt }
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: 'json_object' }
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        return undefined;
      }

      const parsedResponse = JSON.parse(response);
      
      if (parsedResponse.error || !parsedResponse.latitude || !parsedResponse.longitude) {
        return undefined;
      }

      return {
        x: parsedResponse.longitude,
        y: parsedResponse.latitude
      };

    } catch (error) {
      console.warn('Geocoding failed:', error);
      return undefined;
    }
  }

  async processMultipleEvents(markdownContents: Array<{ markdown: string; url: string }>): Promise<ProcessedEventData[]> {
    const results: ProcessedEventData[] = [];
    const errors: { url: string; error: string }[] = [];

    for (const { markdown, url } of markdownContents) {
      try {
        const result = await this.processEventMarkdown(markdown, url);
        results.push(result);
        
        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        console.error(`Failed to process event from ${url}:`, error);
        errors.push({ url, error: error.message });
      }
    }

    if (errors.length > 0) {
      console.warn('Some events failed to process:', errors);
    }

    return results;
  }
} 