"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase/supabaseClient';

export default function Navigation() {
  const { user: authUser, isLoading: authLoading, signOut } = useAuth();
  const [role, setRole] = useState<string | null>('user'); // Default to user role
  const [loading, setLoading] = useState(false); // Set to false to avoid loading state
  const pathname = usePathname();

  useEffect(() => {
    async function getUserRole() {
      if (!authUser) {
        setLoading(false);
        return;
      }
      
      try {
        // Get user role from profiles
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')  // Select all fields to ensure we get the profile
          .eq('id', authUser.id)
          .single();

        if (error) {
          console.error('Error fetching profile:', error);
          setRole('user'); // Default to user role on error
        } else if (profile) {
          setRole(profile.role || 'user'); // Default to user if role is null
        }
      } catch (error) {
        console.error('Error in getUserRole:', error);
        setRole('user'); // Default to user role on error
      } finally {
        setLoading(false);
      }
    }
    
    if (!authLoading) {
      getUserRole();
    }
  }, [authUser, authLoading]);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/auth/login';
  };

  const isActive = (path: string) => pathname === path;

  if (authLoading) {
    return <div className="h-16 bg-white shadow"></div>;
  }

  return (
    <nav className="bg-white shadow">
      <div className="container mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold text-blue-600">
                Event Map App
              </Link>
            </div>
            <div className="ml-6 flex items-center space-x-4">
              <Link 
                href="/" 
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  isActive('/') ? 'text-blue-700 bg-blue-50' : 'text-gray-700 hover:text-blue-600'
                }`}
              >
                Home
              </Link>
              
              <Link 
                href="/events" 
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  isActive('/events') ? 'text-blue-700 bg-blue-50' : 'text-gray-700 hover:text-blue-600'
                }`}
              >
                Events Map
              </Link>
              
              {authUser && (
                <>
                  {role === 'admin' ? (
                    <Link 
                      href="/dashboard/admin" 
                      className={`px-3 py-2 rounded-md text-sm font-medium ${
                        isActive('/dashboard/admin') ? 'text-blue-700 bg-blue-50' : 'text-gray-700 hover:text-blue-600'
                      }`}
                    >
                      Admin Dashboard
                    </Link>
                  ) : (
                    <Link 
                      href="/dashboard/user" 
                      className={`px-3 py-2 rounded-md text-sm font-medium ${
                        isActive('/dashboard/user') ? 'text-blue-700 bg-blue-50' : 'text-gray-700 hover:text-blue-600'
                      }`}
                    >
                      Dashboard
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center">
            {authUser ? (
              <button
                onClick={handleSignOut}
                className="ml-4 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Sign Out
              </button>
            ) : (
              <div className="space-x-2">
                <Link 
                  href="/auth/login" 
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    isActive('/auth/login') ? 'text-blue-700 bg-blue-50' : 'text-gray-700 hover:text-blue-600'
                  }`}
                >
                  Login
                </Link>
                <Link 
                  href="/auth/signup" 
                  className="px-3 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
} 