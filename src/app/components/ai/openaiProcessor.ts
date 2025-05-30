import OpenAI from 'openai';

interface ProcessedEventData {
  name: string;
  date: string | null; // Date only (e.g., "22 May 2025" or "22 May - 15 Jun 2025")
  time: string | null; // Time only (e.g., "9:00 am - 9:00 pm")
  location: string;
  description: string;
  category_id: number;
  coordinates?: {
    y: number; // latitude
    x: number; // longitude
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
- Event date (required if available) - DATE ONLY, no time
- Event time (optional) - TIME ONLY, no date
- Location/venue (required, include full address if available)
- Description (required, short description of the event in 1-2 sentences)
- Category ID (required, choose the appropriate number from the categories below)

Available categories:
1: "Arts & Culture"
2: "Food & Drinks" 
3: "Sports & Fitness"
4: "Music & Concerts"
5: "Festivals & Markets"
6: "Nature & Parks"
7: "Family & Kids"
8: "Technology"
9: "Education"
10: "Others"
11: "Entertainment"
13: "Attractions"

IMPORTANT TIMING EXTRACTION GUIDELINES:
- Look specifically for timing information that appears ABOVE "Get directions" links in the markdown
- The timing information is often structured like:
  ##### Date:
  [date range]
  ##### Time:
  [time range]
  [Get directions](...)
  
- Pay special attention to sections with "Date:" and "Time:" headers
- Extract date and time SEPARATELY:
  * date: Only the date portion (e.g., "22 May 2025", "22 May - 15 Jun 2025")
  * time: Only the time portion (e.g., "9:00 am - 9:00 pm", "10:00 am - 6:00 pm")
- Do NOT combine date and time in the same field
- Extract the EXACT time range provided
- Do NOT default to any time unless that's the actual time stated
- Look for patterns like "9:00 am - 9:00 pm", "10:00 am - 6:00 pm", etc.
- If opening hours are provided (like for attractions), use those as the event times

DAY RANGE FORMATTING FOR TIMES:
- When consecutive days are listed with the same hours (e.g., "Mon - Tue - Wed, 9am - 9pm"), format as a range
- Use format: "Mon - Wed: 9:00am - 9:00pm" instead of listing all individual days
- For non-consecutive days, list them separately (e.g., "Mon, Wed, Fri: 9:00am - 9:00pm")
- Always use proper time formatting with AM/PM (e.g., "9:00am" not "9am")
- Examples:
  * "Mon - Tue - Wed, 9am - 9pm" → "Mon - Wed: 9:00am - 9:00pm"
  * "Monday to Friday, 10am - 6pm" → "Mon - Fri: 10:00am - 6:00pm"
  * "Weekdays 9am - 5pm" → "Mon - Fri: 9:00am - 5:00pm"
  * "Weekends 10am - 6pm" → "Sat - Sun: 10:00am - 6:00pm"

LOCATION EXTRACTION GUIDELINES:
- If multiple locations are mentioned, use the FIRST location only
- Include the full address if available, including the venue name
- Singapore postal codes are 5 digits (like, Singapore 02315)
- If a Singapore postal code is present, ALWAYS include it in the location string
- Format: "Venue Name, Street Address, Singapore Postal Code" (e.g., "Marina Bay Sands, 10 Bayfront Avenue, Singapore 018956")
- The postal code is crucial for accurate coordinate mapping

FALLBACK DATE EXTRACTION:
- If no specific event start date is found in the content, look for the article publication date
- The publication date usually appears in this format in the markdown:
  [Author Name](link)
  •
  [Date] (e.g., "23 May 2025")
  •
  [Category]
  •
  [Reading time]
- The publication date is typically located below the author name and above the category/reading time
- Use this publication date as the event date if no other specific event date is mentioned
- Format the fallback date in the same way (e.g., "23 May 2025")

Other guidelines:
- All dates should be processed based on Singapore timezone (SGT/UTC+8)
- If the date is relative (like "this weekend", "next Friday"), try to infer the actual date based on current Singapore time
- If they state duration of date (like "from now till 31 Aug"), state the date to be "Now - 31 Aug 2025"
- If no specific date is found AND no publication date can be extracted, return null for the date
- If no specific time is found, return null for the time
- Keep descriptions concise but informative
- Choose the most appropriate category ID number from the list above

Return the information as a JSON object with the following structure:
{
  "name": "Event Name",
  "date": "22 May 2025" OR "22 May - 15 Jun 2025" OR "Every Friday" OR null,
  "time": "9:00 am - 9:00 pm" OR "10:00 am - 6:00 pm" OR null,
  "location": "Venue Name, Address, City",
  "description": "Brief description of the event",
  "category_id": 4
}

If you cannot extract the required information, return an error object:
{
  "error": "Reason why the event information could not be extracted"
}`;

      // Get current Singapore time for context
      const singaporeTime = new Date().toLocaleString('en-SG', { 
        timeZone: 'Asia/Singapore',
        year: 'numeric',
        month: 'long', 
        day: 'numeric',
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit'
      });

      const userPrompt = `Please extract event information from this markdown content:

Current Singapore time: ${singaporeTime}
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

      // Validate required fields (date and time are optional)
      const requiredFields = ['name', 'location', 'description', 'category_id'];
      for (const field of requiredFields) {
        if (!parsedResponse[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Handle date field - can be string, null, or flexible format
      let processedDate = null;
      if (parsedResponse.date && parsedResponse.date !== null && parsedResponse.date !== "null") {
        processedDate = parsedResponse.date.toString().trim();
      }

      // Handle time field - can be string or null
      let processedTime = null;
      if (parsedResponse.time && parsedResponse.time !== null && parsedResponse.time !== "null") {
        processedTime = parsedResponse.time.toString().trim();
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
        time: processedTime,
        location: parsedResponse.location.trim(),
        description: parsedResponse.description.trim(),
        category_id: parsedResponse.category_id,
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
      // Extract postal code from location if present
      const postalCodeMatch = location.match(/\b5\d{5}\b/);
      const searchQuery = postalCodeMatch ? postalCodeMatch[0] : location;

      // Use Singapore's OneMap API for accurate geocoding
      const response = await fetch(
        `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(searchQuery)}&returnGeom=Y&getAddrDetails=Y`
      );

      if (!response.ok) {
        throw new Error('OneMap API request failed');
      }

      const data = await response.json();
      
      if (data.found > 0 && data.results && data.results.length > 0) {
        const result = data.results[0];
        return {
          x: parseFloat(result.LONGITUDE),
          y: parseFloat(result.LATITUDE)
        };
      }

      // Fallback: if OneMap fails, try basic coordinate extraction from AI
      console.warn('OneMap geocoding failed, falling back to AI geocoding');
      return await this.fallbackAIGeocoding(location);

    } catch (error) {
      console.warn('OneMap geocoding failed:', error);
      // Fallback to AI geocoding
      return await this.fallbackAIGeocoding(location);
    }
  }

  private async fallbackAIGeocoding(location: string): Promise<{ x: number; y: number } | undefined> {
    try {
      // Use a simple geocoding approach - in production, you might want to use a proper geocoding service
      const geocodingPrompt = `Convert this Singapore location to latitude and longitude coordinates: "${location}"
      
IMPORTANT GUIDELINES:
- Singapore postal codes are 5 digits (like, Singapore 02315)
- If a postal code is present in the location, use it as the primary reference for accurate coordinates
- Singapore coordinates typically range: Latitude 1.1° to 1.5°N, Longitude 103.6° to 104.0°E
- Be as precise as possible when postal codes are provided

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