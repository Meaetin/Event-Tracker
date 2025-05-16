"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { supabase } from '../lib/supabase/supabaseClient';
import { Session, User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const isRefreshing = useRef(false);
  const lastRefreshTime = useRef(0);

  // Function to fetch session from the server route
  const refreshAuth = async () => {
    // Prevent multiple refreshes within a short time period
    const now = Date.now();
    if (isRefreshing.current || now - lastRefreshTime.current < 2000) {
      return;
    }

    try {
      isRefreshing.current = true;
      setIsLoading(true);
      
      // First check client-side session with explicit typing
      const { data } = await supabase.auth.getSession();
      
      if (data.session) {
        // If we have a session client-side, use it
        setUser(data.session.user);
        setSession(data.session);
      } else {
        // Only check server if client doesn't have session
        try {
          const response = await fetch('/api/auth', {
            cache: 'no-store',
            headers: {
              'x-timestamp': Date.now().toString()
            }
          });
          
          const serverData = await response.json();
          
          // Be safe when accessing potentially unknown shape
          const serverSession = serverData?.session ?? null;
          const serverUser = serverData?.user ?? null;
          
          if (serverSession) {
            setUser(serverUser);
            setSession(serverSession);
          } else {
            setUser(null);
            setSession(null);
          }
        } catch (error) {
          console.error('Error fetching server auth state:', error);
          
          // Clear state on error - client already said we have no session
          setUser(null);
          setSession(null);
        }
      }
      
      lastRefreshTime.current = Date.now();
    } catch (error) {
      console.error('Error refreshing auth state:', error);
      setUser(null);
      setSession(null);
    } finally {
      setIsLoading(false);
      isRefreshing.current = false;
    }
  };

  useEffect(() => {
    // Fetch initial session only once on mount
    refreshAuth();

    // Subscribe to auth changes with Supabase client
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log('Auth state changed:', event);
        
        // Only update if there's an actual change to avoid loops
        const sessionChanged = 
          (!!newSession !== !!session) || 
          (newSession?.user?.id !== session?.user?.id);
          
        if (sessionChanged) {
          setSession(newSession);
          setUser(newSession?.user ?? null);
          // Use setTimeout to avoid immediate refresh that could cause loops
          setTimeout(() => {
            router.refresh();
          }, 100);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount, not when session/user changes

  const signOut = async () => {
    setIsLoading(true);
    try {
      // First sign out with client-side Supabase
      await supabase.auth.signOut();
      
      // Then call our API route to clear server-side session
      await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'signout' }),
      });
      
      // Clear state
      setUser(null);
      setSession(null);
      
      // We'll handle actual navigation in the sign-out page
    } catch (error) {
      console.error('Error signing out:', error);
      
      // Even if there's an error, clear the local state
      setUser(null);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    user,
    session,
    isLoading,
    signOut,
    refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 