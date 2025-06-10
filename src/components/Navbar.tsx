"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthProvider';
import { getUserRole } from '../lib/auth';

export default function Navbar() {
  const { user: authUser, isLoading: authLoading, signOut } = useAuth();
  const [role, setRole] = useState<string | null>('user');
  const [mounted, setMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Set the mounted flag to true when the component mounts
  useEffect(() => {
    setMounted(true); 
  }, []);

  // Get the user role from the profiles table
  useEffect(() => {
    if (!authLoading && mounted && authUser) {
      getUserRole(authUser, setRole);
    }
  }, [authUser, authLoading, mounted]);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/login';
  };

  // Check which page is user on
  const isActive = (path: string) => pathname === path;

  // Set mobile menu open to true or false
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Always render the nav structure to prevent hydration mismatch
  return (
    <nav className="bg-white shadow">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and hamburger button container */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Link href="/" className="text-xl font-bold text-blue-600">
                EventScapeSG
              </Link>
            </div>
            
            {/* Desktop navigation */}
            <div className="hidden md:ml-6 md:flex md:items-center md:space-x-4">
              <Link 
                href="/" 
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive('/') ? 'text-blue-700 bg-blue-50' : 'text-gray-700 hover:text-blue-600'
                }`}
              >
                Home
              </Link>
              
              <Link 
                href="/events" 
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive('/events') ? 'text-blue-700 bg-blue-50' : 'text-gray-700 hover:text-blue-600'
                }`}
              >
                Events Map
              </Link>
              
              {/* AI Event Planning - Coming Soon */}
              <span className="px-3 py-2 rounded-md text-sm font-medium text-gray-400 cursor-not-allowed relative group">
                AI Event Planning
                <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                  Coming Soon
                </span>
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  AI-powered itinerary planning
                </div>
              </span>
              
              {mounted && authUser && (
                <>
                  <Link 
                    href="/dashboard" 
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive('/dashboard') ? 'text-blue-700 bg-blue-50' : 'text-gray-700 hover:text-blue-600'
                    }`}
                  >
                    Dashboard
                  </Link> 
                </>
              )}
            </div>
          </div>
          
          {/* Desktop auth buttons */}
          <div className="hidden md:flex md:items-center">
            {mounted && authUser ? (
              <button
                onClick={handleSignOut}
                className="ml-4 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Sign Out
              </button>
            ) : mounted && (
              <div className="space-x-2">
                <Link 
                  href="/login" 
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/login') ? 'text-blue-700 bg-blue-50' : 'text-gray-700 hover:text-blue-600'
                  }`}
                >
                  Login
                </Link>
                <Link 
                  href="/signup" 
                  className="px-3 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={toggleMobileMenu}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-colors"
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              {/* Hamburger icon */}
              <svg 
                className={`${isMobileMenuOpen ? 'hidden' : 'block'} h-6 w-6`} 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              {/* Close icon */}
              <svg 
                className={`${isMobileMenuOpen ? 'block' : 'hidden'} h-6 w-6`} 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`${isMobileMenuOpen ? 'block' : 'hidden'} md:hidden`}>
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t border-gray-200">
            <Link 
              href="/" 
              className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                isActive('/') ? 'text-blue-700 bg-blue-50' : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
              }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Home
            </Link>
            
            <Link 
              href="/events" 
              className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                isActive('/events') ? 'text-blue-700 bg-blue-50' : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
              }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Events Map
            </Link>
            
            {/* AI Event Planning - Coming Soon (Mobile) */}
            <div className="px-3 py-2 rounded-md text-base font-medium text-gray-400">
              AI Event Planning
              <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                Coming Soon
              </span>
            </div>
            
            {mounted && authUser && (
              <>
                {role === 'admin' ? (
                  <Link 
                    href="/dashboard" 
                    className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                      isActive('/dashboard') ? 'text-blue-700 bg-blue-50' : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Admin Dashboard
                  </Link>
                ) : (
                  <Link 
                    href="/dashboard" 
                    className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                      isActive('/dashboard') ? 'text-blue-700 bg-blue-50' : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                )}
              </>
            )}

            {/* Mobile auth section */}
            <div className="border-t border-gray-200 pt-4">
              {mounted && authUser ? (
                <button
                  onClick={() => {
                    handleSignOut();
                    setIsMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Sign Out
                </button>
              ) : mounted && (
                <div className="space-y-1">
                  <Link 
                    href="/login" 
                    className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                      isActive('/login') ? 'text-blue-700 bg-blue-50' : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Login
                  </Link>
                  <Link 
                    href="/signup" 
                    className="block px-3 py-2 rounded-md text-base font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors mx-3"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
} 