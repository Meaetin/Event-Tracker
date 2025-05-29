'use client';

import { useState, useRef, useCallback } from 'react';
import { Suspense } from 'react';
import { Metadata } from 'next';
import dynamic from 'next/dynamic';
import EventSidebar from '../components/common/EventSidebar';
import { MapEvent } from '../types/database';

// Dynamically import the map to avoid SSR issues
const EventsMap = dynamic(() => import('../components/map/EventsMap'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <p className="text-gray-600">Loading map...</p>
      </div>
    </div>
  )
});

export default function EventsPage() {
  const [selectedEvent, setSelectedEvent] = useState<MapEvent | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const mapRef = useRef<any>(null);

  const handleEventSelect = useCallback((event: MapEvent) => {
    setSelectedEvent(event);
    
    // If the event has coordinates, focus the map on it
    if (event.coordinates && mapRef.current) {
      mapRef.current.focusOnEvent(event);
    }
  }, []);

  const handleCategoryChange = useCallback((categoryId: string) => {
    setSelectedCategory(categoryId);
    // Clear selected event when category changes to avoid confusion
    setSelectedEvent(null);
  }, []);

  const handleMapRef = useCallback((ref: any) => {
    mapRef.current = ref;
  }, []);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Events Map</h1>
            <p className="text-gray-600 mt-1">Discover events happening around Singapore</p>
          </div>
          
          {selectedEvent && (
            <div className="text-right">
              <p className="text-sm text-gray-600">Selected Event:</p>
              <p className="font-medium text-gray-900 max-w-xs truncate">{selectedEvent.name}</p>
              {selectedEvent.coordinates && (
                <p className="text-xs text-green-600">📍 Location available</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Suspense fallback={
          <div className="w-80 bg-white shadow-lg border-r border-gray-200 p-4">
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
            selectedCategory={selectedCategory}
          />
        </Suspense>

        {/* Map */}
        <div className="flex-1 relative">
          <Suspense fallback={
            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-600">Loading map...</p>
              </div>
            </div>
          }>
            <EventsMap 
              ref={handleMapRef}
              selectedEventId={selectedEvent?.id || null}
              selectedCategory={selectedCategory}
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