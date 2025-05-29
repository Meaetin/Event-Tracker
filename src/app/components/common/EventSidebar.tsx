'use client';

import { useState, useEffect } from 'react';
import { MapEvent, EventsApiResponse, Category, CategoriesApiResponse } from '../../types/database';

interface EventSidebarProps {
  onEventSelect?: (event: MapEvent) => void;
  selectedEventId?: string | null;
}

export default function EventSidebar({ onEventSelect, selectedEventId }: EventSidebarProps) {
  const [events, setEvents] = useState<MapEvent[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch events and categories in parallel
      const [eventsResponse, categoriesResponse] = await Promise.all([
        fetch('/api/events?status=approved'),
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

      setEvents(eventsData.events);
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
    
    try {
      const start = new Date(startDate);
      const formattedStart = start.toLocaleDateString('en-SG', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
      
      // If there's an end date and it's different from start date, show range
      if (endDate && endDate !== startDate) {
        const end = new Date(endDate);
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

  const formatTime = (timeString: string | null) => {
    if (!timeString) return null;
    return timeString; // Return the time string as-is since it's already formatted
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const getDateFilterRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (dateFilter) {
      case 'today':
        return {
          start: today,
          end: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        };
      case 'week':
        return {
          start: today,
          end: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
        };
      case 'month':
        return {
          start: today,
          end: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
        };
      default:
        return null;
    }
  };

  const filteredEvents = events.filter(event => {
    // Category filter
    if (selectedCategory && event.category_id?.toString() !== selectedCategory) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = event.name.toLowerCase().includes(query);
      const matchesLocation = event.location.toLowerCase().includes(query);
      const matchesDescription = event.description?.toLowerCase().includes(query);
      
      if (!matchesName && !matchesLocation && !matchesDescription) {
        return false;
      }
    }

    // Date filter
    if (dateFilter !== 'all' && event.start_date) {
      const range = getDateFilterRange();
      if (range) {
        const eventDate = new Date(event.start_date);
        if (eventDate < range.start || eventDate > range.end) {
          return false;
        }
      }
    }

    return true;
  });

  const handleEventClick = (event: MapEvent) => {
    if (onEventSelect) {
      onEventSelect(event);
    }
  };

  if (loading) {
    return (
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
    );
  }

  if (error) {
    return (
      <div className="w-80 bg-white shadow-lg border-r border-gray-200 p-4">
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
    <div className="w-80 bg-white shadow-lg border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Events</h2>
        
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
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.id.toString()}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>
        </div>

        {/* Results count */}
        <div className="mt-3 text-sm text-gray-600">
          {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} found
        </div>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <p>No events found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="space-y-2 p-2">
            {filteredEvents.map((event) => (
              <div
                key={event.id}
                onClick={() => handleEventClick(event)}
                className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] ${
                  selectedEventId === event.id
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Event Image */}
                {event.images && event.images.length > 0 && (
                  <div className="mb-3 overflow-hidden rounded-lg">
                    <img 
                      src={event.images[0]} 
                      alt={event.name}
                      className="w-full h-32 object-cover hover:scale-105 transition-transform duration-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {/* Event Name */}
                <h3 className="font-medium text-gray-900 mb-1 leading-tight">
                  {event.name}
                </h3>

                {/* Date */}
                <div className="flex items-center mb-1 text-xs text-gray-600">
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{formatDate(event.start_date, event.end_date)}</span>
                </div>

                {/* Time */}
                {formatTime(event.time) && (
                  <div className="flex items-center mb-1 text-xs text-gray-600">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{formatTime(event.time)}</span>
                  </div>
                )}

                {/* Location */}
                <div className="flex items-start mb-2 text-xs text-gray-600">
                  <svg className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="leading-tight">{truncateText(event.location, 50)}</span>
                </div>

                {/* Description */}
                {event.description && (
                  <p className="text-xs text-gray-700 mb-2 leading-relaxed">
                    {truncateText(event.description, 80)}
                  </p>
                )}

                {/* Bottom row with Category and Coordinates indicator */}
                <div className="flex justify-between items-center">
                  {/* Category */}
                  {event.categories && (
                    <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                      {event.categories.name}
                    </span>
                  )}
                  
                  {/* Coordinates indicator */}
                  {event.coordinates && (
                    <div className="flex items-center text-green-600" title="Click to view on map">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                      </svg>
                      <span className="text-xs">View on map</span>
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