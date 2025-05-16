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
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error getting session in AuthContext:', error);
        setUser(null);
        setSession(null);
        return;
      }
      
      if (data.session) {
        // If we have a session client-side, use it
        console.log('Found session in AuthContext:', data.session.user.id);
        setUser(data.session.user);
        setSession(data.session);
      } else {
        console.log('No session found in AuthContext');
        setUser(null);
        setSession(null);
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
    console.log('AuthContext mounted, fetching initial session');
    refreshAuth();

    // Subscribe to auth changes with Supabase client
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log('Auth state changed:', event, newSession?.user?.id);
        
        // Only update if there's an actual change to avoid loops
        const sessionChanged = 
          (!!newSession !== !!session) || 
          (newSession?.user?.id !== session?.user?.id);
          
        if (sessionChanged) {
          console.log('Session changed, updating context');
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
      console.log('Unsubscribing from auth changes');
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount, not when session/user changes

  const signOut = async () => {
    setIsLoading(true);
    try {
      console.log('Signing out user');
      
      // Sign out with client-side Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Error signing out:', error);
      } else {
        console.log('Sign out successful');
      }
      
      // Clear state
      setUser(null);
      setSession(null);
      
    } catch (error) {
      console.error('Error in signOut function:', error);
      
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