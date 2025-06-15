'use client';

import { useState, useEffect } from 'react';
import { MapEvent, EventsApiResponse, Category, CategoriesApiResponse } from '@/components/map/eventMap';

interface EventSidebarProps {
  onEventSelect?: (event: MapEvent) => void;
  selectedEventId?: string | null;
  onCategoryChange?: (categoryIds: string[]) => void;
  selectedCategories?: string[];
  isMobile?: boolean;
  onClose?: () => void;
}

export default function EventSidebar({ 
  onEventSelect, 
  selectedEventId, 
  onCategoryChange, 
  selectedCategories: propSelectedCategories,
  isMobile = false,
  onClose
}: EventSidebarProps) {
  const [events, setEvents] = useState<MapEvent[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [selectedCategories, setSelectedCategories] = useState<string[]>(propSelectedCategories || []);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  // Sync selectedCategories with prop
  useEffect(() => {
    if (propSelectedCategories !== undefined) {
      setSelectedCategories(propSelectedCategories);
    }
  }, [propSelectedCategories]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch events and categories in parallel
      const [eventsResponse, categoriesResponse] = await Promise.all([
        fetch('/api/events'),
        fetch('/api/events/categories')
      ]);

      if (!eventsResponse.ok || !categoriesResponse.ok) {
        throw new Error('Failed to fetch data');
      }

      const eventsData: EventsApiResponse = await eventsResponse.json();
      const categoriesData: CategoriesApiResponse = await categoriesResponse.json();

      if (!eventsData.success || !categoriesData.success) {
        throw new Error('Failed to fetch data');
      }

      // Transform events to include coordinates
      const eventsWithCoordinates = eventsData.events.map(event => ({
        ...event,
        coordinates: event.primary_lat && event.primary_lng ? {
          latitude: event.primary_lat,
          longitude: event.primary_lng
        } : null
      }));

      setEvents(eventsWithCoordinates);
      setCategories(categoriesData.categories);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to load data');
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
        startDate.toLowerCase().includes('always available') ||
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

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const filteredEvents = events.filter(event => {
    // Category filter
    if (selectedCategories.length > 0) {
      if (!event.categories || event.categories.length === 0) {
        return false;
      }
      const hasMatchingCategory = event.categories.some(catId => 
        selectedCategories.includes(catId.toString())
      );
      if (!hasMatchingCategory) {
        return false;
      }
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = event.event_name.toLowerCase().includes(query);
      const matchesLocation = event.location_text?.toLowerCase().includes(query);
      const matchesDescription = event.description?.toLowerCase().includes(query);
      
      if (!matchesName && !matchesLocation && !matchesDescription) {
        return false;
      }
    }

    return true;
  });

  // Sort filtered events by date (earliest first)
  const sortedEvents = [...filteredEvents].sort((a, b) => {
    if (!a.start_date && !b.start_date) return 0;
    if (!a.start_date) return 1;
    if (!b.start_date) return -1;
    
    return a.start_date.localeCompare(b.start_date);
  });

  const handleEventClick = (event: MapEvent) => {
    if (onEventSelect) {
      onEventSelect(event);
    }
  };

  const handleCategoryToggle = (categoryId: string) => {
    const updatedCategories = selectedCategories.includes(categoryId)
      ? selectedCategories.filter(id => id !== categoryId)
      : [...selectedCategories, categoryId];
    
    setSelectedCategories(updatedCategories);
    if (onCategoryChange) {
      onCategoryChange(updatedCategories);
    }
  };

  if (loading) {
    return (
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
    );
  }

  if (error) {
    return (
      <div className="w-full h-full bg-white shadow-lg border-r border-gray-200 p-4">
        <div className="text-red-600 text-sm">
          <p className="font-medium">Error loading events</p>
          <p>{error}</p>
          <button 
            onClick={fetchData}
            className="mt-2 text-blue-600 hover:text-blue-800 underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-white shadow-lg border-r border-gray-200 overflow-y-auto">
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-gray-200">
        {/* Mobile Header with Close Button */}
        {isMobile && onClose && (
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Events</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              aria-label="Close sidebar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        
        {/* Search */}
        <div className="mb-3">
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Filters */}
        <div className="space-y-3">
          {/* Category Filter */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-700">Categories</div>
              <button
                onClick={() => {
                  setSelectedCategories([]);
                  if (onCategoryChange) {
                    onCategoryChange([]);
                  }
                }}
                disabled={selectedCategories.length === 0}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  selectedCategories.length === 0
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
                title="Reset category filters"
              >
                Reset
              </button>
            </div>
            <div className="max-h-32 sm:max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2 space-y-1">
              {categories.map(category => (
                <label key={category.id} className="flex items-center cursor-pointer hover:bg-gray-50 p-1 rounded">
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(category.id.toString())}
                    onChange={() => handleCategoryToggle(category.id.toString())}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">{category.name}</span>
                </label>
              ))}
            </div>
            {selectedCategories.length > 0 && (
              <div className="mt-2 text-xs text-gray-600">
                {selectedCategories.length} filter{selectedCategories.length !== 1 ? 's' : ''} applied
              </div>
            )}
          </div>
        </div>

        {/* Results count */}
        <div className="mt-3 text-sm text-gray-600">
          {sortedEvents.length} event{sortedEvents.length !== 1 ? 's' : ''} found
        </div>
      </div>

      {/* Events List */}
      <div className="p-2">
        {sortedEvents.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <p>No events found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedEvents.map((event) => (
              <div
                key={event.id}
                onClick={() => handleEventClick(event)}
                className={`p-3 sm:p-4 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] ${
                  selectedEventId === event.id
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Event Image */}
                {event.image_url && (
                  <div className="mb-3 sm:mb-4 overflow-hidden rounded-lg">
                    <img 
                      src={event.image_url} 
                      alt={event.event_name}
                      className="w-full h-32 sm:h-40 object-cover hover:scale-105 transition-transform duration-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {/* Event Name */}
                <h3 className="font-semibold text-gray-900 mb-2 leading-tight text-sm sm:text-base">
                  {event.event_name}
                </h3>

                {/* Date */}
                <div className="flex items-center mb-2 text-xs sm:text-sm text-gray-600">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="leading-tight">{formatDate(event.start_date, event.end_date)}</span>
                </div>

                {/* Opening Hours */}
                {event.opening_hours && (
                  <div className="flex items-center mb-2 text-xs sm:text-sm text-gray-600">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="leading-tight">{event.opening_hours}</span>
                  </div>
                )}

                {/* Location */}
                {event.location_text && (
                  <div className="flex items-start mb-3 text-xs sm:text-sm text-gray-600">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="leading-tight">{truncateText(event.location_text, isMobile ? 40 : 60)}</span>
                  </div>
                )}

                {/* Price */}
                <div className="flex items-center mb-3 text-xs sm:text-sm text-gray-600">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                  <span className="leading-tight font-semibold text-green-700">{formatPrice(event)}</span>
                </div>

                {/* Description */}
                {event.description && (
                  <p className="text-xs sm:text-sm text-gray-700 mb-3 leading-relaxed">
                    {truncateText(event.description, isMobile ? 80 : 120)}
                  </p>
                )}

                {/* Bottom row with Category and Coordinates indicator */}
                <div className="flex justify-between items-center">
                  {/* Category */}
                  {event.categories && event.categories.length > 0 && (
                    <span className="inline-block bg-blue-100 text-blue-800 text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-full font-medium">
                      {categories.find(cat => cat.id === event.categories![0])?.name || 'Category'}
                    </span>
                  )}
                  
                  {/* Coordinates indicator */}
                  {event.coordinates && (
                    <div className="flex items-center text-green-600" title="Click to view on map">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                      </svg>
                      <span className="text-xs sm:text-sm font-medium">View on map</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 