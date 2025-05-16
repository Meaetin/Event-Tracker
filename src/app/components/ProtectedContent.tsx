"use client";

import { useAuth } from '../context/AuthContext';
import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase/supabaseClient';

export default function ProtectedContent() {
  const { user, isLoading } = useAuth();
  const [checkedServerSession, setCheckedServerSession] = useState(false);
  const isCheckingSession = useRef(false);
  const lastCheckTime = useRef(0);

  // Add extra check to handle direct navigation to the page
  useEffect(() => {
    // Only run this once and only if we're not already loading
    if (checkedServerSession || isLoading || isCheckingSession.current) return;

    const checkSession = async () => {
      // Prevent multiple checks in a short time period
      const now = Date.now();
      if (now - lastCheckTime.current < 3000) {
        setCheckedServerSession(true);
        return;
      }

      try {
        isCheckingSession.current = true;
        lastCheckTime.current = now;
        
        // Check client-side session first - just check if it exists, don't use the data
        // to avoid unnecessary re-renders
        const { data } = await supabase.auth.getSession();
        
        // Only force a refresh if there's a definite mismatch between what the
        // client has and what the context thinks we have
        const definiteAuthMismatch = 
          (data.session && !user) || 
          (!data.session && user);
          
        if (definiteAuthMismatch) {
          console.log('Session state mismatch, refreshing...');
          // Only do a hard refresh if we absolutely need to
          window.location.reload();
        }
        
        setCheckedServerSession(true);
      } catch (error) {
        console.error('Error checking session:', error);
        setCheckedServerSession(true);
      } finally {
        isCheckingSession.current = false;
      }
    };

    checkSession();
  }, [user, isLoading, checkedServerSession]);

  if (isLoading || !checkedServerSession) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">Protected Content</h2>
        <p className="mb-4">
          You need to be logged in to view this content.
        </p>
        <div className="flex space-x-4">
          <Link 
            href="/auth/login" 
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Log In
          </Link>
          <Link 
            href="/auth/signup" 
            className="px-4 py-2 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Sign Up
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Welcome, {user.user_metadata.full_name || user.email}!</h2>
      <p className="mb-4">
        This is protected content that only authenticated users can see.
      </p>
      <div className="bg-gray-50 p-4 rounded-md">
        <h3 className="font-medium mb-2">Your Profile Information:</h3>
        <ul className="list-disc pl-5">
          <li><strong>User ID:</strong> {user.id}</li>
          <li><strong>Email:</strong> {user.email}</li>
          <li><strong>Full Name:</strong> {user.user_metadata.full_name || 'Not provided'}</li>
          <li><strong>Last Sign In:</strong> {new Date(user.last_sign_in_at || '').toLocaleString()}</li>
        </ul>
      </div>
    </div>
  );
} 