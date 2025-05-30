import OpenAI from 'openai';

interface ProcessedEventData {
  name: string;
  date: string | null; // Date only (e.g., "22 May 2025" or "22 May - 15 Jun 2025")
  time: string | null; // Time only (e.g., "9:00 am - 9:00 pm") OR opening hours for stores
  location: string;
  description: string;
  category_ids: number[]; // Changed: Now supports multiple categories
  store_type: 'event' | 'permanent_store'; // NEW: Type classification
  store_type_reasoning: string; // NEW: Explanation for store type choice
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
- Store Type (required, classify as 'event' or 'permanent_store')

MULTIPLE CATEGORIES SUPPORT:
- You can assign multiple categories to better describe the event/venue
- Choose 1-3 most relevant categories (avoid over-categorizing)
- List them in order of relevance (most relevant first)
- Examples:
  * Restaurant with live music: [2, 4] (Food & Drinks, Music & Concerts)
  * Tech conference: [8, 12] (Technology, Business & Networking)
  * Spa & wellness center: [14, 17] (Health & Wellness, Beauty & Personal Care)
  * Children's art workshop: [7, 1] (Family & Kids, Arts & Culture)

STORE TYPE CLASSIFICATION:
- Use 'event' for: Time-limited activities, festivals, concerts, exhibitions, classes, tours, workshops, performances, seasonal events
- Use 'permanent_store' for: Restaurants, cafes, museums, shops, attractions, venues, establishments that operate regularly with fixed opening hours
- Key indicators for permanent_store:
  * Has regular opening hours (e.g., "Mon-Fri 9am-6pm")
  * Is a business/establishment (restaurant, cafe, shop, museum, aquarium, attraction)
  * NO specific end date mentioned (this is the strongest indicator)
  * Described as always available or ongoing
  * Only shows operating hours, not event dates
  * Opening of a new business/venue (opening date = start of operations, not an event)
- Key indicators for event:
  * Has specific start/end dates with LIMITED TIME language
  * Explicitly described as temporary ("for one week only", "until supplies last", "limited time")
  * Uses event language (festival, concert, exhibition, workshop, performance)
  * Described as happening "on" or "until" specific dates with time-limited context
- IMPORTANT: Opening dates for businesses (restaurants, shops, museums, aquariums) indicate permanent store launch, NOT events
- RULE: If no end date is mentioned and only opening hours are provided, classify as 'permanent_store'
- RULE: Opening of permanent establishments (aquarium, restaurant, shop) = 'permanent_store', unless explicitly described as temporary
- ALWAYS provide reasoning: Explain why you chose 'event' or 'permanent_store' based on the indicators found in the content

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
12: "Business & Networking"
13: "Attractions"
14: "Health & Wellness"
15: "Shopping & Retail"
16: "Nightlife & Bars"
17: "Beauty & Personal Care"
18: "Professional Services"
19: "Religious & Spiritual"
20: "Transportation & Travel"

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
  * time: Only the time portion (e.g., "9:00am - 9:00pm", "10:00am - 6:00pm") - NO SPACES around am/pm
- Do NOT combine date and time in the same field
- Extract the EXACT time range provided but apply proper formatting
- Do NOT default to any time unless that's the actual time stated
- Look for patterns like "9:00 am - 9:00 pm", "10:00 am - 6:00 pm", etc. but format as "9:00am - 9:00pm"
- If opening hours are provided (like for attractions), use those as the event times with proper formatting

DAY RANGE FORMATTING FOR TIMES:
- When consecutive days are listed with the same hours, format as a range using FIRST - LAST format
- Use format: "Mon - Wed: 9:00am - 9:00pm" (NO SPACES around am/pm)
- For non-consecutive days, list them separately (e.g., "Mon, Wed, Fri: 9:00am - 9:00pm")
- ALWAYS condense consecutive days: "Sun - Mon - Tue - Wed - Thu" becomes "Sun - Thu"
- NO SPACES in time format: use "7:30pm" NOT "7:30 pm"
- Examples of CORRECT formatting:
  * "Mon - Tue - Wed, 9am - 9pm" → "Mon - Wed: 9:00am - 9:00pm"
  * "Monday to Friday, 10am - 6pm" → "Mon - Fri: 10:00am - 6:00pm"
  * "Weekdays 9am - 5pm" → "Mon - Fri: 9:00am - 5:00pm"
  * "Weekends 10am - 6pm" → "Sat - Sun: 10:00am - 6:00pm"
  * "Fri - Sat: 7:30pm - 12:00am; Sun - Mon - Tue - Wed - Thu: 7:30pm - 11:00pm" → "Fri - Sat: 7:30pm - 12:00am; Sun - Thu: 7:30pm - 11:00pm"

PERMANENT STORE DETECTION:
- If there is NO specific end date mentioned, automatically classify as 'permanent_store'
- If the content only shows opening hours without event dates, it's a permanent_store
- If no event-specific dates are found, treat as permanent_store with opening hours

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
  "time": "9:00am - 9:00pm" OR "Mon - Fri: 10:00am - 6:00pm" OR null,
  "location": "Venue Name, Address, City",
  "description": "Brief description of the event",
  "category_ids": [4, 2],
  "store_type": "event" OR "permanent_store",
  "store_type_reasoning": "Classified as 'permanent_store' because it's a new aquarium opening with regular operating hours, indicating the start of permanent business operations, not a temporary event." OR "Classified as 'event' because it explicitly states 'limited 3-day exhibition' with specific end date, indicating temporary activity." OR "Classified as 'permanent_store' because it shows regular operating hours (Mon-Fri: 9am-6pm) with no time-limited language or end date mentioned."
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
      const requiredFields = ['name', 'location', 'description', 'category_ids', 'store_type', 'store_type_reasoning'];
      for (const field of requiredFields) {
        if (!parsedResponse[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Validate store_type field
      if (!['event', 'permanent_store'].includes(parsedResponse.store_type)) {
        throw new Error(`Invalid store_type: ${parsedResponse.store_type}. Must be 'event' or 'permanent_store'`);
      }

      // Validate category_ids field
      if (!Array.isArray(parsedResponse.category_ids) || parsedResponse.category_ids.length === 0) {
        throw new Error('category_ids must be a non-empty array');
      }
      
      // Validate each category ID
      for (const categoryId of parsedResponse.category_ids) {
        if (!Number.isInteger(categoryId) || categoryId < 1 || categoryId > 20) {
          throw new Error(`Invalid category_id: ${categoryId}. Must be between 1 and 20`);
        }
      }

      // Handle date field - can be string, null, or flexible format
      let processedDate = null;
      if (parsedResponse.date && parsedResponse.date !== null && parsedResponse.date !== "null") {
        processedDate = parsedResponse.date.toString().trim();
      }

      // Special handling for permanent stores without opening dates
      if (!processedDate && parsedResponse.store_type === 'permanent_store') {
        processedDate = "Now Open";
        console.log(`Set date to "Now Open" for permanent store: ${parsedResponse.name}`);
      }

      // Handle time field - can be string or null
      let processedTime = null;
      if (parsedResponse.time && parsedResponse.time !== null && parsedResponse.time !== "null") {
        processedTime = parsedResponse.time.toString().trim();
      }

      // Special handling for events/stores without specific times
      if (!processedTime) {
        processedTime = "Check website for opening hours";
        console.log(`Set time to "Check website for opening hours" for: ${parsedResponse.name}`);
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
        category_ids: parsedResponse.category_ids,
        store_type: parsedResponse.store_type,
        store_type_reasoning: parsedResponse.store_type_reasoning,
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
      
      if (postalCodeMatch) {
        // If postal code found, use OneMap API
        console.log(`Using OneMap API for postal code: ${postalCodeMatch[0]}`);
        const searchQuery = postalCodeMatch[0];

        const response = await fetch(
          `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(searchQuery)}&returnGeom=Y&getAddrDetails=Y`
        );

        if (!response.ok) {
          throw new Error('OneMap API request failed');
        }

        const data = await response.json();
        
        if (data.found > 0 && data.results && data.results.length > 0) {
          const result = data.results[0];
          console.log(`OneMap coordinates found: ${result.LATITUDE}, ${result.LONGITUDE}`);
          return {
            x: parseFloat(result.LONGITUDE),
            y: parseFloat(result.LATITUDE)
          };
        }
      }

      // No postal code or OneMap failed, try online geocoding with location name
      console.log(`No postal code found or OneMap failed, trying online geocoding for: ${location}`);
      const onlineCoords = await this.onlineGeocoding(location);
      if (onlineCoords) {
        return onlineCoords;
      }

      // Final fallback: AI geocoding
      console.warn('Online geocoding failed, falling back to AI geocoding');
      return await this.fallbackAIGeocoding(location);

    } catch (error) {
      console.warn('Coordinate lookup failed:', error);
      // Try online geocoding as backup
      try {
        const onlineCoords = await this.onlineGeocoding(location);
        if (onlineCoords) {
          return onlineCoords;
        }
      } catch (onlineError) {
        console.warn('Online geocoding backup failed:', onlineError);
      }
      
      // Final fallback to AI geocoding
      return await this.fallbackAIGeocoding(location);
    }
  }

  private async onlineGeocoding(location: string): Promise<{ x: number; y: number } | undefined> {
    try {
      // Clean the location string for better geocoding results
      const cleanLocation = this.cleanLocationForGeocoding(location);
      console.log(`Attempting online geocoding for: ${cleanLocation}`);

      // Use Nominatim (OpenStreetMap) geocoding service - free and reliable
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanLocation)}&countrycodes=sg&limit=1&addressdetails=1`;
      
      const response = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'EventScapeSG/1.0 (https://eventscape.sg)'
        }
      });

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data && data.length > 0) {
        const result = data[0];
        const latitude = parseFloat(result.lat);
        const longitude = parseFloat(result.lon);
        
        // Validate that coordinates are within Singapore bounds
        if (this.isValidSingaporeCoordinate(latitude, longitude)) {
          console.log(`Online geocoding successful: ${latitude}, ${longitude}`);
          return {
            x: longitude,
            y: latitude
          };
        } else {
          console.warn(`Coordinates outside Singapore bounds: ${latitude}, ${longitude}`);
        }
      }

      // If Nominatim fails, try a secondary approach with more specific search
      if (location.toLowerCase().includes('singapore')) {
        const secondaryUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&countrycodes=sg&limit=3&addressdetails=1`;
        
        const secondaryResponse = await fetch(secondaryUrl, {
          headers: {
            'User-Agent': 'EventScapeSG/1.0 (https://eventscape.sg)'
          }
        });

        if (secondaryResponse.ok) {
          const secondaryData = await secondaryResponse.json();
          
          for (const result of secondaryData) {
            const latitude = parseFloat(result.lat);
            const longitude = parseFloat(result.lon);
            
            if (this.isValidSingaporeCoordinate(latitude, longitude)) {
              console.log(`Secondary online geocoding successful: ${latitude}, ${longitude}`);
              return {
                x: longitude,
                y: latitude
              };
            }
          }
        }
      }

      console.warn('Online geocoding found no valid results');
      return undefined;

    } catch (error) {
      console.warn('Online geocoding error:', error);
      return undefined;
    }
  }

  private cleanLocationForGeocoding(location: string): string {
    // Clean and optimize the location string for better geocoding results
    let cleaned = location.trim();
    
    // If location doesn't end with Singapore, add it
    if (!cleaned.toLowerCase().includes('singapore')) {
      cleaned += ', Singapore';
    }
    
    // Remove common noise words that might confuse geocoding
    cleaned = cleaned.replace(/\b(Level \d+|#\d+-\d+|Unit \d+)\b/gi, '');
    
    // Clean up extra spaces and punctuation
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    cleaned = cleaned.replace(/,\s*,/g, ','); // Remove double commas
    
    return cleaned;
  }

  private isValidSingaporeCoordinate(latitude: number, longitude: number): boolean {
    // Singapore bounds: approximately 1.1°N to 1.5°N, 103.6°E to 104.0°E
    return (
      latitude >= 1.1 && latitude <= 1.5 &&
      longitude >= 103.6 && longitude <= 104.0
    );
  }

  private async fallbackAIGeocoding(location: string): Promise<{ x: number; y: number } | undefined> {
    try {
      // Enhanced AI geocoding with better instructions
      const geocodingPrompt = `You are a geocoding expert for Singapore locations. Convert this Singapore location to precise latitude and longitude coordinates: "${location}"

ENHANCED GEOCODING GUIDELINES:
- Search your knowledge for the exact coordinates of this Singapore location
- If it's a well-known venue (like Superpark Suntec City), use your knowledge of its precise location
- Singapore postal codes are 5 digits starting with 5 (e.g., 568956)
- Singapore coordinates: Latitude 1.1° to 1.5°N, Longitude 103.6° to 104.0°E
- Common Singapore landmarks:
  * Marina Bay Sands: 1.2834, 103.8607
  * Orchard Road: 1.3048, 103.8318  
  * Sentosa Island: 1.2494, 103.8303
  * Jurong East: 1.3329, 103.7436
  * Changi Airport: 1.3644, 103.9915
- For shopping malls, use the main building coordinates
- For specific venues within complexes, use the complex's main coordinates
- Be as precise as possible - use 4-6 decimal places

LOCATION ANALYSIS:
1. Identify the main venue/building name
2. Identify the area/district if mentioned
3. Use your knowledge of Singapore geography
4. Provide coordinates with high confidence

Return only a JSON object with precise coordinates:
{
  "latitude": number,
  "longitude": number,
  "confidence": "high" | "medium" | "low",
  "reasoning": "Brief explanation of how you determined these coordinates"
}

If you cannot determine the coordinates with reasonable confidence, return:
{
  "error": "Could not determine coordinates with sufficient confidence"
}`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'user', content: geocodingPrompt }
        ],
        temperature: 0.1,
        max_tokens: 300,
        response_format: { type: 'json_object' }
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        return undefined;
      }

      const parsedResponse = JSON.parse(response);
      
      if (parsedResponse.error || !parsedResponse.latitude || !parsedResponse.longitude) {
        console.warn('AI geocoding failed:', parsedResponse.error || 'No coordinates returned');
        return undefined;
      }

      // Validate Singapore bounds
      if (!this.isValidSingaporeCoordinate(parsedResponse.latitude, parsedResponse.longitude)) {
        console.warn(`AI geocoding returned coordinates outside Singapore: ${parsedResponse.latitude}, ${parsedResponse.longitude}`);
        return undefined;
      }

      console.log(`AI geocoding successful: ${parsedResponse.latitude}, ${parsedResponse.longitude} (${parsedResponse.confidence} confidence)`);
      if (parsedResponse.reasoning) {
        console.log(`AI reasoning: ${parsedResponse.reasoning}`);
      }

      return {
        x: parsedResponse.longitude,
        y: parsedResponse.latitude
      };

    } catch (error) {
      console.warn('AI geocoding failed:', error);
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