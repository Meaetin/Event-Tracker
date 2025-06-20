import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getRestaurantRecommendations } from '@/lib/restaurantAPI';

// Types for the API
interface PlannerFormData {
  date: string;
  startTime: string;
  duration: number;
  endTime: string;
  pax: number;
  selectedCategories: number[];
  budgetPerPax: number;
  prioritizeFavorites: boolean;
  transport: 'public' | 'private';
}

interface Event {
  id: string;
  event_name: string;
  start_date: string;
  end_date: string;
  location_text: string;
  description: string;
  price_min: number | null;
  price_max: number | null;
  duration_min: number | null;
  duration_max: number | null;
  categories_name: string | null;
  visit_notes: string | null;
  detailed_breakdown: string | null;
}

interface GoogleDirectionsResponse {
  routes: Array<{
    legs: Array<{
      duration: {
        value: number;
        text: string;
      };
      distance: {
        value: number;
        text: string;
      };
      steps: Array<{
        html_instructions: string;
        duration: {
          value: number;
        };
        distance: {
          value: number;
        };
      }>;
    }>;
  }>;
  status: string;
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to get actual travel times from Google Directions API
async function getActualTravelTime(
  origin: string,
  destination: string,
  travelMode: 'DRIVE' | 'TRANSIT' = 'DRIVE'
): Promise<{
  duration: number; // in seconds
  distance: number; // in meters
  instructions: string[];
} | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    console.warn('⚠️ Google Maps API key not configured, using fallback travel times');
    return null;
  }

  try {
    // Add Singapore context to addresses for better accuracy
    const originAddress = origin.includes('Singapore') ? origin : `${origin}, Singapore`;
    const destinationAddress = destination.includes('Singapore') ? destination : `${destination}, Singapore`;
    const mode = travelMode === 'DRIVE' ? 'driving' : 'transit';
    
    // Build URL with proper parameters
    const params = new URLSearchParams({
      origin: originAddress,
      destination: destinationAddress,
      mode: mode,
      key: apiKey
    });

    // Add departure time for transit or traffic-aware driving
    if (mode === 'transit' || mode === 'driving') {
      params.append('departure_time', 'now');
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('Directions API failed:', response.status, response.statusText);
      return null;
    }

    const data: GoogleDirectionsResponse = await response.json();
    
    if (data.status !== 'OK') {
      console.warn('Directions API returned status:', data.status);
      return null;
    }
    
    if (!data.routes || data.routes.length === 0) {
      console.warn('No routes found from Directions API');
      return null;
    }

    const route = data.routes[0];
    const leg = route.legs[0];
    const durationSeconds = leg.duration.value;
    const distanceMeters = leg.distance.value;
    const instructions = leg.steps?.map(step => 
      step.html_instructions?.replace(/<[^>]*>/g, '') || 'Continue along route'
    ).slice(0, 3) || ['Travel via recommended route'];


    return {
      duration: durationSeconds,
      distance: distanceMeters,
      instructions
    };

  } catch (error) {
    console.error('Directions API error:', error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  console.log('🎯 AI Planner API called');
  try {
    const { formData, events, excludePrevious, usedEventIds, generationCount, varietyMode }: { 
      formData: PlannerFormData; 
      events: Event[]; 
      excludePrevious?: boolean;
      usedEventIds?: string[];
      generationCount?: number;
      varietyMode?: boolean;
    } = await req.json();
    console.log(`📥 Received planning request for ${events.length} events`);

    // Validate required fields
    if (!formData || !events) {
      return NextResponse.json(
        { error: 'Missing required fields: formData and events are required' },
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

    console.log(`🤖 AI Planning started for ${formData.date}`);
    console.log(`📊 Parameters: ${formData.pax} people, $${formData.budgetPerPax} budget, ${formData.duration}h duration`);
    
    if (varietyMode) {
      console.log(`🔄 Variety mode enabled - Generation #${generationCount}, excluding ${usedEventIds?.length || 0} previous events`);
    }

    // Get live restaurant data for key Singapore locations
    console.log('🍽️ Fetching live restaurant data from Google Places API...');
    const keyLocations = [
      { name: 'Marina Bay', lat: 1.2834, lng: 103.8607 },
      { name: 'Orchard Road', lat: 1.3048, lng: 103.8318 },
      { name: 'Chinatown', lat: 1.2812, lng: 103.8448 },
      { name: 'Little India', lat: 1.3067, lng: 103.8516 },
      { name: 'Bugis', lat: 1.2966, lng: 103.8560 },
      { name: 'Clarke Quay', lat: 1.2884, lng: 103.8465 },
      { name: 'Sentosa', lat: 1.2494, lng: 103.8303 }
    ];

    const liveRestaurantData: any[] = [];
    const usedRestaurants: string[] = [];
    
    // Fetch restaurant data for each key location and meal type
    for (const location of keyLocations.slice(0, 4)) { // Limit to 4 locations to avoid too many API calls
      // Get different restaurants for different meal types
      const mealTypes: ('breakfast' | 'lunch' | 'dinner')[] = ['breakfast', 'lunch', 'dinner'];
      
      for (const mealType of mealTypes) {
        try {
          const restaurantData = await getRestaurantRecommendations(
            location.name,
            mealType,
            formData.budgetPerPax,
            { lat: location.lat, lng: location.lng },
            usedRestaurants // Pass used restaurants to avoid duplicates
          );
          
          if (restaurantData.source === 'api') {
            liveRestaurantData.push({
              area: location.name,
              meal_type: mealType,
              venue_name: restaurantData.venue_name,
              location: restaurantData.location,
              cost_per_person: restaurantData.cost_per_person,
              suggestions: restaurantData.suggestions
            });
            
            // Track this restaurant to avoid duplicates
            usedRestaurants.push(restaurantData.venue_name);
          }
        } catch (error) {
          console.log(`⚠️ Failed to get ${mealType} restaurant data for ${location.name}`);
        }
      }
    }

    // Pre-calculate travel times between key locations using Google Directions API
    console.log('🗺️ Pre-calculating travel times using Google Directions API...');
    const travelMode = formData.transport === 'public' ? 'TRANSIT' : 'DRIVE';
    const travelData: Array<{
      from: string;
      to: string;
      duration: number;
      distance: number;
      instructions: string[];
    }> = [];

    // Sample some popular location pairs for the AI to reference
    const popularLocations = [
      'Marina Bay Sands',
      'Gardens by the Bay', 
      'Sentosa Island',
      'Orchard Road',
      'Clarke Quay',
      'Little India',
      'Chinatown',
      'Bugis Street',
      'Singapore Zoo',
      'Universal Studios Singapore'
    ];

    // Calculate travel times between some popular locations
    for (let i = 0; i < Math.min(popularLocations.length, 5); i++) {
      for (let j = i + 1; j < Math.min(popularLocations.length, 5); j++) {
        const origin = popularLocations[i];
        const destination = popularLocations[j];
        
        try {
          const travelInfo = await getActualTravelTime(origin, destination, travelMode);
          if (travelInfo) {
            travelData.push({
              from: origin,
              to: destination,
              duration: Math.round(travelInfo.duration / 60), // Convert to minutes
              distance: Math.round(travelInfo.distance / 1000 * 100) / 100, // Convert to km with 2 decimal places
              instructions: travelInfo.instructions.slice(0, 3) // First 3 instructions
            });
          }
        } catch (error) {
          console.log(`⚠️ Failed to get travel time for ${origin} → ${destination}`);
        }
      }
    }

    // Also calculate travel times between actual event locations if we have coordinates
    const eventLocations = events
      .filter(event => event.location_text && event.location_text.trim())
      .slice(0, 10) // Limit to first 10 to avoid too many API calls
      .map(event => event.location_text.trim());

    // Calculate a few key event-to-event travel times
    for (let i = 0; i < Math.min(eventLocations.length, 3); i++) {
      for (let j = i + 1; j < Math.min(eventLocations.length, 3); j++) {
        const origin = eventLocations[i];
        const destination = eventLocations[j];
        
        try {
          const travelInfo = await getActualTravelTime(origin, destination, travelMode);
          if (travelInfo) {
            travelData.push({
              from: origin,
              to: destination,
              duration: Math.round(travelInfo.duration / 60),
              distance: Math.round(travelInfo.distance / 1000 * 100) / 100,
              instructions: travelInfo.instructions.slice(0, 3)
            });
          }
        } catch (error) {
          console.log(`⚠️ Failed to get event travel time for ${origin} → ${destination}`);
        }
      }
    }


    // Create the prompt for OpenAI
    const varietyInstructions = varietyMode ? `

VARIETY MODE INSTRUCTIONS:
- This is generation #${generationCount} for this user
- Previously used events: ${usedEventIds?.join(', ') || 'None'}
- PRIORITIZE selecting different events from previous recommendations
- Create a UNIQUE experience that offers variety from past itineraries
- If you must reuse events, present them in a completely different context or time
- Focus on unexplored categories and hidden gems
- Avoid creating similar itinerary structures to previous generations
` : '';

    const prompt = `You are an expert Singapore event planner. Create a personalized itinerary based on the user's preferences and available events.${varietyInstructions}

REAL GOOGLE DIRECTIONS API TRAVEL DATA (${formData.transport.toUpperCase()} TRANSPORT):
${travelData.length > 0 ? travelData.map(travel => 
  `${travel.from} → ${travel.to}: ${travel.duration} minutes (${travel.distance} km)
  Route: ${travel.instructions.join(' → ')}`
).join('\n') : 'No Google Directions data available - use conservative estimates'}

Use this REAL travel data when planning routes between similar locations. For locations not in this data, use the conservative estimates provided in the guidelines.

LIVE SINGAPORE RESTAURANT DATA (GOOGLE PLACES API):
${liveRestaurantData.length > 0 ? liveRestaurantData.map(restaurant => 
  `${restaurant.area} - ${restaurant.meal_type.toUpperCase()}:
  Restaurant: ${restaurant.venue_name}
  Location: ${restaurant.location}
  Average Cost: $${restaurant.cost_per_person} per person
  Best for: ${restaurant.meal_type}
  Details: ${restaurant.suggestions}`
).join('\n\n') : 'Live restaurant data not available - use conservative Singapore pricing estimates'}

CRITICAL: Use this LIVE restaurant data from Google Places API for meal recommendations. These are real restaurants with current pricing organized by meal type. Match meal locations to the current event area AND meal type (breakfast/lunch/dinner). Use different restaurants for different meals - NEVER repeat the same restaurant name twice in one itinerary.

USER PREFERENCES:
- Date: ${formData.date}
- Start Time: ${formData.startTime}
- Duration: ${formData.duration} hours (ending at ${formData.endTime})
- Group Size: ${formData.pax} people
- Budget per Person: $${formData.budgetPerPax} (STRICT LIMIT - DO NOT EXCEED)
- Transportation: ${formData.transport}
- Prioritize Favorites: ${formData.prioritizeFavorites ? 'Yes' : 'No'}
- Interested Categories: ${formData.selectedCategories.map((id: number) => {
  const categories = [
    { id: 1, name: 'Arts & Culture' },
    { id: 2, name: 'Attractions' },
    { id: 3, name: 'Beauty & Personal Care' },
    { id: 4, name: 'Business & Networking' },
    { id: 5, name: 'Education' },
    { id: 6, name: 'Entertainment' },
    { id: 7, name: 'Family & Kids' },
    { id: 8, name: 'Festivals & Markets' },
    { id: 9, name: 'Food & Drinks' },
    { id: 10, name: 'Health & Wellness' },
    { id: 11, name: 'Music & Concerts' },
    { id: 12, name: 'Nature & Parks' },
    { id: 13, name: 'Nightlife & Bars' },
    { id: 14, name: 'Professional Services' },
    { id: 15, name: 'Religious & Spiritual' },
    { id: 16, name: 'Shopping & Retail' },
    { id: 17, name: 'Sports & Fitness' },
    { id: 18, name: 'Technology' },
    { id: 19, name: 'Transportation & Travel' },
    { id: 20, name: 'Others' }
  ];
  return categories.find(cat => cat.id === id)?.name;
}).filter(Boolean).join(', ')}

AVAILABLE EVENTS:
${events.map((event: Event, index: number) => `
${index + 1}. ${event.event_name}
   - Location: ${event.location_text}
   - Price: ${event.price_min ? `$${event.price_min}${event.price_max && event.price_max !== event.price_min ? ` - $${event.price_max}` : ''}` : 'Free'}
   - Duration: ${event.duration_min ? `${event.duration_min}${event.duration_max && event.duration_max !== event.duration_min ? ` - ${event.duration_max}` : ''} hours` : 'Flexible'}
   - Categories: ${event.categories_name || 'General'}
   - Description: ${event.description}
   - Visit Notes: ${event.visit_notes || 'No specific notes'}
   - Detailed Breakdown: ${event.detailed_breakdown || 'No detailed breakdown available'}
`).join('\n')}

PLANNING INSTRUCTIONS:
1. Create a logical, time-efficient itinerary that FULLY utilizes the ${formData.duration}-hour timeframe from ${formData.startTime} to ${formData.endTime}
2. Include detailed route planning between each event with REALISTIC Singapore travel times (simulate Google Maps accuracy)
3. Account for travel time when scheduling - if event ends at 12:00pm and travel takes 45 mins, next event starts at 12:45pm
4. CRITICAL: Use realistic Singapore travel times - cross-island MRT journeys are typically 30-90 minutes, not 15 minutes
5. Add meal breaks (breakfast/lunch/dinner) strategically placed near current or next event location
6. NEVER place meals in distant locations that require detours or long travel times
7. CRITICAL: Each person's total cost MUST NOT exceed $${formData.budgetPerPax} (activities + transport + meals)
8. If events are too expensive, select cheaper alternatives or reduce the number of events
9. Select events that match the user's interested categories
10. Include visit_notes and detailed_breakdown information from events in your recommendations
11. If budget remains after core activities, suggest optional add-ons (workshops, upgrades, etc.)
12. Consider the group size and suitability of activities
13. Provide realistic timeline with specific time slots accounting for all travel and meal times
14. CRITICAL: Ensure activities continue until the specified end time (${formData.endTime})
15. If main events end early, add bonus activities, extended experiences, or nearby attractions to fill remaining time
16. Never leave gaps - the itinerary should be active from start time to end time
17. COST CALCULATION REQUIREMENTS:
    - Add up ALL cost_per_person values from every itinerary item (events, travel, meals, bonus activities)
    - total_cost_per_person in summary = sum of all individual costs
    - total_cost_group = total_cost_per_person * group_size
    - budget_breakdown.subtotal = activities + transport + meals + bonus_activities
    - remaining_budget = user_budget - subtotal
18. VERIFICATION: Before finalizing, manually verify that all cost calculations are mathematically correct
19. DETAILED COST EXAMPLE:
    Itinerary: Event1($10) + Travel1($2) + Meal1($15) + Event2($60) + Travel2($2)
    total_cost_per_person = 10 + 2 + 15 + 60 + 2 = $89
    activities = 10 + 60 = $70
    transport = 2 + 2 = $4
    meals = 15 = $15
    bonus_activities = 0 = $0
    subtotal = 70 + 4 + 15 + 0 = $89 ✓ (matches total_cost_per_person)
    total_cost_group = 89 * group_size

OUTPUT FORMAT:
Return a JSON object with the following structure:

{
  "itinerary": [
    {
      "type": "event",
      "time": "12:00 - 14:00",
      "event_id": "gamers_guild_bugis",
      "event_name": "Gamer's Guild @ Bugis+",
      "location": "Bugis+ Shopping Mall",
      "duration": "2 hours",
      "cost_per_person": 10,
      "description": "Gaming experience with console and arcade games",
      "what_youll_do": [
        "Enjoy the first hour FREE (with complimentary membership)",
        "Extend for a second hour of console gaming or racing—S$10 per person (S$20 total)"
      ],
      "why_it_works": [
        "Tons of multiplayer games and private rooms for two",
        "Vibrant, air-conditioned space—perfect if it rains"
      ],
      "visit_notes": [
        "Arrive by 11:45 to grab good seats/stations",
        "Bring your own headset or use theirs",
        "Free lockers available for bags"
      ],
      "cost_breakdown": "S$10 per person for second hour (optional)"
    },
        {
      "type": "travel",
      "time": "14:00 - 14:35",
      "from": "Bugis+ Shopping Mall",
      "to": "Marina Bay Sands", 
      "duration": "35 minutes",
      "cost_per_person": 2,
      "route_details": [
        "Walk (8 min) to Bugis MRT (DT14/EW12)",
        "Wait for train (5 min) + Take Downtown Line (12 min) → Bayfront (DT16/CE1)",
        "Walk (10 min) to Marina Bay Sands",
        "Total realistic time: 35 minutes"
      ],
      "transport_mode": "public",
      "cost_breakdown": "~S$2 per person by EZ-Link / contactless"
    },
    {
      "type": "meal",
      "time": "12:30 - 13:30",
      "meal_type": "lunch",
      "duration": "1 hour",
      "cost_per_person": 15,
      "location": "Bugis Junction Food Court",
      "suggestions": "Convenient food court in same building as previous activity",
      "why_here": "Strategic location - no travel time needed, close to next destination"
    },
    {
      "type": "bonus_activity",
      "time": "16:30 - 17:00",
      "activity_name": "Explore Marina Bay Waterfront",
      "location": "Marina Bay Sands area",
      "duration": "30 minutes",
      "cost_per_person": 0,
      "description": "Free time to explore the waterfront promenade and take photos",
      "why_suggested": "Perfect use of remaining time in the same area"
    }
  ],
  "itinerary_summary": "A perfect 4-hour Singapore adventure for 2 people! Start with gaming at Bugis+, then travel to Marina Bay Sands for sightseeing. Includes lunch at a convenient food court and ends with a relaxing waterfront walk. Total cost: $89 per person with $11 remaining budget.",
  "budget_breakdown": {
    "activities": 70,
    "transport": 4,
    "meals": 15,
    "bonus_activities": 0,
    "subtotal": 89,
    "remaining_budget": 11,
    "optional_addons": [
      {
        "name": "Photography Workshop Add-on",
        "cost": 10,
        "description": "Enhance your experience with professional tips"
      }
    ]
  },
  "recommendations": {
    "what_to_bring": ["Comfortable shoes", "Water bottle", "Sunscreen"],
    "booking_requirements": "Any advance bookings needed",
    "weather_considerations": "Weather-related tips for the day",
    "accessibility_notes": "Accessibility information for venues"
  }
}

IMPORTANT GUIDELINES:
- Only include events that are actually available from the provided list
- For every event selected, MUST include the event_id field from the database for tracking purposes
- Generate EXTREMELY detailed "what_youll_do" arrays with specific activities, costs, and experiences
- Include "why_it_works" explanations tailored to the group size and occasion
- Provide comprehensive "visit_notes" with practical timing, booking, and preparation tips
- Be realistic about timing and logistics in Singapore
- MANDATORY: You MUST simulate checking Google Maps for EXACT travel times and routes between all locations
- For PUBLIC transport: Simulate Google Maps "Public Transport" mode results with realistic Singapore MRT/bus timing
- For PRIVATE transport: Simulate Google Maps "Driving" mode with realistic Singapore traffic conditions
- IMPORTANT: I will provide you with REAL Google Maps travel times and routes for each journey
- Use ONLY the Google Maps data provided - do not estimate or guess travel times
- When travel between locations, I will give you:
  * Exact duration in minutes from Google Routes API
  * Real distance in kilometers
  * Actual route instructions from Google Maps
- If Google Maps data is not available, use conservative estimates:
  * Short distance (same area): 20-30 minutes
  * Medium distance (cross-island): 45-60 minutes  
  * Long distance (opposite ends): 60-90 minutes
- Include the Google Maps route details in your travel sections
- Schedule events to start AFTER travel time ends (no overlaps)
- Ensure departure location matches the previous event's location exactly
- Ensure destination matches the next event's location exactly
- Include meal breaks at appropriate times (breakfast 8-10am, lunch 12-2pm, dinner 6-8pm)
- CRITICAL: Meal locations must be within 5-10 minutes walking distance of either the previous OR next event
- Never schedule meals in distant locations that require long travel times
- MANDATORY: Use the LIVE restaurant data from Google Places API when available
- For meal costs, use the exact costs from the live restaurant data provided
- Choose restaurants from the live data that match the current event area
- If no live data available for an area, use conservative Singapore pricing: Hawker centres $6-12, Food courts $8-15, Restaurants $12-25
- Include the exact restaurant names and locations from the live Google Places data
- Prioritize restaurants within walking distance of current or next event location
- MANDATORY: Use DIFFERENT restaurants for each meal - never repeat the same restaurant name
- If only one restaurant is available in an area, choose a different area or use fallback pricing
- Ensure meal variety: breakfast places (cafes, kopi tiams), lunch (food courts, casual), dinner (restaurants, bars)
- Use visit_notes and detailed_breakdown from event data to create comprehensive descriptions
- Suggest optional add-ons with specific costs and booking requirements
- Include specific cost breakdowns for all activities and options
- CRITICAL: Total cost per person MUST NOT exceed the user's budget of $${formData.budgetPerPax}
- Prioritize events that fit within budget, exclude expensive events if necessary
- Make the itinerary flow logically geographically to minimize travel time
- Consider the group's likely energy levels throughout the day
- Include specific public transport routes with station codes and walking directions
- Account for all walking time from transport stops to venues
- DO NOT include travel to "end destination" or "your destination" - end the itinerary at the last event
- If there's spare time (15-30 minutes) at the end, suggest nearby activities or attractions to explore
- Focus on making efficient use of time rather than unnecessary return journeys

MANDATORY COST VERIFICATION - MUST BE EXACT:
Step 1: List every itinerary item with its cost_per_person:
- Event 1: $X, Event 2: $Y, Travel 1: $Z, Travel 2: $A, Meal 1: $B, etc.
Step 2: Calculate total_cost_per_person = X + Y + Z + A + B + ...
Step 3: Calculate total_cost_group = total_cost_per_person × ${formData.pax}
Step 4: Break down by category:
- activities = sum of all event costs only
- transport = sum of all travel costs only  
- meals = sum of all meal costs only
- bonus_activities = sum of all bonus activity costs only
Step 5: Verify subtotal = activities + transport + meals + bonus_activities = total_cost_per_person
Step 6: Calculate remaining_budget = ${formData.budgetPerPax} - total_cost_per_person
Step 7: Create itinerary_summary that includes: duration, group size, key highlights, total cost per person, and remaining budget

CRITICAL: If subtotal ≠ total_cost_per_person, you MUST recheck and fix the error before responding.

Output ONLY valid JSON. Do not include any markdown formatting, code blocks, or explanatory text. Start directly with { and end with }.`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert Singapore event planner who creates detailed, practical itineraries. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: varietyMode ? 0.9 : 0.8, // Higher creativity for variety mode
      max_tokens: 3000, // Ensure we have enough tokens for detailed response
    });

    const aiResponse = completion.choices[0]?.message?.content;
    
    if (!aiResponse) {
      throw new Error('No response from OpenAI');
    }

    console.log(`✅ AI Planning completed`);
    console.log(`📊 Response length: ${aiResponse.length} characters`);

    // Try to parse the JSON response
    let parsedData;
    try {
      // Clean the response to ensure valid JSON
      let cleanedResponse = aiResponse.trim();
      
      // Remove markdown code blocks if present
      cleanedResponse = cleanedResponse.replace(/```json\s*/g, '');
      cleanedResponse = cleanedResponse.replace(/```\s*/g, '');
      
      // Find JSON boundaries
      const jsonStart = cleanedResponse.indexOf('{');
      const jsonEnd = cleanedResponse.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleanedResponse = cleanedResponse.substring(jsonStart, jsonEnd + 1);
      }
      
      console.log('🧹 Cleaned response preview:', cleanedResponse.substring(0, 200) + '...');
      
      parsedData = JSON.parse(cleanedResponse);
      console.log('🔍 Successfully parsed AI planning response');
    } catch (parseError: any) {
      console.error('❌ Failed to parse AI response as JSON:', parseError);
      console.log('Raw AI response:', aiResponse.substring(0, 1000) + '...');
      
      // Return a fallback response
      return NextResponse.json({
        success: false,
        error: 'Failed to parse AI response as JSON',
        fallback_plan: {
          itinerary: events.slice(0, Math.min(3, events.length)).map((event: Event, index: number) => ({
            time: `${String(parseInt(formData.startTime.split(':')[0]) + index * 2).padStart(2, '0')}:00 - ${String(parseInt(formData.startTime.split(':')[0]) + (index + 1) * 2).padStart(2, '0')}:00`,
            event_name: event.event_name,
            location: event.location_text,
            duration: `${event.duration_min || 2} hours`,
            cost_per_person: event.price_min || 0,
            description: event.description,
            tips: event.visit_notes || 'No specific tips available'
          })),
          itinerary_summary: `A ${formData.duration}-hour Singapore experience for ${formData.pax} people featuring ${Math.min(3, events.length)} activities. Total estimated cost: $${events.slice(0, 3).reduce((sum: number, event: Event) => sum + (event.price_min || 0), 0)} per person.`
        }
      });
    }

    // Validate that we have the expected structure
    if (!parsedData.itinerary || !parsedData.itinerary_summary) {
      console.warn('⚠️ AI response missing required structure, using fallback');
      return NextResponse.json({
        success: false,
        error: 'AI response missing required structure',
        parsed_data: parsedData
      });
    }

    // Return the complete planning data
    return NextResponse.json({
      success: true,
      plan: parsedData,
      metadata: {
        events_count: events.length,
        selected_events: parsedData.itinerary?.filter((item: any) => item.type === 'event')?.length || 0,
        total_budget: parsedData.budget_breakdown?.subtotal ? parsedData.budget_breakdown.subtotal * formData.pax : 0,
        generated_at: new Date().toISOString(),
        user_preferences: {
          date: formData.date,
          duration: formData.duration,
          group_size: formData.pax,
          budget_per_person: formData.budgetPerPax,
          transport: formData.transport
        }
      }
    });

  } catch (error: any) {
    console.error('❌ AI Planning error:', error);
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
        error: error.message || 'AI planning failed',
        type: error.type || 'unknown_error',
        code: error.code || 'unknown_code',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
