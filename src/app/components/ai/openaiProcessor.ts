import OpenAI from 'openai';

interface ProcessedEventData {
  name: string;
  date: string | null; // Date only (e.g., "22 May 2025" or "22 May - 15 Jun 2025")
  time: string | null; // Time only (e.g., "9:00 am - 9:00 pm") OR opening hours for stores
  location: string;
  description: string;
  category_ids: number[]; // Changed: Now supports multiple categories
  store_type: 'event' | 'permanent_store'; // NEW: Type classification
  location_data_source: string; // NEW: What data was used to determine the location
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
- ALWAYS provide coordinate data source: Specify the most precise piece of information that would be used for coordinate mapping (priority: postal code > full address > venue name + area > landmark only). Examples: "Postal code 018956 for exact coordinates", "Full address: 10 Bayfront Avenue for geocoding", "Venue: Marina Bay Sands + Bayfront area for landmark search"

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
- If multiple locations are mentioned, use the FIRST location only and ignore the rest
- Examples of multiple venues to handle:
  * "Multiple venues including Victoria Theatre, National Library Drama Centre Theatre, SOTA Drama Theatre, and SIFA Pavilion at Bedok Town Square, Singapore" → Extract: "Victoria Theatre, Singapore"
  * "Various locations including Marina Bay Sands, Gardens by the Bay, and Sentosa Island" → Extract: "Marina Bay Sands, Singapore"
  * "Event happening at Orchard Road, Bugis Street, and Clarke Quay" → Extract: "Orchard Road, Singapore"
- Look for patterns like "Multiple venues including...", "Various locations...", "Different venues such as...", etc.
- Extract ONLY the first venue name mentioned after these phrases

CRITICAL: AREA TO LANDMARK CONVERSION (MANDATORY):
- ALWAYS convert vague area names to specific landmarks - this is REQUIRED for accurate mapping
- NEVER use general area names like "Marina Bay" - ALWAYS convert to specific landmarks
- MANDATORY conversions (use these EXACT mappings):
  * "Marina Bay" → "Marina Bay Sands, Singapore"
  * "Orchard Road" → "ION Orchard, Singapore" 
  * "Sentosa Island" → "Resorts World Sentosa, Singapore"
  * "Jurong East" → "JEM Shopping Mall, Singapore"
  * "Bugis" → "Bugis Junction, Singapore"
  * "Clarke Quay" → "Clarke Quay Central, Singapore"
  * "Chinatown" → "Chinatown Point, Singapore"
  * "Little India" → "Mustafa Centre, Singapore"
  * "Holland Village" → "Holland Village Shopping Mall, Singapore"
  * "Dhoby Ghaut" → "Dhoby Ghaut MRT Station, Singapore"
  * "City Hall" → "City Hall MRT Station, Singapore"
  * "Raffles Place" → "Raffles Place MRT Station, Singapore"
- If you see any of these area names, you MUST replace them with the corresponding landmark
- Use well-known landmarks like shopping malls, MRT stations, or major buildings within the area
- This conversion is MANDATORY for precise geocoding - do NOT skip this step

- Include the full address if available, including the venue name
- Singapore postal codes are 6 digits (like, Singapore 02315)
- If a Singapore postal code is present, ALWAYS include it in the location string
- Format: "Venue Name, Street Address, Singapore Postal Code" (e.g., "Marina Bay Sands, 10 Bayfront Avenue, Singapore 018956")
- If only venue name is available, format as: "Venue Name, Singapore"
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
  "location": "MUST be specific landmark (e.g., 'Marina Bay Sands, Singapore' NOT 'Marina Bay, Singapore')",
  "description": "Brief description of the event",
  "category_ids": [4, 2],
  "store_type": "event" OR "permanent_store",
  "location_data_source": "Postal code 018956 for exact coordinates" OR "Full address: 10 Bayfront Avenue, Singapore for geocoding" OR "Venue: Marina Bay Sands + Marina Bay area for landmark search" OR "Landmark only: Sentosa Island for general area mapping"
}

IMPORTANT: Before returning the JSON, double-check that the "location" field uses a specific landmark and NOT a general area name. If you see "Marina Bay" in the location, it MUST be changed to "Marina Bay Sands, Singapore".

If you cannot extract the required information, return an error object:
{
  "error": "Reason why the event information could not be extracted"
}
`;

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
      const requiredFields = ['name', 'location', 'description', 'category_ids', 'store_type', 'location_data_source'];
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
        const trimmedDate = parsedResponse.date.toString().trim();
        if (trimmedDate && trimmedDate.length > 0) {
          processedDate = trimmedDate;
        }
      }

      // Special handling for permanent stores without opening dates
      if ((!processedDate || processedDate === null || processedDate === "") && parsedResponse.store_type === 'permanent_store') {
        processedDate = "Ongoing";
        console.log(`Set date to "Ongoing" for permanent store: ${parsedResponse.name}`);
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
        location_data_source: parsedResponse.location_data_source,
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
      const normalizedLocation = location.trim();
      
      // Use Google Geocoding API
      const coordinates = await this.googleGeocoding(normalizedLocation);
      if (coordinates) {
        return coordinates;
      }

      console.warn(`Could not get coordinates for location: "${normalizedLocation}"`);
      return undefined;

    } catch (err) {
      console.warn('Coordinate lookup error:', err);
      return undefined;
    }
  }

  private async googleGeocoding(location: string): Promise<{ x: number; y: number } | undefined> {
    try {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      
      if (!apiKey) {
        console.warn('Google Maps API key not found');
        return undefined;
      }

      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${apiKey}`;
    
      const res = await fetch(url);
      const data = await res.json();
    
      if (data.status === 'OK' && data.results.length > 0) {
        const coords = data.results[0].geometry.location;
        console.log(`✅ Google Maps result for "${location}": ${coords.lat}, ${coords.lng}`);
        return { x: coords.lng, y: coords.lat };
      } else {
        console.warn(`Google geocoding failed for "${location}": ${data.status}`);
        return undefined;
      }
    } catch (error) {
      console.warn('Google geocoding error:', error);
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