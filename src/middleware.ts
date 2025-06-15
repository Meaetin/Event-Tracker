import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {  
  // Create a response object that we'll modify
  const res = NextResponse.next();
  
  // Only handle dashboard routes
  const isAuthRoute = req.nextUrl.pathname.startsWith('/dashboard');
  
  if (!isAuthRoute) {
    return res;
  }
  
  // Get cookies from the request
  const supabaseCookies = req.cookies.getAll();
  
  // If there are no cookies at all, redirect to login
  if (supabaseCookies.length === 0) {
    console.log('No cookies found, redirecting to login');
    return NextResponse.redirect(new URL('/login', req.url));
  }
  
  // Create a supabase client with updated API
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () =>
          req.cookies.getAll().map(({ name, value }) => ({ name, value })),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );
  
  try {
    // Check the session
    const { data: { session } } = await supabase.auth.getSession(); // Get the session
    
    if (session) { // If the session is valid
      const {data: {user}} = await supabase.auth.getUser(); // Get the user
      if (user) { // If the user is valid
        // Add user info to headers for server components
        res.headers.set('x-user-id', session.user.id);
        res.headers.set('x-auth-state', 'authenticated');

        return res;
      }
    } else {
      console.log('No valid session found, redirecting to login');
      return NextResponse.redirect(new URL('/login', req.url));
    }
  } catch (err) {
    console.error('Error in auth middleware:', err);
    // On error, continue but don't set auth headers
    return res;
  }
}