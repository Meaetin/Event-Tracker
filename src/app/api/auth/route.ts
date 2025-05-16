import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Helper function to create Supabase client
const createSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
    }
  });
};

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseClient();
    
    // Create a new client with the cookie
    const cookieHeader = request.headers.get('cookie') || '';
    
    // Create new client with authorization
    const supabaseWithCookies = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
        global: {
          headers: {
            cookie: cookieHeader,
          },
        },
      }
    );
    
    // Use client with cookies
    const { data: { session } } = await supabaseWithCookies.auth.getSession();
    
    return NextResponse.json({ 
      user: session?.user || null,
      session: session || null,
    });
  } catch (error) {
    console.error('Error getting session:', error);
    return NextResponse.json({ user: null, session: null }, { status: 500 });
  }
}

// Handle sign-out
export async function POST(request: NextRequest) {
  const { action } = await request.json();
  
  if (action === 'signout') {
    try {
      // Get the cookie header from the request
      const cookieHeader = request.headers.get('cookie') || '';
      
      // Create new client with authorization
      const supabaseWithCookies = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
          },
          global: {
            headers: {
              cookie: cookieHeader,
            },
          },
        }
      );
      
      // Sign out the user
      const { error } = await supabaseWithCookies.auth.signOut();
      
      if (error) {
        console.error('Error signing out:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
            
      // Clear all auth cookies from response
      const response = NextResponse.json({ success: true });
      
      // Add cache control headers to prevent caching of auth state
      response.headers.set('Cache-Control', 'no-store, max-age=0');
      
      return response;
    } catch (error) {
      console.error('Error signing out:', error);
      return NextResponse.json({ error: 'Failed to sign out' }, { status: 500 });
    }
  }
  
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
} 