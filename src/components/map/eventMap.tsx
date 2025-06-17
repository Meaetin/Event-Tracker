'use client';

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'react-leaflet-markercluster/styles';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import type { LatLngExpression } from 'leaflet';
import { Icon } from 'leaflet';
import * as L from 'leaflet';
import { Calendar, Clock, MapPin, DollarSign, ExternalLink, Navigation } from 'lucide-react';
import { useTheme } from 'next-themes';

export interface Category {
    id: number; 
    name: string;
    created_at: string;
}

export interface Event {
    id: string;
    event_id: string;
    event_name: string;
    start_date: string | null;
    end_date: string | null;
    location_text: string | null;
    description: string | null;
    price_min: number | null;
    price_max: number | null;
    price: string | null;
    duration_min: number | null;
    duration_max: number | null;
    visit_notes: string | null;
    detailed_breakdown: string | null;
    primary_lat: number | null;
    primary_lng: number | null;
    created_at: string;
    updated_at: string;
    opening_hours_structured: any | null;
    opening_hours: string | null;
    categories: number[] | null;
    page_url: string | null;
    image_url: string | null;
    date_text: string | null;
}

// Map-specific types
export interface Coordinates {
    latitude: number;
    longitude: number;
}

export interface MapEvent extends Event {
    coordinates: Coordinates | null;  // Parsed coordinates for map display from primary_lat/primary_lng
}

export interface EventsApiResponse {
    success: boolean;
    events: MapEvent[];
    total: number;
}

export interface CategoriesApiResponse {
    success: boolean;
    categories: Category[];
}

export interface Profile {
    id: string;
    role: 'admin' | 'user';
    created_at: string;
} 

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
}

export interface EventsMapRef {
  focusOnEvent: (event: MapEvent) => void;
}

const EventsMap = forwardRef<EventsMapRef, EventsMapProps>(({ 
  events: propEvents, 
  center = defaultPosition, 
  zoom = 11,
  selectedEventId,
  selectedCategories
}, ref) => {
  const [events, setEvents] = useState<MapEvent[]>(propEvents || []);
  const [loading, setLoading] = useState(!propEvents);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<{ [key: number]: string }>({});
  const [currentZoom, setCurrentZoom] = useState<number>(zoom);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const { theme, resolvedTheme } = useTheme();

  // Get tile URL based on theme
  const getTileUrl = () => {
    const isDark = resolvedTheme === 'dark';
    return isDark 
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
  };

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    focusOnEvent: (event: MapEvent) => {
      if (event.coordinates && mapRef.current) {
        const map = mapRef.current;
        map.setView([event.coordinates.latitude, event.coordinates.longitude], 15);
        
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

  // Track zoom level changes and handle map invalidation
  useEffect(() => {
    if (mapRef.current) {
      const map = mapRef.current;
      
      const handleZoomEnd = () => {
        if (mapRef.current) {
          setCurrentZoom(mapRef.current.getZoom());
          setTimeout(() => {
            if (mapRef.current && mapRef.current.getContainer()) {
              try {
                mapRef.current.invalidateSize();
              } catch (error) {
                console.warn('Map invalidateSize failed in zoomend:', error);
              }
            }
          }, 100);
        }
      };

      const handleMoveEnd = () => {
        setTimeout(() => {
          if (mapRef.current && mapRef.current.getContainer()) {
            try {
              mapRef.current.invalidateSize();
            } catch (error) {
              console.warn('Map invalidateSize failed in moveend:', error);
            }
          }
        }, 100);
      };
      
      map.on('zoomend', handleZoomEnd);
      map.on('moveend', handleMoveEnd);
      
      setTimeout(() => {
        if (mapRef.current && mapRef.current.getContainer()) {
          try {
            mapRef.current.invalidateSize();
          } catch (error) {
            console.warn('Map invalidateSize failed in initial timeout:', error);
          }
        }
      }, 300);
      
      return () => {
        map.off('zoomend', handleZoomEnd);
        map.off('moveend', handleMoveEnd);
      };
    }
  }, [mapRef.current]);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/events/categories');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const categoryMap: { [key: number]: string } = {};
          data.categories.forEach((cat: { id: number; name: string }) => {
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
        if (mapRef.current) {
          const map = mapRef.current;
          
          // Get map bounds and zoom
          const bounds = map.getBounds();
          const zoom = map.getZoom();
          
          // Calculate if we need to adjust the view
          const eventLat = selectedEvent.coordinates.latitude;
          const eventLng = selectedEvent.coordinates.longitude;
          
          // Check if event is near edges and adjust view accordingly
          const latDiff = bounds.getNorth() - bounds.getSouth();
          const lngDiff = bounds.getEast() - bounds.getWest();
          
          let newLat = eventLat;
          let newLng = eventLng;
          
          // Adjust position to ensure popup fits on screen
          if (eventLat > bounds.getNorth() - latDiff * 0.3) {
            newLat = eventLat - latDiff * 0.2;
          }
          if (eventLat < bounds.getSouth() + latDiff * 0.3) {
            newLat = eventLat + latDiff * 0.2;
          }
          if (eventLng > bounds.getEast() - lngDiff * 0.3) {
            newLng = eventLng - lngDiff * 0.2;
          }
          if (eventLng < bounds.getWest() + lngDiff * 0.3) {
            newLng = eventLng + lngDiff * 0.2;
          }
          
          // Set view with adjusted position
          map.setView([newLat, newLng], Math.max(zoom, 14));
          
          const marker = markersRef.current[selectedEventId];
          if (marker) {
            setTimeout(() => marker.openPopup(), 200);
          }
        }
      }
    }
  }, [selectedEventId, events]);

  // Handle container resize to fix tile loading issues
  useEffect(() => {
    if (mapRef.current) {
      const map = mapRef.current;
      const container = map.getContainer();
      
      const resizeObserver = new ResizeObserver(() => {
        setTimeout(() => {
          // Check if map is still mounted and valid before invalidating size
          if (mapRef.current && mapRef.current.getContainer()) {
            try {
              mapRef.current.invalidateSize();
            } catch (error) {
              console.warn('Map invalidateSize failed:', error);
            }
          }
        }, 100);
      });
      
      if (container) {
        resizeObserver.observe(container);
      }
      
      return () => {
        resizeObserver.disconnect();
      };
    }
  }, [mapRef.current]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/events');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch events: ${response.status}`);
      }
      
      const data: EventsApiResponse = await response.json();
      
      if (!data.success) {
        throw new Error('Failed to fetch events');
      }
      
      // Transform events to include coordinates
      const eventsWithCoordinates = data.events.map(event => ({
        ...event,
        coordinates: event.primary_lat && event.primary_lng ? {
          latitude: event.primary_lat,
          longitude: event.primary_lng
        } : null
      }));
      
      setEvents(eventsWithCoordinates);
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
      return startDate;
    }
    
    try {
      const start = new Date(startDate);
      
      if (isNaN(start.getTime())) {
        return startDate;
      }
      
      const formattedStart = start.toLocaleDateString('en-SG', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      
      if (endDate && endDate !== startDate) {
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
      return startDate;
    }
  };

  const formatPrice = (event: MapEvent) => {
    if (event.price) return event.price;
    if (event.price_min !== null && event.price_max !== null) {
      if (event.price_min === event.price_max) {
        return `$${event.price_min}`;
      }
      return `$${event.price_min} - $${event.price_max}`;
    }
    if (event.price_min !== null) return `From $${event.price_min}`;
    if (event.price_max !== null) return `Up to $${event.price_max}`;
    return 'Free';
  };

  // Function to generate Google Maps URL
  const getGoogleMapsUrl = (event: MapEvent) => {
    if (event.coordinates) {
      const { latitude, longitude } = event.coordinates;
      const query = encodeURIComponent(event.location_text || '');
      return `https://www.google.com/maps/search/?api=1&query=${query}&center=${latitude},${longitude}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location_text || '')}`;
  };

  // Custom cluster icon creation function
  const createClusterCustomIcon = (cluster: any) => {
    const count = cluster.getChildCount();
    let className = 'marker-cluster-small';
    
    if (count < 10) {
      className = 'marker-cluster-small';
    } else if (count < 100) {
      className = 'marker-cluster-medium';
    } else {
      className = 'marker-cluster-large';
    }

    return L.divIcon({
      html: `<div><span>${count}</span></div>`,
      className: `marker-cluster ${className}`,
      iconSize: L.point(40, 40, true),
    });
  };

  // Create marker with optional label for high zoom levels
  const createMarkerWithLabel = (event: MapEvent) => {
    if (currentZoom >= 15) {
      const eventName = event.event_name;
      
      return L.divIcon({
        html: `
          <div class="marker-with-label">
            <div class="marker-icon">
              <img src="https://cdn-icons-png.flaticon.com/128/684/684908.png" alt="Event" />
            </div>
            <div class="marker-label">${eventName}</div>
          </div>
        `,
        className: 'custom-marker-with-label',
        iconSize: [30, 60],
        iconAnchor: [15, 60],
        popupAnchor: [0, -60],
      });
    } else {
      return eventIcon;
    }
  };

  // Filter events that have valid coordinates and match selected category
  const validEvents = events.filter(event => {
    const hasValidCoordinates = event.coordinates && 
      typeof event.coordinates.latitude === 'number' && 
      typeof event.coordinates.longitude === 'number' &&
      !isNaN(event.coordinates.latitude) && 
      !isNaN(event.coordinates.longitude);
    
    if (!hasValidCoordinates) {
      return false;
    }
    
    // Category filter
    if (selectedCategories && selectedCategories.length > 0) {
      if (!event.categories || event.categories.length === 0) {
        return false;
      }
      return event.categories.some(catId => selectedCategories.includes(catId.toString()));
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
        style={{ height: '100%', width: '100%', minHeight: '400px' }}
        className="z-0"
        ref={mapRef}
        zoomControl={false}
        whenReady={() => {
          if (mapRef.current) {
            setTimeout(() => {
              mapRef.current?.invalidateSize();
            }, 100);
          }
        }}
      >
                <TileLayer
          key={resolvedTheme} // Force re-render when theme changes
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url={getTileUrl()}
          errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
          maxZoom={19}
          keepBuffer={2}
          updateWhenIdle={false}
          updateWhenZooming={true}
        />

        <MarkerClusterGroup
          iconCreateFunction={createClusterCustomIcon}
          maxClusterRadius={40}
          disableClusteringAtZoom={15}
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={true}
          zoomToBoundsOnClick={true}
          removeOutsideVisibleBounds={true}
          animate={true}
        >
          {validEvents.map((event) => (
            <Marker 
              key={`${event.id}-${currentZoom}`}
              position={[event.coordinates!.latitude, event.coordinates!.longitude]} 
              icon={createMarkerWithLabel(event)}
              ref={(markerRef) => {
                if (markerRef) {
                  markersRef.current[event.id] = markerRef;
                }
              }}
            >
              <Popup 
                maxWidth={600} 
                className="event-popup mobile-popup"
                autoPan={true}
                autoPanPadding={[20, 20]}
                offset={[0, -10]}
                closeButton={true}
                autoClose={false}
                keepInView={true}
              >
                <div className="p-4 max-w-none bg-background">
                  {/* Desktop Layout */}
                  <div className="hidden md:block space-y-3">
                    {/* First Section: Image + Basic Info (Side by Side) */}
                    <div className="flex gap-4">
                      {/* Event Image - Left Side */}
                      {event.image_url && (
                        <div className="w-32 h-24 flex-shrink-0 overflow-hidden rounded-lg">
                          <img 
                            src={event.image_url} 
                            alt={event.event_name}
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      
                      {/* Basic Info - Right Side */}
                      <div className="flex-1 space-y-1">
                        {/* Event Name */}
                        <h3 className="font-bold text-lg text-foreground leading-tight">
                          {event.event_name}
                        </h3>
                        
                        {/* Date */}
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4 mr-2 flex-shrink-0" />
                          <span>{formatDate(event.start_date, event.end_date)}</span>
                        </div>
                        
                        {/* Time */}
                        {event.opening_hours && (
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Clock className="w-4 h-4 mr-2 flex-shrink-0" />
                            <span>{event.opening_hours}</span>
                          </div>
                        )}
                        
                        {/* Location */}
                        <div className="flex items-start text-sm text-muted-foreground">
                          <MapPin className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                          <span>{event.location_text}</span>
                        </div>
                        
                        {/* Price - Enhanced for accessibility */}
                        <div className="flex items-center text-sm font-medium text-success">
                          <DollarSign className="w-4 h-4 mr-2 flex-shrink-0" />
                          <span>{formatPrice(event)}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Divider */}
                    <div className="border-t border-border"></div>
                    
                    {/* Second Section: Description (Full Width) */}
                    {event.description && (
                      <div>
                        <p className="text-sm text-foreground leading-relaxed">
                          {event.description}
                        </p>
                      </div>
                    )}
                    
                    {/* Third Section: Categories + Buttons */}
                    <div className="flex items-center justify-between gap-4">
                      {/* Categories - Left Side */}
                      <div className="flex-1">
                        {event.categories && event.categories.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {event.categories.slice(0, 3).map((categoryId: number, index: number) => {
                              const categoryName = categories[categoryId] || `Category ${categoryId}`;
                              
                              return (
                                <span 
                                  key={`category-${categoryId}-${index}`}
                                  className="inline-block bg-primary/10 text-primary text-xs px-2 py-1 rounded-full"
                                >
                                  {categoryName}
                                </span>
                              );
                            })}
                            {event.categories.length > 3 && (
                              <span className="inline-block bg-muted text-muted-foreground text-xs px-2 py-1 rounded-full">
                                +{event.categories.length - 3} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-block bg-muted text-muted-foreground text-xs px-2 py-1 rounded-full">
                            Uncategorized
                          </span>
                        )}
                      </div>
                      
                      {/* Buttons - Right Side */}
                      <div className="flex gap-2">
                        {/* View Details Link */}
                        {event.page_url && (
                          <a 
                            href={event.page_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            title="View Details"
                            className="inline-flex items-center justify-center bg-primary/10 hover:bg-primary/20 text-primary hover:text-primary/80 text-sm font-medium w-8 h-8 rounded-lg transition-colors border border-primary/20"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        
                        {/* Google Maps Link - Enhanced for accessibility */}
                        <a 
                          href={getGoogleMapsUrl(event)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          title="Open in Google Maps"
                          className="success-indicator inline-flex items-center justify-center text-sm font-medium w-8 h-8 rounded-lg transition-colors hover:bg-success/20"
                        >
                          <Navigation className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Mobile Layout - Vertical */}
                  <div className="md:hidden space-y-3">
                    {/* First Section: Image + Basic Info */}
                    <div className="space-y-3">
                      {/* Event Image - Full Width at Top */}
                      {event.image_url && (
                        <div className="w-full h-40 overflow-hidden rounded-lg">
                          <img 
                            src={event.image_url} 
                            alt={event.event_name}
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      
                      {/* Basic Info */}
                      <div className="space-y-2">
                        {/* Event Name */}
                        <h3 className="font-bold text-lg text-foreground leading-tight">
                          {event.event_name}
                        </h3>
                        
                        {/* Date */}
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4 mr-2 flex-shrink-0" />
                          <span>{formatDate(event.start_date, event.end_date)}</span>
                        </div>
                        
                        {/* Time */}
                        {event.opening_hours && (
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Clock className="w-4 h-4 mr-2 flex-shrink-0" />
                            <span>{event.opening_hours}</span>
                          </div>
                        )}
                        
                        {/* Location */}
                        <div className="flex items-start text-sm text-muted-foreground">
                          <MapPin className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                          <span>{event.location_text}</span>
                        </div>
                        
                        {/* Price - Enhanced for accessibility */}
                        <div className="flex items-center text-sm font-medium text-success">
                          <DollarSign className="w-4 h-4 mr-2 flex-shrink-0" />
                          <span>{formatPrice(event)}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Divider */}
                    <div className="border-t border-border"></div>
                    
                    {/* Second Section: Description */}
                    {event.description && (
                      <div>
                        <p className="text-sm text-foreground leading-relaxed">
                          {event.description}
                        </p>
                      </div>
                    )}
                    
                    {/* Third Section: Categories + Buttons */}
                    <div className="flex items-center justify-between gap-3">
                      {/* Categories */}
                      <div className="flex-1">
                        {event.categories && event.categories.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {event.categories.slice(0, 2).map((categoryId: number, index: number) => {
                              const categoryName = categories[categoryId] || `Category ${categoryId}`;
                              
                              return (
                                <span 
                                  key={`category-${categoryId}-${index}`}
                                  className="inline-block bg-primary/10 text-primary text-xs px-2 py-1 rounded-full"
                                >
                                  {categoryName}
                                </span>
                              );
                            })}
                            {event.categories.length > 2 && (
                              <span className="inline-block bg-muted text-muted-foreground text-xs px-2 py-1 rounded-full">
                                +{event.categories.length - 2} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-block bg-muted text-muted-foreground text-xs px-2 py-1 rounded-full">
                            Uncategorized
                          </span>
                        )}
                      </div>
                      
                      {/* Action Links */}
                      <div className="flex gap-2 items-center">
                        {/* View Details Link */}
                        {event.page_url && (
                          <a 
                            href={event.page_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            title="View Details"
                            className="inline-flex items-center justify-center bg-primary/10 hover:bg-primary/20 text-primary hover:text-primary/80 text-sm font-medium w-8 h-8 rounded-lg transition-colors border border-primary/20"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        
                        {/* Google Maps Link - Enhanced for accessibility */}
                        <a 
                          href={getGoogleMapsUrl(event)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          title="Open in Google Maps"
                          className="success-indicator inline-flex items-center justify-center text-sm font-medium w-8 h-8 rounded-lg transition-colors hover:bg-success/20"
                        >
                          <Navigation className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
      
      {/* Events counter */}
      {!loading && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-background border border-border px-3 py-2 rounded-lg shadow-md">
          <span className="text-sm text-muted-foreground">
            {validEvents.length} event{validEvents.length !== 1 ? 's' : ''} displayed
          </span>
        </div>
      )}
    </div>
  );
});

EventsMap.displayName = 'EventsMap';

export default EventsMap; 