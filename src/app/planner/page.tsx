'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabaseClient';
import { CalendarIcon, Clock, Users, MapPin, DollarSign, Heart, Bus, Car } from 'lucide-react';

// Categories from zinformation.md
const CATEGORIES = [
  { id: 1, name: 'Arts & Culture' },
  { id: 2, name: 'Attractions' },
  { id: 3, name: 'Beauty & Personal Care' },
  { id: 4, name: 'Business & Networking' },
  { id: 5, name: 'Education' },
  { id: 6, name: 'Entertainment' },
  { id: 7, name: 'Family & Kids' },
  { id: 8, name: 'Festivals & Markets' },
  { id: 9, name: 'Food & Drinks' },
  { id: 10, name: 'Health & Wellness' },
  { id: 11, name: 'Music & Concerts' },
  { id: 12, name: 'Nature & Parks' },
  { id: 13, name: 'Nightlife & Bars' },
  { id: 14, name: 'Professional Services' },
  { id: 15, name: 'Religious & Spiritual' },
  { id: 16, name: 'Shopping & Retail' },
  { id: 17, name: 'Sports & Fitness' },
  { id: 18, name: 'Technology' },
  { id: 19, name: 'Transportation & Travel' },
  { id: 20, name: 'Others' }
];

interface PlannerFormData {
  date: string;
  startTime: string;
  duration: number;
  endTime: string;
  pax: number;
  selectedCategories: number[];
  budgetPerPax: number;
  prioritizeFavorites: boolean;
  transport: 'public' | 'private';
}

interface Event {
  id: string;
  event_name: string;
  start_date: string;
  end_date: string;
  location_text: string;
  description: string;
  price_min: number;
  price_max: number;
  categories_name: string;
  image_url: string;
  opening_hours?: string;
  opening_hours_structured?: any[];
}

export default function PlannerPage() {
  const [formData, setFormData] = useState<PlannerFormData>({
    date: '',
    startTime: '09:00',
    duration: 4,
    endTime: '13:00',
    pax: 2,
    selectedCategories: [],
    budgetPerPax: 100,
    prioritizeFavorites: false,
    transport: 'public'
  });

  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [plannerResults, setPlannerResults] = useState<string>('');
  const [aiPlan, setAiPlan] = useState<any>(null);
  const [allCategoriesSelected, setAllCategoriesSelected] = useState(false);
  const [usedEvents, setUsedEvents] = useState<Set<string>>(new Set());
  const [generationCount, setGenerationCount] = useState(0);

  // Update end time when start time or duration changes
  useEffect(() => {
    if (formData.startTime) {
      const [hours, minutes] = formData.startTime.split(':').map(Number);
      const startMinutes = hours * 60 + minutes;
      const endMinutes = startMinutes + (formData.duration * 60);
      const endHours = Math.floor(endMinutes / 60) % 24;
      const endMins = endMinutes % 60;
      const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
      setFormData(prev => ({ ...prev, endTime }));
    }
  }, [formData.startTime, formData.duration]);

  const handleInputChange = (field: keyof PlannerFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCategoryToggle = (categoryId: number) => {
    setFormData(prev => ({
      ...prev,
      selectedCategories: prev.selectedCategories.includes(categoryId)
        ? prev.selectedCategories.filter(id => id !== categoryId)
        : [...prev.selectedCategories, categoryId]
    }));
  };

  const handleToggleAllCategories = () => {
    if (allCategoriesSelected) {
      setFormData(prev => ({ ...prev, selectedCategories: [] }));
      setAllCategoriesSelected(false);
    } else {
      setFormData(prev => ({ ...prev, selectedCategories: CATEGORIES.map(cat => cat.id) }));
      setAllCategoriesSelected(true);
    }
  };

  useEffect(() => {
    setAllCategoriesSelected(formData.selectedCategories.length === CATEGORIES.length);
  }, [formData.selectedCategories]);

  // Function to check if an event is open at the specified time
  const isEventOpenAtTime = (event: Event, startTime: string, date: string): boolean => {
    try {
      // If no opening hours data, assume it's open (for events without fixed hours)
      if (!event.opening_hours && !event.opening_hours_structured) {
        return true;
      }

      const [hours, minutes] = startTime.split(':').map(Number);
      const startTimeMinutes = hours * 60 + minutes;
      const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });

      // Try to use structured opening hours first
      if (event.opening_hours_structured && Array.isArray(event.opening_hours_structured)) {
        const todaysHours = event.opening_hours_structured.find((dayHours: any) => 
          dayHours.day?.toLowerCase() === dayOfWeek.toLowerCase()
        );

        if (todaysHours) {
          if (todaysHours.closed) {
            return false;
          }

          if (todaysHours.open && todaysHours.close) {
            const openTime = parseTimeToMinutes(todaysHours.open);
            const closeTime = parseTimeToMinutes(todaysHours.close);
            
            // Handle venues that close after midnight
            if (closeTime < openTime) {
              return startTimeMinutes >= openTime || startTimeMinutes <= closeTime;
            } else {
              return startTimeMinutes >= openTime && startTimeMinutes <= closeTime;
            }
          }
        }
      }

      // Fallback to parsing opening_hours string
      if (event.opening_hours) {
        return parseOpeningHoursString(event.opening_hours, startTimeMinutes, dayOfWeek);
      }

      // If we can't determine, assume it's open
      return true;
    } catch (error) {
      console.warn('Error parsing opening hours for event:', event.event_name, error);
      return true; // Default to open if we can't parse
    }
  };

  // Helper function to convert time string to minutes since midnight
  const parseTimeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Helper function to parse opening hours string format
  const parseOpeningHoursString = (openingHours: string, startTimeMinutes: number, dayOfWeek: string): boolean => {
    try {
      const lowerOpeningHours = openingHours.toLowerCase();
      const lowerDayOfWeek = dayOfWeek.toLowerCase();

      // Check for "24/7" or "24 hours"
      if (lowerOpeningHours.includes('24/7') || lowerOpeningHours.includes('24 hours')) {
        return true;
      }

      // Check for "closed" on this day
      if (lowerOpeningHours.includes('closed')) {
        return false;
      }

      // Look for time patterns like "9am-10pm", "09:00-22:00", etc.
      const timePattern = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi;
      const matches = [...openingHours.matchAll(timePattern)];

      if (matches.length > 0) {
        for (const match of matches) {
          const [, startHour, startMin = '0', startPeriod, endHour, endMin = '0', endPeriod] = match;
          
          let openTime = parseInt(startHour) * 60 + parseInt(startMin);
          let closeTime = parseInt(endHour) * 60 + parseInt(endMin);

          // Handle AM/PM conversion
          if (startPeriod?.toLowerCase() === 'pm' && parseInt(startHour) !== 12) {
            openTime += 12 * 60;
          } else if (startPeriod?.toLowerCase() === 'am' && parseInt(startHour) === 12) {
            openTime = parseInt(startMin);
          }

          if (endPeriod?.toLowerCase() === 'pm' && parseInt(endHour) !== 12) {
            closeTime += 12 * 60;
          } else if (endPeriod?.toLowerCase() === 'am' && parseInt(endHour) === 12) {
            closeTime = parseInt(endMin);
          }

          // Handle venues that close after midnight
          if (closeTime < openTime) {
            if (startTimeMinutes >= openTime || startTimeMinutes <= closeTime) {
              return true;
            }
          } else {
            if (startTimeMinutes >= openTime && startTimeMinutes <= closeTime) {
              return true;
            }
          }
        }
        return false; // No matching time slots found
      }

      // If we can't parse the format, assume it's open during reasonable hours (6am-11pm)
      return startTimeMinutes >= 6 * 60 && startTimeMinutes <= 23 * 60;
    } catch (error) {
      console.warn('Error parsing opening hours string:', openingHours, error);
      return true; // Default to open if we can't parse
    }
  };

  const callAIPlanner = async (matchingEvents: Event[], excludePrevious: boolean = false) => {
    try {
      console.log('🤖 Calling AI Planner with', matchingEvents.length, 'events');
      
      // Filter out previously used events if requested
      let availableEvents = matchingEvents;
      if (excludePrevious && usedEvents.size > 0) {
        availableEvents = matchingEvents.filter(event => !usedEvents.has(event.id));
        console.log(`🔄 Excluding ${usedEvents.size} previously used events, ${availableEvents.length} available`);
      }

      // If we've excluded too many events, allow some reuse but deprioritize
      if (availableEvents.length < 3 && matchingEvents.length >= 3) {
        console.log('🔄 Not enough new events, allowing some reuse');
        availableEvents = matchingEvents;
      }

      const response = await fetch('/api/ai-planner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          formData,
          events: availableEvents,
          excludePrevious,
          usedEventIds: Array.from(usedEvents),
          generationCount: generationCount + 1,
          varietyMode: excludePrevious
        }),
      });

      const result = await response.json();

      if (result.success && result.plan) {
        setAiPlan(result.plan);
        
        // Track used events from this generation
        if (result.plan.itinerary) {
          const newUsedEvents = new Set(usedEvents);
          result.plan.itinerary.forEach((item: any) => {
            if (item.type === 'event' && item.event_id) {
              newUsedEvents.add(item.event_id);
            }
          });
          setUsedEvents(newUsedEvents);
        }
        
        setGenerationCount(prev => prev + 1);
        
        const varietyText = excludePrevious ? ' with fresh recommendations' : '';
        setPlannerResults(`🎯 AI has created your personalized itinerary${varietyText} with ${result.plan.itinerary?.length || 0} activities!`);
      } else {
        console.error('AI Planner failed:', result.error);
        setPlannerResults(result.fallback_plan ? 
          `Found ${availableEvents.length} events. AI planning temporarily unavailable, showing basic recommendations.` :
          `AI planning failed: ${result.error}`);
        if (result.fallback_plan) {
          setAiPlan(result.fallback_plan);
        }
      }
    } catch (error) {
      console.error('Error calling AI Planner:', error);
      setPlannerResults(`Found ${matchingEvents.length} events. AI planning temporarily unavailable.`);
    }
  };

  const handleRegeneratePlan = async () => {
    if (events.length > 0) {
      setRegenerating(true);
      try {
        await callAIPlanner(events, true);
      } finally {
        setRegenerating(false);
      }
    }
  };

  const handleClearHistory = () => {
    setUsedEvents(new Set());
    setGenerationCount(0);
    setPlannerResults('');
    setAiPlan(null);
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('events')
        .select('*')
        .eq('is_over', false);

      // Filter by date
      if (formData.date) {
        query = query.lte('start_date', formData.date).gte('end_date', formData.date);
      }

      // Filter by categories
      if (formData.selectedCategories.length > 0) {
        query = query.overlaps('categories', formData.selectedCategories);
      }

      // Filter by budget
      if (formData.budgetPerPax > 0) {
        query = query.or(`price_min.lte.${formData.budgetPerPax},price_min.is.null`);
      }

      const { data, error } = await query.order('start_date', { ascending: true });

      if (error) {
        console.error('Supabase query error:', error);
        setPlannerResults(`Error fetching events: ${error.message}`);
        return;
      }

      // Filter events by opening hours on the client side
      let filteredEvents = data || [];
      
      if (formData.startTime && formData.date) {
        filteredEvents = (data || []).filter((event: Event) => {
          return isEventOpenAtTime(event, formData.startTime, formData.date);
        });
        
        console.log(`Filtered ${data?.length || 0} events to ${filteredEvents.length} events open at ${formData.startTime}`);
      }

      setEvents(filteredEvents);
      
      // Call AI Planner API
      if (filteredEvents && filteredEvents.length > 0) {
        await callAIPlanner(filteredEvents);
      } else {
        setPlannerResults(`No events found that are open at ${formData.startTime} on ${formData.date}. Try adjusting your start time or date.`);
      }
        
    } catch (error) {
      console.error('Error in fetchEvents:', error);
      setPlannerResults(`Unexpected error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.date || loading || regenerating) {
      if (!formData.date) alert('Please select a date');
      return;
    }

    setRegenerating(false); // Reset regenerating state when starting fresh
    fetchEvents();
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">AI Event Planner</h1>
          <p className="text-muted-foreground">
            Create your perfect day with AI-powered event recommendations
          </p>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Plan Your Events
            </CardTitle>
            <CardDescription>
              Fill out your preferences and let our AI create the perfect itinerary for you
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Date and Time Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date" className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    Date
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    required
                    className="focus-visible:ring-2 focus-visible:ring-primary"
                    aria-describedby="date-help"
                  />
                  <p id="date-help" className="text-xs text-muted-foreground">
                    Select your preferred date
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="startTime" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Start Time
                  </Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => handleInputChange('startTime', e.target.value)}
                    className="focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (hours)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    max="12"
                    step="0.5"
                    value={formData.duration}
                    onChange={(e) => handleInputChange('duration', parseFloat(e.target.value))}
                    className="focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endTime">End Time</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={formData.endTime}
                    readOnly
                    className="bg-muted cursor-not-allowed"
                    aria-describedby="endTime-help"
                  />
                  <p id="endTime-help" className="text-xs text-muted-foreground">
                    Calculated automatically
                  </p>
                </div>
              </div>

              {/* Group Size and Budget */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pax" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Group Size
                  </Label>
                  <Input
                    id="pax"
                    type="number"
                    min="1"
                    max="20"
                    value={formData.pax}
                    onChange={(e) => handleInputChange('pax', parseInt(e.target.value))}
                    className="focus-visible:ring-2 focus-visible:ring-primary"
                    aria-describedby="pax-help"
                  />
                  <p id="pax-help" className="text-xs text-muted-foreground">
                    Number of people in your group
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="budget" className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Budget per Person: ${formData.budgetPerPax}
                  </Label>
                  <Input
                    id="budget"
                    type="range"
                    min="0"
                    max="500"
                    step="5"
                    value={formData.budgetPerPax}
                    onChange={(e) => handleInputChange('budgetPerPax', parseInt(e.target.value))}
                    className="focus-visible:ring-2 focus-visible:ring-primary"
                    aria-describedby="budget-help"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>$0</span>
                    <span>$500+</span>
                  </div>
                  <p id="budget-help" className="text-xs text-muted-foreground">
                    Maximum budget per person for activities
                  </p>
                </div>
              </div>

              {/* Categories Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Interested Categories</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleToggleAllCategories}
                    aria-pressed={allCategoriesSelected}
                  >
                    {allCategoriesSelected ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <div 
                  className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2"
                  role="group"
                  aria-labelledby="categories-label"
                >
                  <p id="categories-label" className="sr-only">
                    Select categories of events you&apos;re interested in
                  </p>
                  {CATEGORIES.map((category) => (
                    <label
                      key={category.id}
                      className={`
                        flex items-center space-x-2 p-3 rounded-lg border cursor-pointer min-h-[3rem]
                        transition-all duration-200 hover:bg-accent hover:text-accent-foreground
                        focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2
                        ${formData.selectedCategories.includes(category.id)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background hover:bg-accent'
                        }
                      `}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={formData.selectedCategories.includes(category.id)}
                        onChange={() => handleCategoryToggle(category.id)}
                        aria-describedby={`category-${category.id}-desc`}
                      />
                      <div className={`
                        w-4 h-4 rounded border-2 flex items-center justify-center
                        ${formData.selectedCategories.includes(category.id)
                          ? 'bg-background border-background text-primary'
                          : 'border-muted-foreground'
                        }
                      `}>
                        {formData.selectedCategories.includes(category.id) && (
                          <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
                            <path d="M16.707 5.293a1 1 0 010 1.414L8.414 15 3.707 10.293a1 1 0 011.414-1.414L8.414 12.172l7.293-7.293a1 1 0 011.414 0z"/>
                          </svg>
                        )}
                      </div>
                      <span className="text-sm font-medium">{category.name}</span>
                      <span id={`category-${category.id}-desc`} className="sr-only">
                        {formData.selectedCategories.includes(category.id) ? "Selected" : "Not selected"}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Additional Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <Label className="text-base font-medium">Preferences</Label>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.prioritizeFavorites}
                      onChange={(e) => handleInputChange('prioritizeFavorites', e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`
                      w-5 h-5 rounded border-2 flex items-center justify-center
                      transition-colors duration-200
                      ${formData.prioritizeFavorites
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-muted-foreground hover:border-primary/70'
                      }
                    `}>
                      {formData.prioritizeFavorites && (
                        <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
                          <path d="M16.707 5.293a1 1 0 010 1.414L8.414 15 3.707 10.293a1 1 0 011.414-1.414L8.414 12.172l7.293-7.293a1 1 0 011.414 0z"/>
                        </svg>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4" />
                      <span>Prioritize Favorited Events</span>
                    </div>
                  </label>
                </div>

                <div className="space-y-4">
                  <Label className="text-base font-medium">Transportation</Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleInputChange('transport', 'public')}
                      className={`
                        flex items-center gap-2 px-4 py-3 rounded-lg border transition-all duration-200
                        focus:ring-2 focus:ring-primary focus:ring-offset-2
                        ${formData.transport === 'public'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background hover:bg-accent hover:text-accent-foreground border-border'
                        }
                      `}
                      aria-pressed={formData.transport === 'public'}
                    >
                      <Bus className="h-4 w-4" />
                      <span>Public Transport</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInputChange('transport', 'private')}
                      className={`
                        flex items-center gap-2 px-4 py-3 rounded-lg border transition-all duration-200
                        focus:ring-2 focus:ring-primary focus:ring-offset-2
                        ${formData.transport === 'private'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background hover:bg-accent hover:text-accent-foreground border-border'
                        }
                      `}
                      aria-pressed={formData.transport === 'private'}
                    >
                      <Car className="h-4 w-4" />
                      <span>Private Transport</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    type="submit"
                    className="px-8 py-3 font-medium"
                    disabled={loading || regenerating || !formData.date}
                    aria-describedby="submit-help"
                  >
                    {loading ? 'Generating Plan...' : 'Generate AI Plan'}
                  </Button>
                  
                  {aiPlan && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRegeneratePlan}
                      className="px-6 py-3 font-medium border-2 hover:bg-primary hover:text-primary-foreground transition-colors"
                      disabled={loading || regenerating}
                    >
                      {regenerating ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                          Generating Alternative...
                        </>
                      ) : (
                        '🔄 Generate Alternative'
                      )}
                    </Button>
                  )}
                  
                  {(usedEvents.size > 0 || generationCount > 0) && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleClearHistory}
                      className="px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      disabled={loading || regenerating}
                    >
                      🗑️ Clear History
                    </Button>
                  )}
                </div>
                
                <div className="mt-2 space-y-1">
                  <p id="submit-help" className="text-xs text-muted-foreground">
                    {!formData.date && 'Please select a date to continue'}
                  </p>
                  {generationCount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Generation #{generationCount} • {usedEvents.size} events used previously
                    </p>
                  )}
                  {regenerating && (
                    <p className="text-xs text-blue-600 font-medium">
                      🔄 Generating alternative itinerary with fresh recommendations...
                    </p>
                  )}
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Results Section */}
        {(plannerResults || events.length > 0 || aiPlan) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Your AI-Generated Plan
              </CardTitle>
              <CardDescription>
                Based on your preferences, here&apos;s what we found
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {plannerResults && (
                <div className="p-4 bg-muted rounded-lg">
                  <h3 className="font-medium mb-2">AI Planner Summary</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {plannerResults}
                  </p>
                </div>
              )}

              {/* AI-Generated Itinerary */}
              {aiPlan && aiPlan.itinerary && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Your Personalized Itinerary</h3>
                    {aiPlan.budget_breakdown?.subtotal && (
                      <Badge variant="outline" className="text-sm">
                        ${aiPlan.budget_breakdown.subtotal} per person
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    {aiPlan.itinerary.map((item: any, index: number) => {
                      // Calculate event number by counting previous events
                      const eventNumber = aiPlan.itinerary.slice(0, index + 1).filter((prevItem: any) => prevItem.type === 'event').length;
                      
                      if (item.type === 'event') {
                        return (
                          <div key={index} className="border rounded-lg p-4 bg-card">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-medium">
                                  {eventNumber}
                                </div>
                                <div>
                                  <h4 className="font-semibold">{item.event_name}</h4>
                                  <p className="text-sm text-muted-foreground">{item.time}</p>
                                </div>
                              </div>
                              <Badge variant="secondary">${item.cost_per_person}</Badge>
                            </div>
                            
                            <div className="ml-11 space-y-4">
                              <p className="text-sm">
                                <MapPin className="inline w-4 h-4 mr-1" />
                                {item.location}
                              </p>
                              <p className="text-sm">{item.description}</p>
                              
                              {/* What you'll do */}
                              {(item.what_youll_do || item.detailed_breakdown) && (
                                <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded text-sm">
                                  <strong className="text-green-900 dark:text-green-100">🎯 What you&apos;ll do:</strong>
                                  <div className="mt-2 space-y-1">
                                    {item.what_youll_do ? (
                                      Array.isArray(item.what_youll_do) ? (
                                        item.what_youll_do.map((activity: string, idx: number) => (
                                          <div key={idx} className="flex items-start gap-2">
                                            <span className="text-green-600 dark:text-green-400 mt-0.5 font-bold">–</span>
                                            <span>{activity}</span>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="flex items-start gap-2">
                                          <span className="text-green-600 dark:text-green-400 mt-0.5 font-bold">–</span>
                                          <span>{item.what_youll_do}</span>
                                        </div>
                                      )
                                    ) : (
                                      // Fallback to detailed_breakdown if what_youll_do is not available
                                      item.detailed_breakdown.split('\n').filter((line: string) => line.trim()).map((line: string, idx: number) => {
                                        const trimmedLine = line.trim().replace(/^[•\-\*]\s*/, '');
                                        const isSubItem = line.includes('-') || line.startsWith('  ') || line.startsWith('\t');
                                        
                                        return (
                                          <div key={idx} className={`flex items-start gap-2 ${isSubItem ? 'ml-4' : ''}`}>
                                            <span className="text-green-600 dark:text-green-400 mt-0.5 font-bold">
                                              {isSubItem ? '–' : '•'}
                                            </span>
                                            <span>{trimmedLine.replace(/^–\s*/, '')}</span>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>

                                </div>
                              )}

                              {/* Why it works */}
                              {item.why_it_works && (
                                <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded text-sm">
                                  <strong className="text-purple-900 dark:text-purple-100">💝 Why it works for your group:</strong>
                                  <div className="mt-2 space-y-1">
                                    {Array.isArray(item.why_it_works) ? (
                                      item.why_it_works.map((reason: string, idx: number) => (
                                        <div key={idx} className="flex items-start gap-2">
                                          <span className="text-purple-600 dark:text-purple-400 mt-0.5 font-bold">–</span>
                                          <span>{reason}</span>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="flex items-start gap-2">
                                        <span className="text-purple-600 dark:text-purple-400 mt-0.5 font-bold">–</span>
                                        <span>{item.why_it_works}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                              
                              {/* Visit Notes/Tips */}
                              {item.visit_notes && (
                                <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded text-sm">
                                  <strong className="text-blue-900 dark:text-blue-100">💡 Tips:</strong>
                                  <div className="mt-2 space-y-1">
                                    {Array.isArray(item.visit_notes) ? (
                                      item.visit_notes.map((tip: string, idx: number) => (
                                        <div key={idx} className="flex items-start gap-2">
                                          <span className="text-blue-600 dark:text-blue-400 mt-0.5 font-bold">–</span>
                                          <span>{tip}</span>
                                        </div>
                                      ))
                                    ) : (
                                      item.visit_notes.split('\n').filter((line: string) => line.trim()).map((line: string, idx: number) => (
                                        <div key={idx} className="flex items-start gap-2">
                                          <span className="text-blue-600 dark:text-blue-400 mt-0.5 font-bold">–</span>
                                          <span>{line.trim().replace(/^[•\-\*]\s*/, '')}</span>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )}
                              
                              <div className="flex gap-4 text-xs text-muted-foreground">
                                <span>Duration: {item.duration}</span>
                              </div>
                            </div>
                          </div>
                        );
                      } else if (item.type === 'travel') {
                        return (
                          <div key={index} className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/20 rounded-r-lg p-4">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm">
                                🚶
                              </div>
                              <div>
                                <h4 className="font-medium text-blue-900 dark:text-blue-100">Travel to Next Location</h4>
                                <p className="text-sm text-blue-700 dark:text-blue-300">{item.time}</p>
                              </div>
                              <Badge variant="outline" className="ml-auto">${item.cost_per_person}</Badge>
                            </div>
                            
                            <div className="ml-11 space-y-3">
                              <p className="text-sm text-blue-800 dark:text-blue-200">
                                <strong>From:</strong> {item.from} → <strong>To:</strong> {item.to}
                              </p>
                              
                              <div className="bg-white dark:bg-blue-900/30 p-4 rounded text-sm">
                                <strong className="text-blue-900 dark:text-blue-100">🗺️ Route:</strong>
                                <div className="mt-2 space-y-1">
                                  {item.route_details ? (
                                    Array.isArray(item.route_details) ? (
                                      item.route_details.map((step: string, idx: number) => (
                                        <div key={idx} className="flex items-start gap-2">
                                          <span className="text-blue-600 dark:text-blue-400 mt-0.5 font-bold">–</span>
                                          <span>{step}</span>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="flex items-start gap-2">
                                        <span className="text-blue-600 dark:text-blue-400 mt-0.5 font-bold">–</span>
                                        <span>{item.route_details}</span>
                                      </div>
                                    )
                                  ) : item.instructions ? (
                                    <div className="flex items-start gap-2">
                                      <span className="text-blue-600 dark:text-blue-400 mt-0.5 font-bold">–</span>
                                      <span>{item.instructions}</span>
                                    </div>
                                  ) : null}
                                </div>
                                

                              </div>
                              
                              <div className="flex gap-4 text-xs text-blue-600 dark:text-blue-400">
                                <span>Duration: {item.duration}</span>
                                <span>Mode: {item.transport_mode}</span>
                              </div>
                            </div>
                          </div>
                        );
                      } else if (item.type === 'bonus_activity') {
                        return (
                          <div key={index} className="border-l-4 border-green-500 bg-green-50 dark:bg-green-950/20 rounded-r-lg p-4">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm">
                                ⭐
                              </div>
                              <div>
                                <h4 className="font-medium text-green-900 dark:text-green-100">{item.activity_name}</h4>
                                <p className="text-sm text-green-700 dark:text-green-300">{item.time}</p>
                              </div>
                              <Badge variant="outline" className="ml-auto">${item.cost_per_person}</Badge>
                            </div>
                            
                            <div className="ml-11 space-y-2">
                              <p className="text-sm text-green-800 dark:text-green-200">
                                <MapPin className="inline w-4 h-4 mr-1" />
                                {item.location}
                              </p>
                              <p className="text-sm">{item.description}</p>
                              {item.why_suggested && (
                                <div className="bg-white dark:bg-green-900/30 p-3 rounded text-sm">
                                  <strong>💡 Why suggested:</strong> {item.why_suggested}
                                </div>
                              )}
                              <div className="text-xs text-green-600 dark:text-green-400">
                                Duration: {item.duration}
                              </div>
                            </div>
                          </div>
                        );
                      } else if (item.type === 'meal') {
                        return (
                          <div key={index} className="border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-950/20 rounded-r-lg p-4">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="bg-orange-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm">
                                🍽️
                              </div>
                              <div>
                                <h4 className="font-medium text-orange-900 dark:text-orange-100">
                                  {item.meal_type.charAt(0).toUpperCase() + item.meal_type.slice(1)} Break
                                </h4>
                                <p className="text-sm text-orange-700 dark:text-orange-300">{item.time}</p>
                              </div>
                              <Badge variant="outline" className="ml-auto">${item.cost_per_person}</Badge>
                            </div>
                            
                            <div className="ml-11 space-y-2">
                              <p className="text-sm text-orange-800 dark:text-orange-200">
                                <MapPin className="inline w-4 h-4 mr-1" />
                                {item.location}
                              </p>
                              <div className="bg-white dark:bg-orange-900/30 p-3 rounded text-sm">
                                <strong>🍴 Suggestions:</strong> {item.suggestions}
                              </div>
                              <div className="text-xs text-orange-600 dark:text-orange-400">
                                Duration: {item.duration}
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>

                  {/* Itinerary Summary */}
                  {aiPlan.itinerary_summary && (
                    <div className="p-4 bg-muted rounded-lg">
                      <h4 className="font-medium mb-2">📋 Itinerary Summary</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {aiPlan.itinerary_summary}
                      </p>
                    </div>
                  )}



                  {/* Recommendations */}
                  {aiPlan.recommendations && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {aiPlan.recommendations.what_to_bring && (
                        <div className="p-4 border rounded-lg">
                          <h4 className="font-medium mb-2">What to Bring</h4>
                          <ul className="text-sm space-y-1">
                            {aiPlan.recommendations.what_to_bring.map((item: string, idx: number) => (
                              <li key={idx}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {aiPlan.recommendations.booking_requirements && (
                        <div className="p-4 border rounded-lg">
                          <h4 className="font-medium mb-2">Booking Requirements</h4>
                          <p className="text-sm">{aiPlan.recommendations.booking_requirements}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Matching Events (Fallback) */}
              {events.length > 0 && !aiPlan && (
                <div className="space-y-4">
                  <h3 className="font-medium">Available Events ({events.length})</h3>
                  <div className="grid gap-4">
                    {events.slice(0, 6).map((event) => (
                      <div
                        key={event.id}
                        className="border rounded-lg p-4 hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium">{event.event_name}</h4>
                          {event.price_min && (
                            <Badge variant="secondary">
                              ${event.price_min}{event.price_max && event.price_max !== event.price_min && ` - $${event.price_max}`}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {event.location_text}
                        </p>
                        <p className="text-sm line-clamp-2 mb-2">
                          {event.description}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{new Date(event.start_date).toLocaleDateString()}</span>
                          {event.categories_name && (
                            <>
                              <Separator orientation="vertical" className="h-3" />
                              <span>{event.categories_name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {events.length > 6 && (
                    <p className="text-sm text-muted-foreground text-center">
                      And {events.length - 6} more events...
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
