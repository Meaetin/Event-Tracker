"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react';
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
  const mounted = useRef(true);
  const initialized = useRef(false);

  const refreshAuth = useCallback(async () => {
    if (!mounted.current) return;
    
    const now = Date.now();
    if (isRefreshing.current || now - lastRefreshTime.current < 2000) {
      return;
    }

    try {
      isRefreshing.current = true;
      
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw sessionError;
      }

      if (currentSession) {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (!userError && user && mounted.current) {
          setUser(user);
          setSession(currentSession);
        } else if (mounted.current) {
          setUser(null);
          setSession(null);
        }
      } else if (mounted.current) {
        setUser(null);
        setSession(null);
      }
      
      lastRefreshTime.current = now;
    } catch (error) {
      console.error('Error refreshing auth state:', error);
      if (mounted.current) {
        setUser(null);
        setSession(null);
      }
    } finally {
      isRefreshing.current = false;
      if (mounted.current) {
        setIsLoading(false);
      }
      initialized.current = true;
    }
  }, []);

  const handleAuthChange = useCallback(async (event: string, newSession: Session | null) => {
    if (!mounted.current || !initialized.current) return;

    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!error && user && mounted.current) {
          setUser(user);
          setSession(newSession);
          
          // Only redirect from login page, not from home page
          const path = window.location.pathname;
          if (path === '/auth/login') {
            router.push('/dashboard/admin');
          }
        }
      } catch (error) {
        console.error('Error in auth change handler:', error);
      }
    } else if (event === 'SIGNED_OUT' && mounted.current) {
      setUser(null);
      setSession(null);
      router.push('/auth/login');
    }
  }, [router]);

  useEffect(() => {
    mounted.current = true;
    
    const initializeAuth = async () => {
      if (!mounted.current) return;
      await refreshAuth();
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthChange);

    return () => {
      mounted.current = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [refreshAuth, handleAuthChange]);

  const signOut = useCallback(async () => {
    if (!mounted.current) return;
    
    try {
      await supabase.auth.signOut();
      if (mounted.current) {
        setUser(null);
        setSession(null);
      }
      router.push('/auth/login');
    } catch (error) {
      console.error('Error in signOut function:', error);
      if (mounted.current) {
        setUser(null);
        setSession(null);
      }
    }
  }, [router]);

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