'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { LatLngExpression } from 'leaflet';
import { Icon } from 'leaflet';
import { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { MapEvent, EventsApiResponse } from '../../types/database';

// Default position (Singapore)
const defaultPosition: LatLngExpression = [1.3521, 103.8198];

// Custom marker icon
const eventIcon = new Icon({
    iconSize: [30, 30],
    iconUrl: 'https://cdn-icons-png.flaticon.com/128/684/684908.png',
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
});

interface EventsMapProps {
  events?: MapEvent[];
  center?: LatLngExpression;
  zoom?: number;
  selectedEventId?: string | null;
  selectedCategories?: string[];
  showPermanentStores?: boolean;
}

export interface EventsMapRef {
  focusOnEvent: (event: MapEvent) => void;
}

const EventsMap = forwardRef<EventsMapRef, EventsMapProps>(({ 
  events: propEvents, 
  center = defaultPosition, 
  zoom = 11,
  selectedEventId,
  selectedCategories,
  showPermanentStores
}, ref) => {
  const [events, setEvents] = useState<MapEvent[]>(propEvents || []);
  const [loading, setLoading] = useState(!propEvents);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<{ [key: number]: string }>({});
  const mapRef = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({});

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    focusOnEvent: (event: MapEvent) => {
      if (event.coordinates && mapRef.current) {
        const map = mapRef.current;
        // Center the map on the event
        map.setView([event.coordinates.latitude, event.coordinates.longitude], 15);
        
        // Open the popup for this event
        const marker = markersRef.current[event.id];
        if (marker) {
          marker.openPopup();
        }
      }
    }
  }));

  // Fetch events if not provided as props
  useEffect(() => {
    if (!propEvents) {
      fetchEvents();
    }
  }, [propEvents]);

  // Fetch categories for lookup
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/events/categories');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const categoryMap: { [key: number]: string } = {};
          data.categories.forEach((cat: any) => {
            categoryMap[cat.id] = cat.name;
          });
          setCategories(categoryMap);
        }
      }
    } catch (error) {
      console.warn('Failed to fetch categories:', error);
    }
  };

  // Handle selected event changes
  useEffect(() => {
    if (selectedEventId) {
      const selectedEvent = events.find(event => event.id === selectedEventId);
      if (selectedEvent && selectedEvent.coordinates) {
        // Focus on the selected event
        if (mapRef.current) {
          const map = mapRef.current;
          map.setView([selectedEvent.coordinates.latitude, selectedEvent.coordinates.longitude], 15);
          
          // Open the popup for this event
          const marker = markersRef.current[selectedEventId];
          if (marker) {
            setTimeout(() => marker.openPopup(), 100);
          }
        }
      }
    }
  }, [selectedEventId, events]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/events?status=approved');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch events: ${response.status}`);
      }
      
      const data: EventsApiResponse = await response.json();
      
      if (!data.success) {
        throw new Error('Failed to fetch events');
      }
      
      setEvents(data.events);
    } catch (err: any) {
      console.error('Error fetching events:', err);
      setError(err.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (startDate: string | null, endDate: string | null) => {
    if (!startDate) return 'Date TBA';
    
    // Handle special text dates that shouldn't be parsed
    if (startDate.toLowerCase().includes('now open') || 
        startDate.toLowerCase().includes('tba') ||
        startDate.toLowerCase().includes('check website') ||
        startDate.toLowerCase().includes('ongoing') ||
        startDate.toLowerCase().includes('every')) {
      return startDate; // Return the text as-is
    }
    
    try {
      const start = new Date(startDate);
      
      // Check if the parsed date is valid
      if (isNaN(start.getTime())) {
        return startDate; // Return original string if parsing fails
      }
      
      const formattedStart = start.toLocaleDateString('en-SG', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      
      // If there's an end date and it's different from start date, show range
      if (endDate && endDate !== startDate) {
        // Handle special text for end dates too
        if (endDate.toLowerCase().includes('now open') || 
            endDate.toLowerCase().includes('tba') ||
            endDate.toLowerCase().includes('check website') ||
            endDate.toLowerCase().includes('ongoing') ||
            endDate.toLowerCase().includes('every')) {
          return `${formattedStart} - ${endDate}`;
        }
        
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return `${formattedStart} - ${endDate}`;
        }
        
        const formattedEnd = end.toLocaleDateString('en-SG', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        return `${formattedStart} - ${formattedEnd}`;
      }
      
      return formattedStart;
    } catch {
      return startDate; // Return original string if parsing fails
    }
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return null;
    return timeString; // Return the time string as-is since it's already formatted
  };

  const truncateText = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // Filter events that have valid coordinates and match selected category
  const validEvents = events.filter(event => {
    // First check if coordinates are valid
    const hasValidCoordinates = event.coordinates && 
      typeof event.coordinates.latitude === 'number' && 
      typeof event.coordinates.longitude === 'number' &&
      !isNaN(event.coordinates.latitude) && 
      !isNaN(event.coordinates.longitude);
    
    if (!hasValidCoordinates) {
      return false;
    }
    
    // Permanent stores filter
    if (showPermanentStores === false && event.store_type === 'permanent_store') {
      return false;
    }
    
    // Then check category filter
    if (selectedCategories && selectedCategories.length > 0) {
      return selectedCategories.includes(event.category_id?.toString() || '');
    }
    
    return true;
  });

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute top-4 left-4 z-[1000] bg-white px-3 py-2 rounded-lg shadow-md">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-600">Loading events...</span>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute top-4 left-4 z-[1000] bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded-lg shadow-md">
          <span className="text-sm">{error}</span>
        </div>
      )}

      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
        ref={mapRef}
      >
        <TileLayer 
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        {validEvents.map((event) => (
          <Marker 
            key={event.id}
            position={[event.coordinates!.latitude, event.coordinates!.longitude]} 
            icon={eventIcon}
            ref={(markerRef) => {
              if (markerRef) {
                markersRef.current[event.id] = markerRef;
              }
            }}
          >
            <Popup maxWidth={450} className="event-popup">
              <div className="p-1 max-w-lg">
                <div className="flex gap-2">
                  {/* Left: Event Image */}
                  {event.images && event.images.length > 0 && (
                    <div className="w-32 h-24 flex-shrink-0 overflow-hidden rounded">
                      <img 
                        src={event.images[0]} 
                        alt={event.name}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  
                  {/* Right: Text content */}
                  <div className="flex-1 min-w-0">
                    {/* Event Name */}
                    <h3 className="font-bold text-base text-gray-900 mb-1 leading-tight">
                      {event.name}
                    </h3>
                    
                    {/* Date */}
                    <div className="flex items-center mb-0.5 text-xs text-gray-600">
                      <svg className="w-3 h-3 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{formatDate(event.start_date, event.end_date)}</span>
                    </div>
                    
                    {/* Time - Show even if no time available */}
                    <div className="flex items-center mb-0.5 text-xs text-gray-600">
                      <svg className="w-3 h-3 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{formatTime(event.time) || 'Time TBA'}</span>
                    </div>
                    
                    {/* Location */}
                    <div className="flex items-start text-xs text-gray-600">
                      <svg className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="leading-tight">{event.location}</span>
                    </div>
                  </div>
                </div>
                
                {/* Description */}
                {event.description && (
                  <div className="mb-2">
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {event.description}
                    </p>
                  </div>
                )}
                
                {/* Bottom section with Categories and Event URL */}
                <div className="pt-1 border-t border-gray-200">
                  <div className="flex items-start justify-between gap-2">
                    {/* Categories - Updated to handle multiple categories */}
                    <div className="flex-1">
                      {/* Multiple categories support (priority) */}
                      {event.category_ids && event.category_ids.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {event.category_ids.slice(0, 3).map((categoryId: number, index: number) => {
                            const categoryName = categories[categoryId] || `Category ${categoryId}`;
                            
                            // Debug logging for development
                            if (process.env.NODE_ENV === 'development' && index === 0) {
                              console.log('Event categories debug:', {
                                eventName: event.name,
                                category_ids: event.category_ids,
                                categories: event.categories,
                                category_id: event.category_id,
                                categoriesLookup: categories
                              });
                            }
                            
                            return (
                              <span 
                                key={`category-${categoryId}-${index}`}
                                className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full"
                              >
                                {categoryName}
                              </span>
                            );
                          })}
                          {event.category_ids.length > 3 && (
                            <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                              +{event.category_ids.length - 3} more
                            </span>
                          )}
                        </div>
                      ) : event.categories ? (
                        /* Single category fallback */
                        <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                          {Array.isArray(event.categories) ? event.categories[0]?.name : event.categories.name}
                        </span>
                      ) : event.category_id && categories[event.category_id] ? (
                        /* Legacy category_id support */
                        <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                          {categories[event.category_id]}
                        </span>
                      ) : (
                        /* No categories available */
                        <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                          Uncategorized
                        </span>
                      )}
                    </div>
                    
                    {/* Event URL */}
                    <a 
                      href={event.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-blue-600 hover:text-blue-800 text-xs font-medium flex-shrink-0"
                    >
                      <span>View Details</span>
                      <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
      {/* Events counter */}
      {!loading && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-white px-3 py-2 rounded-lg shadow-md">
          <span className="text-sm text-gray-600">
            {validEvents.length} event{validEvents.length !== 1 ? 's' : ''} displayed
          </span>
        </div>
      )}
    </div>
  );
});

EventsMap.displayName = 'EventsMap';

export default EventsMap; 