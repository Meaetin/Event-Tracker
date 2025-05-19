"use client";

import { useAuth } from '../context/AuthContext';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase/supabaseClient';
import Link from 'next/link';

export default function ProtectedContent() {
  const { user, isLoading } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const isMounted = useRef(true);
  const profileFetched = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    async function loadProfile() {
      if (!user || profileFetched.current) {
        if (isMounted.current) {
          setIsLoadingProfile(false);
        }
        return;
      }

      try {
        profileFetched.current = true;
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (isMounted.current) {
          setUserProfile(profile);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        if (isMounted.current) {
          setIsLoadingProfile(false);
        }
      }
    }

    if (!isLoading) {
      loadProfile();
    }
  }, [user, isLoading]);

  if (isLoading || isLoadingProfile) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6">Welcome to My App</h2>
        <p className="mb-8 text-gray-600">
          Please sign in to access your personalized dashboard and features.
        </p>
        <div className="flex space-x-4">
          <Link 
            href="/auth/login"
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Sign In
          </Link>
          <Link 
            href="/auth/signup"
            className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Create Account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold">Welcome back, {user.user_metadata.full_name || user.email}!</h2>
          <p className="text-gray-600 mt-2">Access your dashboard to manage your content and settings.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Link
          href={userProfile?.role === 'admin' ? '/dashboard/admin' : '/dashboard/user'}
          className="p-6 border rounded-lg hover:border-blue-500 transition-colors group"
        >
          <h3 className="text-xl font-semibold group-hover:text-blue-600">Go to Dashboard →</h3>
          <p className="text-gray-600 mt-2">
            {userProfile?.role === 'admin' 
              ? 'Manage users, content, and system settings'
              : 'View your personalized dashboard and settings'}
          </p>
        </Link>

        <div className="p-6 border rounded-lg bg-gray-50">
          <h3 className="text-xl font-semibold">Profile Overview</h3>
          <div className="mt-4 space-y-2 text-gray-600">
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Role:</strong> {userProfile?.role || 'user'}</p>
            <p><strong>Last Login:</strong> {new Date(user.last_sign_in_at || '').toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
} 