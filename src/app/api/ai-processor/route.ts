import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  console.log('🤖 AI Processor API called');
  try {
    const { markdown, url } = await req.json();
    console.log(`📥 Received request for URL: ${url}`);

    // Validate required fields
    if (!markdown || !url) {
      return NextResponse.json(
        { error: 'Missing required fields: markdown and url are required' },
        { status: 400 }
      );
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY not configured');
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    console.log(`🤖 AI Processing started for URL: ${url}`);
    console.log(`📄 Content length: ${markdown.length} characters`);

    // Create the prompt for OpenAI
    const prompt = `I am building an event database for a website. Please generate detailed sample data in JSON format for both an events table and a related event_locations table, ready for bulk insertion into a PostgreSQL/Supabase database.

Instructions:

The events table (one row per event) should contain these fields:

event_id (unique, string)
event_name (string)
start_date (YYYY-MM-DD)
end_date (YYYY-MM-DD)
date_text (string, display-friendly version of the event's date or "Permanent; opened [date]" if it is a permanent attraction/venue)
location_text (full address of all locations/venues, string)
description (event overview, string)
price_min (number, lowest possible price per person)
price_max (number, highest possible price per person)
price (display-friendly, string; e.g., "Free", "$10-$20")
duration_min (number, minimum estimated visit time in hours)
duration_max (number, maximum estimated visit time in hours)
opening_hours (string, opening hours)
opening_hours_structured (array of objects, opening hours structured)
visit_notes (markdown advice for visitors, string)
detailed_breakdown (markdown or plain text step-by-step/segment time breakdown)
primary_lat (number, latitude for primary location/pin)
primary_lng (number, longitude for primary location/pin)
categories (array of 2-3 most relevant category IDs for the event from this list below, e.g. [8,9,12])
image_url (string, URL of the cover image; select the hero/preview or og:image for the venue/event)

Here are the available categories and their IDs:

(1, 'Arts & Culture'),
(2, 'Attractions'),
(3, 'Beauty & Personal Care'),
(4, 'Business & Networking'),
(5, 'Education'),
(6, 'Entertainment'),
(7, 'Family & Kids'),
(8, 'Festivals & Markets'),
(9, 'Food & Drinks'),
(10, 'Health & Wellness'),
(11, 'Music & Concerts'),
(12, 'Nature & Parks'),
(13, 'Nightlife & Bars'),
(14, 'Professional Services'),
(15, 'Religious & Spiritual'),
(16, 'Shopping & Retail'),
(17, 'Sports & Fitness'),
(18, 'Technology'),
(19, 'Transportation & Travel'),
(20, 'Others');

Use realistic data based on the content provided below. Extract as much relevant information as possible from the scraped content.

LOCATION EXTRACTION GUIDELINES:
- If multiple locations are mentioned, use the FIRST location only and ignore the rest
- Examples of multiple venues to handle:
  * "Multiple venues including Victoria Theatre, National Library Drama Centre Theatre, SOTA Drama Theatre, and SIFA Pavilion at Bedok Town Square, Singapore" → Extract: "Victoria Theatre, Singapore"
  * "Various locations including Marina Bay Sands, Gardens by the Bay, and Sentosa Island" → Extract: "Marina Bay Sands, Singapore"
  * "Event happening at Orchard Road, Bugis Street, and Clarke Quay" → Extract: "Orchard Road, Singapore"
- Look for patterns like "Multiple venues including...", "Various locations...", "Different venues such as...", etc.
- Extract ONLY the first venue name mentioned after these phrases

PERMANENT VENUE IDENTIFICATION (REQUIRED):
- If the content describes a permanent or ongoing venue, store, installation, or experience (not a one-off or periodic event):
  * Set the end_date to a far-future date (e.g., "2035-12-31")
  * Set start_date to the official opening date, or the earliest mentioned date.
  * Set date_text to "Permanent; opened [opening date]" (e.g., "Permanent; opened 14 Jun 2025").
  * Clearly indicate in the description that this is a permanent (always open) attraction, NOT a seasonal/pop-up event.
- If not a permanent attraction, set date_text to the normal event date range (e.g., "14-16 June 2025").

DISPLAY DATE FORMATTING:
- Always fill in date_text with a user-friendly string:
   * For single-day events: "14 June 2025"
   * For multi-day/date-range events: "14-16 June 2025"
   * For permanent venues: "Permanent; opened 14 Jun 2025"
   * If fallback publication date is used, format as "23 May 2025" (day month year)

PRICE FIELDS STANDARDISATION:
- If the main admission is free, set price_min and price_max to 0. Display-friendly price: "Free".
- If prices are unavailable, set price_min and price_max to null and display-friendly price to "See details" or similar.

CATEGORY SELECTION:
- Select 2-3 of the most relevant categories for each event/venue, matching the category ID precisely.
- If the event/venue is a hybrid (e.g., permanent gaming store + food & drinks area), choose all fitting categories.

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


Other guidelines:
- All dates should be processed based on Singapore timezone (SGT/UTC+8)
- If the date is relative (like "this weekend", "next Friday"), try to infer the actual date based on current Singapore timev
- For visit_notes and detailed_breakdown, always use markdown-style bullet lists and clear segment headings for clarity.
- All dates and times must be represented and interpreted in Singapore timezone (SGT/UTC+8). Conversion is required if UTC or other zone.
- Output fields must exactly match the specified order. No extra fields, no missing fields.

Your output should be valid JSON, ready for import, with markdown text in the relevant fields.

Example Output:

events: [
  {
    "event_id": "islandersday2025",
    "event_name": "Islander's Day at West Coast Park",
    "start_date": "2025-06-14",
    "end_date": "2025-06-14",
    "date_text": "Permanent; opened 14 Jun 2025",
    "location_text": "West Coast Ferry Road, Main Lawn, Singapore 126978",
    "description": "Celebrate the heritage of Singapore's original islanders, the Orang Pulau, at Islander's Day, held at West Coast Park. Experience maritime workshops, interactive storytelling for kids, traditional performances, and free film screenings— all designed to showcase the islander way of life. Organised by Orang Laut SG, this community event offers a rare chance to learn about island skills, crafts, and folklore, right on Singapore's mainland.",
    "price_min": 0,
    "price_max": 17.87,
    "price": "Free entry, workshops $16.82 - $17.87",
    "duration_min": 1.5,
    "duration_max": 5,
    "opening_hours": "10am - 9pm",
    "opening_hours_structured": [
        {
        "day": "Saturday",
        "open": "10:00",
        "close": "21:00"
        }   
    ],
    "visit_notes": "Most visitors spend 2-3 hours, enjoying open performances, film screenings, and free activities. For those joining hands-on workshops (maritime skills or Jong boat-making), budget 1.5-2 hrs per workshop and book ahead due to limited slots and paid entry. The event is mostly outdoors—bring a hat, sunscreen, and water. Some seating is available for performances and films. Easily accessible via Clementi MRT and bus 201 (alight at Opp Waseda S Snr High Sch, short walk to main lawn).",
    "detailed_breakdown": "• Explore displays, food stalls, and photo ops: 20-30 min\n• Maritime Fishing Workshop: 1.5-2 hr (pre-book, $16.82)\n• Jong Boat Workshop: 1.5-2 hr (pre-book, $16.82)\n• Storytelling for Kids: 45 min (ages 5+, $17.87, ticketed)\n• Watch a Film/Performance: 30-60 min each (varies through the day, all free)\n• Mingling/relaxing breaks: 20-30 min\n_\nTypical visit: 2-3 hours. Full festival experience (with workshops): 4-5 hours.",
    "categories": [1, 7, 8],
    "image_url": "https://thesmartlocal.com/wp-content/uploads/2025/06/Gamers-Guild-Bugis-cover-image-.png",
    }
]

IMPORTANT: Output ONLY valid JSON. Do not include any markdown formatting, code blocks, or explanatory text. Start directly with [ or { and end with ] or }.

Here is the scraped content to analyze:

URL: ${url}

Content:
${markdown}`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3, // Lower temperature for more consistent structured output
      max_tokens: 4000, // Ensure we have enough tokens for the JSON response
    });

    const aiResponse = completion.choices[0]?.message?.content;
    
    if (!aiResponse) {
      throw new Error('No response from OpenAI');
    }

    console.log(`✅ AI Processing completed for URL: ${url}`);
    console.log(`📊 Response length: ${aiResponse.length} characters`);

    // Try to parse the JSON response
    let parsedData;
    try {
      // More comprehensive cleaning of the response
      let cleanedResponse = aiResponse;
      
      // Remove markdown code blocks
      cleanedResponse = cleanedResponse.replace(/```json\s*/g, '');
      cleanedResponse = cleanedResponse.replace(/```\s*/g, '');
      
      // Remove any leading/trailing whitespace
      cleanedResponse = cleanedResponse.trim();
      
      // If the response starts with text before JSON, try to extract just the JSON part
      const jsonStart = cleanedResponse.indexOf('[');
      const jsonStartObj = cleanedResponse.indexOf('{');
      
      if (jsonStart !== -1 || jsonStartObj !== -1) {
        const actualStart = jsonStart !== -1 && jsonStartObj !== -1 
          ? Math.min(jsonStart, jsonStartObj) 
          : (jsonStart !== -1 ? jsonStart : jsonStartObj);
        cleanedResponse = cleanedResponse.substring(actualStart);
      }
      
      // Find the end of JSON (last } or ])
      let jsonEnd = -1;
      let braceCount = 0;
      let bracketCount = 0;
      let inString = false;
      let escapeNext = false;
      
      for (let i = 0; i < cleanedResponse.length; i++) {
        const char = cleanedResponse[i];
        
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        
        if (char === '"') {
          inString = !inString;
          continue;
        }
        
        if (!inString) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
          if (char === '[') bracketCount++;
          if (char === ']') bracketCount--;
          
          if (braceCount === 0 && bracketCount === 0 && (char === '}' || char === ']')) {
            jsonEnd = i + 1;
            break;
          }
        }
      }
      
      if (jsonEnd !== -1) {
        cleanedResponse = cleanedResponse.substring(0, jsonEnd);
      }
      
      console.log('🧹 Cleaned response preview:', cleanedResponse.substring(0, 200) + '...');
      
      parsedData = JSON.parse(cleanedResponse);
      console.log('🔍 Parsed data:', parsedData);
    } catch (parseError: any) {
      console.error('❌ Failed to parse AI response as JSON:', parseError);
      console.log('Raw AI response:', aiResponse.substring(0, 1000) + '...');
      
      // Return the raw response for debugging
      return NextResponse.json({
        success: false,
        error: 'Failed to parse AI response as JSON',
        raw_response: aiResponse,
        parse_error: parseError.message
      });
    }

         // Get coordinates from Google Maps API 
     async function getCoordinates(location_text: string) {   
       try {
         const apiKey = process.env.GOOGLE_MAPS_API_KEY;

         if (!apiKey) {
           console.warn('⚠️ Google Maps API key not configured, skipping coordinate lookup');
           return { primary_lat: null, primary_lng: null };
         }

         const encodedAddress = encodeURIComponent(location_text);
         const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`);
         const data = await response.json();
         
         if (data.status === 'OK' && data.results.length > 0) {
           const result = data.results[0];
           const coordinates = result.geometry.location;
           console.log(`📍 Got coordinates for "${location_text}": ${coordinates.lat}, ${coordinates.lng}`);
           return { primary_lat: coordinates.lat, primary_lng: coordinates.lng };
         } else {
           console.warn(`⚠️ No coordinates found for "${location_text}": ${data.status}`);
           return { primary_lat: null, primary_lng: null };
         }
       } catch (error: any) {
         console.error('❌ Error getting coordinates from Google Maps API:', error);
         return { primary_lat: null, primary_lng: null };
       }
     }

     // Validate the structure - handle both direct array and object with events property
     let eventsArray;
     if (Array.isArray(parsedData)) {
       eventsArray = parsedData;
     } else if (parsedData && Array.isArray(parsedData.events)) {
       eventsArray = parsedData.events;
     } else {
       console.error('❌ Invalid JSON structure from AI - expected array of events or object with events property');
       return NextResponse.json({
         success: false,
         error: 'Invalid JSON structure - expected array of events or object with events property',
         parsed_data: parsedData
       });
     }

     console.log(`📈 Successfully parsed ${eventsArray.length} events from AI`);

     // Process each event to get coordinates
     const eventsWithCoordinates = [];
     
     for (let i = 0; i < eventsArray.length; i++) {
       const event = eventsArray[i];
       console.log(`🔍 Processing event ${i + 1}/${eventsArray.length}: ${event.event_name || 'Unnamed Event'}`);
       
       // Get coordinates if location_text is available
       let coordinates = { primary_lat: null, primary_lng: null };
       if (event.location_text) {
         coordinates = await getCoordinates(event.location_text);
         
         // Add a small delay to respect Google Maps API rate limits
         if (i < eventsArray.length - 1) {
           await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
         }
       }
       
       // Merge the event data with coordinates
       const eventWithCoordinates = {
         ...event,
         ...coordinates
       };
       
       eventsWithCoordinates.push(eventWithCoordinates);
     }

     console.log(`✅ Completed coordinate lookup for all ${eventsWithCoordinates.length} events`);

     // Return the complete processed data
     return NextResponse.json({
       success: true,
       events: eventsWithCoordinates,
       processing_metadata: {
         url: url,
         content_length: markdown.length,
         events_count: eventsWithCoordinates.length,
         coordinates_fetched: eventsWithCoordinates.filter(e => e.primary_lat && e.primary_lng).length,
         processed_at: new Date().toISOString()
       }
     });

  } catch (error: any) {
    console.error('❌ AI Processing error:', error);
    console.error('❌ Error stack:', error.stack);
    
    // Handle OpenAI specific errors
    if (error.code === 'insufficient_quota') {
      return NextResponse.json(
        { error: 'OpenAI API quota exceeded. Please check your billing.' },
        { status: 429 }
      );
    }
    
    if (error.code === 'invalid_api_key') {
      return NextResponse.json(
        { error: 'Invalid OpenAI API key' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { 
        error: error.message || 'AI processing failed',
        type: error.type || 'unknown_error',
        code: error.code || 'unknown_code',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}       