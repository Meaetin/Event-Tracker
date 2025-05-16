import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
  // Get the token from the cookies
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  
  // Create a Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      detectSessionInUrl: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        cookie: req.headers.get('cookie') || '',
      },
    },
  });
  
  // Check if the user is authenticated
  const { data: { session } } = await supabase.auth.getSession();
  
  // Add auth state to request headers for server components
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-auth-state', session ? 'authenticated' : 'unauthenticated');
  
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

// Add paths that should trigger this middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     * - auth routes (for unauthenticated access)
     */
    '/((?!_next/static|_next/image|favicon.ico|public|auth).*)',
  ],
}; 