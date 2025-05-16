import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  console.log('Middleware running for path:', req.nextUrl.pathname);
  
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
    return NextResponse.redirect(new URL('/auth/login', req.url));
  }
  
  // Create a supabase client with updated API
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => {
          return req.cookies.getAll().map((cookie) => ({
            name: cookie.name,
            value: cookie.value,
          }));
        },
        setAll: (cookies) => {
          cookies.forEach((cookie) => {
            res.cookies.set(cookie.name, cookie.value, cookie.options);
          });
        },
      },
    }
  );
  
  try {
    // Check the session
    const { data } = await supabase.auth.getSession();
    
    if (!data.session) {
      console.log('No valid session found, redirecting to login');
      return NextResponse.redirect(new URL('/auth/login', req.url));
    }
    
    console.log('Session found for user:', data.session.user.id);
    
    // Admin route check
    const isAdminRoute = req.nextUrl.pathname.startsWith('/dashboard/admin');
    
    // Check admin access if needed
    if (isAdminRoute) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.session.user.id)
        .single();
      
      if (!profile || profile.role !== 'admin') {
        console.log('User is not an admin, redirecting');
        return NextResponse.redirect(new URL('/dashboard/user', req.url));
      }
    }
    
    // Add user info to headers for server components
    res.headers.set('x-user-id', data.session.user.id);
    res.headers.set('x-auth-state', 'authenticated');
    
    return res;
    
  } catch (err) {
    console.error('Error in auth middleware:', err);
    // On error, continue but don't set auth headers
    return res;
  }
}

export const config = {
  matcher: ['/dashboard/:path*'],
}; 