import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Get the current user's profile
export async function GET(request: NextRequest) {
  try {
    // Get the cookie header from the request
    const cookieHeader = request.headers.get('cookie') || '';
    
    // Create client with authorization cookies
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
        },
        global: {
          headers: {
            cookie: cookieHeader,
          },
        },
      }
    );
    
    // Get the current session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    // Get the user's profile from the profiles table
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    
    if (error) {
      console.error('Error fetching profile:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ profile });
  } catch (error: any) {
    console.error('Error in profile API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Update the current user's profile
export async function PUT(request: NextRequest) {
  try {
    // Get the cookie header from the request
    const cookieHeader = request.headers.get('cookie') || '';
    
    // Create client with authorization cookies
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
        },
        global: {
          headers: {
            cookie: cookieHeader,
          },
        },
      }
    );
    
    // Get the current session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    // Get the profile data from the request
    const profileData = await request.json();
    
    // Update the profile in the database
    const { data: updatedProfile, error } = await supabase
      .from('profiles')
      .update({
        full_name: profileData.full_name,
        // Add any other fields you want to update
      })
      .eq('id', session.user.id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating profile:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ profile: updatedProfile });
  } catch (error: any) {
    console.error('Error in profile update:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 