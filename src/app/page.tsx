// import MapClientWrapper from '../components/map/mapClientWrapper';
// import EventList from '../components/common/eventsList'

import { Metadata } from 'next';
import Link from 'next/link';

// Add cache-busting headers
export const metadata: Metadata = {
  title: 'EventScapeSG',
  description: 'Discover events happening around Singapore with our interactive map',
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
      <div className='mt-20 pt-10'>
        {/* Hero Section */}
        <div className="text-center mb-4">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to EventScape Singapore
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Your ultimate guide to discovering exciting events across Singapore. 
            Find concerts, festivals, exhibitions, and more - all in one place!
          </p>
          
          {/* CTA Button */}
          <div className="flex justify-center">
            <Link 
              href="/events"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3" />
              </svg>
              Explore Events
            </Link>
          </div>
        </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-8 mb-12 px-20 py-10">
          <div className="text-center p-6 bg-white rounded-lg shadow-md">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Interactive Map</h3>
            <p className="text-gray-600">
              Explore events on an interactive map with detailed markers and popups showing event information.
            </p>
          </div>

          <div className="text-center p-6 bg-white rounded-lg shadow-md">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Smart Filtering</h3>
            <p className="text-gray-600">
              Filter events by category, date, location, and search terms to find exactly what you're looking for.
            </p>
          </div>

          <div className="text-center p-6 bg-white rounded-lg shadow-md">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">AI-Powered</h3>
            <p className="text-gray-600">
              Get personalized event recommendations and discover new experiences tailored to your interests.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white">
        <div className="px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-8">
            {/* About Section */}
            <div>
              <h3 className="text-xl font-bold mb-4">EventScape Singapore</h3>
              <p className="text-gray-400 mb-4">
                Your ultimate guide to discovering exciting events across Singapore. 
                From concerts and festivals to exhibitions and workshops - find it all in one place.
              </p>
            </div>

            {/* Connect with me Section (moved from right column) */}
            <div>
              <h4 className="text-lg font-semibold mb-4">Connect with me</h4>
              <div className="space-y-3">
                <p className="text-gray-400">
                  Have questions or want to suggest an event? I'd love to hear from you!
                </p>
                <div className="flex space-x-4">
                  {/* GitHub */}
                  <a 
                    href="https://github.com/Meaetin" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white transition-colors transform hover:scale-110"
                    title="GitHub"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                  </a>

                  {/* LinkedIn */}
                  <a 
                    href="https://linkedin.com/in/martin-teo" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-blue-400 transition-colors transform hover:scale-110"
                    title="LinkedIn"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </a>

                </div>
              </div>
            </div>

            {/* Contact Section */}
            <div>
              <h4 className="text-lg font-semibold mb-4">Contact Me</h4>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <a 
                    href="mailto:martinteoyz@gmail.com" 
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    martinteoyz@gmail.com
                  </a>
                </div>
                <p className="text-sm text-gray-500">
                  For general enquiries, partnership opportunities, or technical support.
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-gray-800 pt-8 mt-8">
            <div className="max-w-7xl mx-auto">
              <p className="text-gray-400 text-sm text-center">
                © {new Date().getFullYear()} EventScape Singapore. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}