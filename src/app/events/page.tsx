'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import EventSidebar from '../components/common/EventSidebar';
import { MapEvent } from '../types/database';
import { EventsMapRef } from '../components/map/EventsMap';

// Dynamically import the map to avoid SSR issues
const EventsMap = dynamic(() => import('../components/map/EventsMap'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <p className="text-sm sm:text-base text-gray-600">Loading map...</p>
      </div>
    </div>
  )
});

export default function EventsPage() {
  const [selectedEvent, setSelectedEvent] = useState<MapEvent | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showPermanentStores, setShowPermanentStores] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const mapRef = useRef<EventsMapRef | null>(null);

  // Handle window resize and mobile detection
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Check on mount
    checkIsMobile();

    // Add resize listener
    window.addEventListener('resize', checkIsMobile);

    return () => {
      window.removeEventListener('resize', checkIsMobile);
    };
  }, []);

  // Close sidebar when switching from mobile to desktop
  useEffect(() => {
    if (!isMobile && isSidebarOpen) {
      setIsSidebarOpen(false);
    }
  }, [isMobile, isSidebarOpen]);

  const handleEventSelect = useCallback((event: MapEvent) => {
    setSelectedEvent(event);
    
    // If the event has coordinates, focus the map on it
    if (event.coordinates && mapRef.current) {
      mapRef.current.focusOnEvent(event);
    }

    // Close sidebar on mobile after selecting an event
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  }, [isMobile]);

  const handleCategoryChange = useCallback((categoryIds: string[]) => {
    setSelectedCategories(categoryIds);
    // Clear selected event when category changes to avoid confusion
    setSelectedEvent(null);
  }, []);

  const handlePermanentStoresChange = useCallback((show: boolean) => {
    setShowPermanentStores(show);
    // Clear selected event if it's a permanent store and we're hiding them
    if (!show && selectedEvent?.store_type === 'permanent_store') {
      setSelectedEvent(null);
    }
  }, [selectedEvent]);

  const handleMapRef = useCallback((ref: EventsMapRef) => {
    mapRef.current = ref;
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Sidebar Overlay - Only show on mobile when sidebar is open */}
        {isMobile && isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-gray-500/50 z-40 transition-opacity duration-300"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close sidebar"
          />
        )}

        {/* Sidebar - Slide up from bottom on mobile */}
        <div className={`
          ${isMobile ? 'fixed bottom-0 left-0 right-0' : 'relative'} z-50 ${!isMobile ? 'md:z-auto' : ''}
          ${isSidebarOpen || !isMobile ? 'translate-y-0' : isMobile ? 'translate-y-[calc(100%-4rem)]' : 'translate-y-full'}
          transition-transform duration-300 ease-in-out
          ${isMobile ? 'w-full h-3/4' : 'w-80 sm:w-96 md:w-80 lg:w-96 h-full'} ${!isMobile ? 'md:h-auto' : ''}
          ${isMobile ? 'rounded-t-lg' : ''}
        `}>
          {/* Mobile Peek Handle */}
          {isMobile && (
            <div 
              className="bg-white rounded-t-lg p-3 border-b border-gray-200 cursor-pointer"
              onClick={toggleSidebar}
            >
              <div className="flex items-center justify-center mb-2">
                <div className="w-8 h-1 bg-gray-300 rounded-full"></div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  View Events List
                </span>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isSidebarOpen ? "M19 9l-7 7-7-7" : "M5 15l7-7 7 7"} />
                </svg>
              </div>
            </div>
          )}

          <Suspense fallback={
            <div className="w-full h-full bg-white shadow-lg border-r border-gray-200 p-4">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-20 bg-gray-200 rounded"></div>
                  ))}
                </div>
              </div>
            </div>
          }>
            <EventSidebar 
              onEventSelect={handleEventSelect}
              selectedEventId={selectedEvent?.id || null}
              onCategoryChange={handleCategoryChange}
              selectedCategories={selectedCategories}
              showPermanentStores={showPermanentStores}
              onPermanentStoresChange={handlePermanentStoresChange}
              isMobile={isMobile}
              onClose={() => setIsSidebarOpen(false)}
            />
          </Suspense>
        </div>

        {/* Map */}
        <div className="flex-1 relative">


          <Suspense fallback={
            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm sm:text-base text-gray-600">Loading map...</p>
              </div>
            </div>
          }>
            <EventsMap 
              ref={handleMapRef}
              selectedEventId={selectedEvent?.id || null}
              selectedCategories={selectedCategories}
              showPermanentStores={showPermanentStores}
              center={selectedEvent?.coordinates ? 
                [selectedEvent.coordinates.latitude, selectedEvent.coordinates.longitude] : 
                undefined
              }
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
} 