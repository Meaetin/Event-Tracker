'use client';

import { useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import EventSidebar from '@/components/Sidebar';
import { MapEvent, EventsMapRef } from '@/components/map/eventMap';

// Dynamically import the map to avoid SSR issues
const EventsMap = dynamic(() => import('@/components/map/eventMap'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="flex items-center space-x-2">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="text-gray-600">Loading map...</span>
      </div>
    </div>
  )
});

export default function MapPage() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const mapRef = useRef<EventsMapRef>(null);

  const handleEventSelect = (event: MapEvent) => {
    setSelectedEventId(event.id);
    // Focus the map on the selected event
    if (mapRef.current) {
      mapRef.current.focusOnEvent(event);
    }
    // Close sidebar on mobile after selection
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const handleCategoryChange = (categoryIds: string[]) => {
    setSelectedCategories(categoryIds);
  };

  return (
    <div className="h-[calc(100vh-3rem)] flex overflow-hidden relative">
      {/* Sidebar - Desktop */}
      <div className="hidden md:block w-80 lg:w-96 flex-shrink-0">
        <EventSidebar
          onEventSelect={handleEventSelect}
          selectedEventId={selectedEventId}
          onCategoryChange={handleCategoryChange}
          selectedCategories={selectedCategories}
        />
      </div>

      {/* Map - Full screen */}
      <div className="flex-1 relative">
        <EventsMap
          ref={mapRef}
          selectedEventId={selectedEventId}
          selectedCategories={selectedCategories}
        />
        
        {/* Mobile bottom handle to open sidebar */}
        <div className="md:hidden absolute bottom-0 left-0 right-0 z-[1000]">
                      <button
              onClick={() => {
                console.log('Opening sidebar');
                setIsSidebarOpen(true);
              }}
              className="w-full bg-white border-t border-gray-200 px-4 py-2.5 flex items-center justify-center space-x-2 shadow-lg hover:bg-gray-50 transition-colors"
            >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="text-gray-700 font-medium text-sm">View Events List</span>
          </button>
        </div>
      </div>

      {/* Sidebar - Mobile Bottom Sheet */}
      {isSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-[9999] flex flex-col justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-gray bg-opacity-20"
            onClick={() => setIsSidebarOpen(false)}
          />
          
          {/* Bottom Sheet */}
          <div className="relative bg-white rounded-t-2xl max-h-[75vh] animate-slide-up overflow-hidden">
            <EventSidebar
              onEventSelect={handleEventSelect}
              selectedEventId={selectedEventId}
              onCategoryChange={handleCategoryChange}
              selectedCategories={selectedCategories}
              isMobile={true}
              onClose={() => setIsSidebarOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
} 