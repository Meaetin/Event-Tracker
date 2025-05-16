"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/supabaseClient';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';

export default function UserDashboard() {
  const { user: authUser, signOut, isLoading: authLoading } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Don't redirect immediately if still loading auth state
    if (authLoading) {
      return;
    }

    async function loadUserData() {
      if (!authUser) {
        // Only redirect if we're certain there's no auth user after loading completes
        console.log("No authenticated user, redirecting to login");
        router.push('/auth/login');
        return;
      }

      try {
        console.log("Loading profile for user:", authUser.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();

        setUserProfile(profile);
      } catch (err) {
        console.error("Error loading profile:", err);
      } finally {
        setLoading(false);
        // Add a small delay before showing content to prevent flashing
        setTimeout(() => {
          setIsReady(true);
        }, 600);
      }
    }

    loadUserData();
  }, [authUser, authLoading, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/auth/login');
  };

  // Only show loading state if we're not ready yet
  if (!isReady) {
    return (
      <div className="flex flex-col justify-center items-center h-screen">
        <style jsx>{`
          @keyframes loading {
            0% { width: 10% }
            50% { width: 50% }
            100% { width: 100% }
          }
          .loading-bar {
            animation: loading 0.75s ease-in-out infinite;
          }
        `}</style>
        <div className="w-64 bg-gray-200 rounded-full h-2.5 mb-4 overflow-hidden">
          <div className="bg-blue-600 h-2.5 rounded-full loading-bar"></div>
        </div>
        <p className="text-gray-600">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">User Dashboard</h1>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Sign Out
          </button>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Welcome, {userProfile?.full_name || authUser?.email}</h2>
          <p className="text-gray-600">Email: {userProfile?.email || authUser?.email}</p>
        </div>

        <div className="border-t pt-4">
          <h3 className="text-lg font-semibold mb-2">Your Account</h3>
          <div className="bg-gray-50 p-4 rounded">
            <p className="mb-2"><span className="font-medium">Role:</span> {userProfile?.role || 'User'}</p>
            <p className="mb-2"><span className="font-medium">Member since:</span> {userProfile?.created_at ? new Date(userProfile.created_at).toLocaleDateString() : 'N/A'}</p>
            <p className="mb-2"><span className="font-medium">User ID:</span> {authUser?.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
} 