import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../lib/supabase/supabaseClient';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get filter parameters
    const category = searchParams.get('category');
    const status = searchParams.get('status') || 'approved';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    // Build query
    let query = supabase
      .from('events')
      .select(`
        id,
        name,
        url,
        start_date,
        end_date,
        time,
        location,
        coordinates,
        description,
        category_id,
        category_ids,
        store_type,
        status,
        images,
        created_at,
        updated_at,
        categories (
          id,
          name
        )
      `)
      .eq('status', status)
      .not('coordinates', 'is', null); // Only events with coordinates
    
    // Apply filters
    if (category) {
      query = query.eq('category_id', category);
    }
    
    if (startDate) {
      query = query.gte('start_date', startDate);
    }
    
    if (endDate) {
      query = query.lte('end_date', endDate);
    }
    
    // Order by start date
    query = query.order('start_date', { ascending: true });
    
    const { data: events, error } = await query;
    
    if (error) {
      console.error('Error fetching events:', error);
      return NextResponse.json(
        { error: 'Failed to fetch events' },
        { status: 500 }
      );
    }
    
    // Parse coordinates from PostgreSQL point format "(longitude,latitude)" to object
    const eventsWithParsedCoordinates = events?.map(event => {
      let parsedCoordinates = null;
      
      if (event.coordinates) {
        try {
          // Remove parentheses and split by comma
          const coordString = event.coordinates.replace(/[()]/g, '');
          const [longitude, latitude] = coordString.split(',').map((coord: string) => parseFloat(coord.trim()));
          
          if (!isNaN(longitude) && !isNaN(latitude)) {
            parsedCoordinates = {
              latitude,
              longitude
            };
          }
        } catch (error) {
          console.warn(`Failed to parse coordinates for event ${event.id}:`, event.coordinates);
        }
      }
      
      return {
        ...event,
        coordinates: parsedCoordinates
      };
    }) || [];
    
    return NextResponse.json({
      success: true,
      events: eventsWithParsedCoordinates,
      total: eventsWithParsedCoordinates.length
    });
    
  } catch (error: any) {
    console.error('Events API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
} 