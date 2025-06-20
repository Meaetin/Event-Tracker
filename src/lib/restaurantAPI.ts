// Restaurant API Integration for Real-Time Pricing
// This demonstrates how to fetch live restaurant data and pricing

interface RestaurantAPIResponse {
  restaurants: Array<{
    id: string;
    name: string;
    location: string;
    vicinity?: string; // Google Places vicinity field
    latitude: number;
    longitude: number;
    cuisine_type: string;
    price_level: 1 | 2 | 3 | 4; // 1 = $, 2 = $$, 3 = $$$, 4 = $$$$
    average_cost_per_person: number;
    rating: number;
    opening_hours: string;
    distance_meters: number;
  }>;
}

// Convert price level to Singapore dollar ranges
function convertPriceLevelToSGD(priceLevel: 1 | 2 | 3 | 4): { min: number; max: number; average: number } {
  switch (priceLevel) {
    case 1: return { min: 3, max: 12, average: 7 };   // Budget (Hawker centres, kopi tiams)
    case 2: return { min: 10, max: 25, average: 17 }; // Mid-range (Food courts, casual dining)
    case 3: return { min: 20, max: 50, average: 35 }; // Higher-end (Restaurant dining)
    case 4: return { min: 45, max: 100, average: 70 }; // Fine dining
  }
}

// Example function to fetch restaurants from Google Places API
export async function fetchNearbyRestaurants(
  latitude: number,
  longitude: number,
  radius: number = 1000, // meters
  mealType: 'breakfast' | 'lunch' | 'dinner' = 'lunch'
): Promise<RestaurantAPIResponse | null> {
  try {
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      console.warn('Google Places API key not configured');
      return null;
    }

    // Adjust search based on meal type with more specific keywords
    let keyword = '';
    let typeFilter = 'restaurant';
    
    switch (mealType) {
      case 'breakfast':
        keyword = 'breakfast OR coffee OR kopi tiam OR cafe';
        typeFilter = 'cafe|restaurant';
        break;
      case 'lunch':
        keyword = 'lunch OR food court OR hawker centre OR dim sum';
        typeFilter = 'restaurant|meal_takeaway';
        break;
      case 'dinner':
        keyword = 'dinner OR fine dining OR bar OR pub';
        typeFilter = 'restaurant|bar';
        break;
    }

    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
      `location=${latitude},${longitude}&` +
      `radius=${radius}&` +
      `type=${typeFilter}&` +
      `keyword=${encodeURIComponent(keyword)}&` +
      `key=${process.env.GOOGLE_PLACES_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('Google Places API error:', data.status);
      return null;
    }

    // Transform Google Places response to our format
    const restaurants = data.results.map((place: any) => {
      const priceLevel = place.price_level || 2; // Default to mid-range if not specified
      const pricing = convertPriceLevelToSGD(priceLevel);
      
      return {
        id: place.place_id,
        name: place.name,
        location: place.vicinity || place.formatted_address || 'Singapore',
        vicinity: place.vicinity,
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
        cuisine_type: place.types.includes('meal_takeaway') ? 'Fast Food' : 'Restaurant',
        price_level: priceLevel,
        average_cost_per_person: pricing.average,
        rating: place.rating || 4.0,
        opening_hours: place.opening_hours?.open_now ? 'Open now' : 'Check hours',
        distance_meters: calculateDistance(
          latitude, longitude,
          place.geometry.location.lat, place.geometry.location.lng
        )
      };
    }).sort((a: any, b: any) => a.distance_meters - b.distance_meters); // Sort by distance

    return { restaurants };

  } catch (error) {
    console.error('Error fetching restaurant data:', error);
    return null;
  }
}

// Fallback pricing when API is not available
function getFallbackPricing(mealType: 'breakfast' | 'lunch' | 'dinner', budgetPerPerson: number) {
  let basePricing = { min: 8, max: 20, average: 12 };
  let venueType = 'Food Court';
  
  switch (mealType) {
    case 'breakfast':
      basePricing = { min: 4, max: 12, average: 7 };
      venueType = 'Coffee Shop';
      break;
    case 'lunch':
      basePricing = { min: 6, max: 18, average: 12 };
      venueType = 'Food Court';
      break;
    case 'dinner':
      basePricing = { min: 10, max: 25, average: 16 };
      venueType = 'Restaurant';
      break;
  }
  
  return {
    venue_name: `Local ${venueType}`,
    location: `Nearby ${venueType.toLowerCase()}`,
    cost_per_person: Math.min(basePricing.average, budgetPerPerson),
    suggestions: `Local ${venueType.toLowerCase()} with typical Singapore prices $${basePricing.min}-${basePricing.max}`
  };
}

// Helper function to calculate distance between two coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

// Function to get restaurant recommendations with real pricing
export async function getRestaurantRecommendations(
  currentLocation: string,
  mealType: 'breakfast' | 'lunch' | 'dinner',
  budgetPerPerson: number,
  coordinates?: { lat: number; lng: number },
  excludeRestaurants?: string[] // Add list of restaurants to exclude
): Promise<{
  venue_name: string;
  location: string;
  cost_per_person: number;
  suggestions: string;
  source: 'api' | 'database';
}> {
  
  // If coordinates are provided, try to fetch real-time data
  if (coordinates) {
    const restaurantData = await fetchNearbyRestaurants(
      coordinates.lat, 
      coordinates.lng, 
      1000, 
      mealType
    );

    if (restaurantData && restaurantData.restaurants.length > 0) {
      // Find restaurants within budget and not in exclude list
      let affordableRestaurants = restaurantData.restaurants.filter(
        r => r.average_cost_per_person <= budgetPerPerson
      );

      // Filter out excluded restaurants
      if (excludeRestaurants && excludeRestaurants.length > 0) {
        affordableRestaurants = affordableRestaurants.filter(
          r => !excludeRestaurants.some(excluded => 
            r.name.toLowerCase().includes(excluded.toLowerCase()) ||
            excluded.toLowerCase().includes(r.name.toLowerCase())
          )
        );
      }

      if (affordableRestaurants.length > 0) {
        // Add some randomization to avoid always picking the first result
        const randomIndex = Math.floor(Math.random() * Math.min(3, affordableRestaurants.length));
        const bestOption = affordableRestaurants[randomIndex];
        
        return {
          venue_name: bestOption.name,
          location: `${bestOption.location} (${bestOption.vicinity || bestOption.location})`,
          cost_per_person: Math.min(bestOption.average_cost_per_person, budgetPerPerson),
          suggestions: `${bestOption.cuisine_type} with ${bestOption.rating}/5 rating, ${Math.round(bestOption.distance_meters)}m away`,
          source: 'api'
        };
      }
    }
  }

  // Fallback to conservative estimates if API fails or no coordinates
  const fallbackPricing = getFallbackPricing(mealType, budgetPerPerson);
  const fallbackData = {
    venue_name: fallbackPricing.venue_name,
    location: `${fallbackPricing.location} (Near ${currentLocation})`,
    cost_per_person: fallbackPricing.cost_per_person,
    suggestions: fallbackPricing.suggestions
  };
  
  return {
    venue_name: fallbackData.venue_name,
    location: fallbackData.location,
    cost_per_person: fallbackData.cost_per_person,
    suggestions: fallbackData.suggestions,
    source: 'database'
  };
}

// Example usage in AI planner:
/*
const mealRecommendation = await getRestaurantRecommendations(
  'Marina Bay Sands',
  'lunch',
  20,
  { lat: 1.2834, lng: 103.8607 }
);

console.log(`Recommended: ${mealRecommendation.venue_name} at ${mealRecommendation.location}`);
console.log(`Cost: $${mealRecommendation.cost_per_person} per person`);
console.log(`Details: ${mealRecommendation.suggestions}`);
*/ 