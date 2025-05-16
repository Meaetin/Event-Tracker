"use client";

import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';

export default function Header() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0">
            <Link href="/" className="font-bold text-xl">
              My App
            </Link>
          </div>
          
          <nav className="flex space-x-4">
            {isLoading ? (
              <div>Loading...</div>
            ) : user ? (
              <>
                <span className="py-2">
                  Hello, {user.user_metadata.full_name || user.email}
                </span>
                <Link
                  href="/auth/signout"
                  className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200"
                >
                  Sign Out
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200"
                >
                  Log In
                </Link>
                <Link
                  href="/auth/signup"
                  className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                >
                  Sign Up
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
} 