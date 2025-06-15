import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookies) => {
            cookies.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const limit = searchParams.get('limit');
    
    // Build query
    let query = supabase
      .from('events')
      .select('*')
      .order('updated_at', { ascending: false });
    
    // Apply filters if provided
    if (status) {
      query = query.eq('status', status);
    }
    
    if (category) {
      query = query.contains('categories', [parseInt(category)]);
    }
    
    if (limit) {
      query = query.limit(parseInt(limit));
    }
    
    const { data: events, error } = await query;
    
    if (error) {
      console.error('Error fetching events:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    
    // Transform events to include coordinates for map display
    const eventsWithCoordinates = (events || []).map((event: any) => ({
      ...event,
      coordinates: event.primary_lat && event.primary_lng ? {
        latitude: event.primary_lat,
        longitude: event.primary_lng
      } : null
    }));
    
    return NextResponse.json({
      success: true,
      events: eventsWithCoordinates,
      total: eventsWithCoordinates.length
    });
    
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 