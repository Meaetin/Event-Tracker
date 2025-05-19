// import MapClientWrapper from '../components/map/mapClientWrapper';
// import EventList from '../components/common/eventsList'

import ProtectedContent from './components/ProtectedContent';
import { Suspense } from 'react';
import { Metadata } from 'next';

// Add cache-busting headers
export const metadata: Metadata = {
  title: 'My App',
  description: 'A simple app with Supabase authentication',
  // Add cache directives
  other: {
    'Cache-Control': 'no-store, max-age=0'
  }
};

// Make the page dynamic to ensure it's not statically generated
export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-6">Welcome to My App</h1>
        
        <Suspense key="protected-content" fallback={<div className="bg-white p-6 rounded-lg shadow-md animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>}>
          <ProtectedContent />
        </Suspense>
      </main>
    </>
  );
}