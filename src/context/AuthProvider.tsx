"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { getCurrentSession, signOutUser } from "../lib/auth";

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
  const mounted = useRef(true);
  const initialized = useRef(false);
  const isRefreshing = useRef(false);
  const lastRefreshTime = useRef(0);

  // Fetch latest session and user and update state
  const refreshAuth = useCallback(async () => {
    const now = Date.now();
    // If the user is refreshing, or the last refresh was less than 2 seconds ago, return
    if (isRefreshing.current || now - lastRefreshTime.current < 2000) return; 

    try {
      isRefreshing.current = true; // Set the refreshing flag to true
      const { session, user } = await getCurrentSession(); // Get the current session

      if (mounted.current) { // If the user is mounted, set the session and user
        setSession(session);
        setUser(user);
        setIsLoading(false);
      }
      lastRefreshTime.current = now; // Set the last refresh time to the current time
    } catch (err) {
      console.error("Error during refreshAuth:", err);
      if (mounted.current) { // If the user is mounted, set the user and session to null when there is an error
        setUser(null);
        setSession(null);
        setIsLoading(false);
      }
    } finally {
      isRefreshing.current = false; // Set the refreshing flag to false
    }
  }, []); 

  // Handle state changes like sign in, sign out, token refreshed
  const handleAuthChange = useCallback( 
    async (event: string, newSession: Session | null) => {
      if (!mounted.current || !initialized.current) return; // If the user is not mounted or not initialized, return

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") { // If the user is signed in or token refreshed, set the user and session
        try {
          const user = newSession?.user ?? null; 
          if (user && mounted.current) { // If the user is mounted, set the user and session
            setUser(user);
            setSession(newSession);

            if (window.location.pathname === "/login") { // If the user is on the login page, redirect to the dashboard
              router.push("/dashboard");
            }
          }
        } catch (err) {
          console.error("Auth change handler error:", err);
        }
      } else if (event === "SIGNED_OUT" && mounted.current) {
        setUser(null);
        setSession(null);
        router.push("/login");
      }
    },
    [router] // When the router changes, this function is called
  );

  useEffect(() => {
    mounted.current = true; // Set the mounted flag to true

    const initializeAuth = async () => {
      if (!mounted.current) return; // If the user is not mounted, return
      initialized.current = true;
      await refreshAuth();
    };

    initializeAuth(); // Initialize the auth

    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthChange); // Subscribe to the auth state change

    return () => {
      mounted.current = false; // Set the mounted flag to false
      // subscription?.unsubscribe(); // Unsubscribe from the auth state change
    };
  }, [refreshAuth, handleAuthChange]); // When the auth state changes, this function is called

  const signOut = useCallback(async () => {
    if (!mounted.current) return; // If the user is not mounted, return
    try {
      await signOutUser(); // Sign out the user
      if (mounted.current) { // If the user is mounted, set the user and session to null
        setUser(null);
        setSession(null);
        router.push("/login");
      }
    } catch (err) {
      console.error("Error signing out:", err);
    }
  }, [router]);

  const value = {
    user,
    session,
    isLoading,
    signOut,
    refreshAuth,
  };

  if (isLoading) { // If the user is loading, return a loading message
    return <div className="p-6 text-center">Loading...</div>;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) { // If the user is not in the auth context, throw an error
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
