"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase/supabaseClient';

export default function SignOut() {
  const [isSigningOut, setIsSigningOut] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);
  const router = useRouter();

  useEffect(() => {
    const performSignOut = async () => {
      try {
        // First sign out with client-side Supabase
        await supabase.auth.signOut();
        
        // Then call our API route to clear server-side session
        const response = await fetch('/api/auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'signout' }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to sign out');
        }
        
        // Set countdown but remain in signing out state
        setIsSigningOut(false);
        
        // Start countdown timer - don't redirect yet
      } catch (error: any) {
        console.error('Error signing out:', error);
        setError(error.message || 'Failed to sign out');
        setIsSigningOut(false);
      }
    };

    performSignOut();
  }, []);
  
  // Separate effect for countdown
  useEffect(() => {
    // Only start countdown when sign out is complete
    if (isSigningOut || error) return;
    
    // Set up countdown timer
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      
      return () => clearTimeout(timer);
    } else {
      // Redirect after countdown finishes
      router.push('/auth/login');
      window.location.href = '/auth/login';
    }
  }, [countdown, isSigningOut, error, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md text-center">
        {isSigningOut ? (
          <>
            <h1 className="text-2xl font-bold mb-4">Signing Out...</h1>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          </>
        ) : error ? (
          <>
            <h1 className="text-2xl font-bold mb-4">Sign Out Failed</h1>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Return Home
            </button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-4">Signed Out Successfully</h1>
            <p className="mb-4">You have been signed out of your account.</p>
            <p className="mb-4">Redirecting to login page in <span className="font-bold">{countdown}</span> seconds...</p>
            <button
              onClick={() => {
                router.push('/auth/login');
                window.location.href = '/auth/login';
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Log In Now
            </button>
          </>
        )}
      </div>
    </div>
  );
} 