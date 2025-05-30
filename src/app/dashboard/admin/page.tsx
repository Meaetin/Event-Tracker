"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase/supabaseClient';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { Event, Category, EventStatus, ScrapedEventListing } from '../../types/database';

// Create a single connection manager
class SupabaseManager {
  private static instance: SupabaseManager;
  private connectionCount = 0;
  private maxRetries = 3;
  private baseDelay = 1000;

  static getInstance() {
    if (!SupabaseManager.instance) {
      SupabaseManager.instance = new SupabaseManager();
    }
    return SupabaseManager.instance;
  }

  async executeQuery<T>(
    queryFn: () => Promise<{ data: T; error: any }>,
    operation: string
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        this.connectionCount++;
        console.log(`[${operation}] Attempt ${attempt + 1}, Active connections: ${this.connectionCount}`);
        
        // Create a timeout promise that refreshes the page
        let timeoutId: NodeJS.Timeout | undefined;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            console.error(`[${operation}] Operation timed out after 3 seconds, refreshing page...`);
            if (typeof window !== 'undefined') {
              window.location.reload();
            }
            reject(new Error('Operation timed out'));
          }, 3000); // 3 second timeout
        });
        
        // Race between the query and the timeout
        const result = await Promise.race([queryFn(), timeoutPromise]);
        
        // Clear the timeout if the operation completed successfully
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        this.connectionCount--;
        
        if (result.error) {
          throw result.error;
        }
        
        console.log(`[${operation}] Success, returned ${Array.isArray(result.data) ? result.data.length : 1} items`);
        return result.data;
      } catch (error: any) {
        this.connectionCount--;
        lastError = error;
        
        console.error(`[${operation}] Attempt ${attempt + 1} failed:`, error);
        
        // Don't retry for certain errors or timeout errors
        if (error.code === 'PGRST116' || error.message?.includes('JWT') || error.message?.includes('timed out')) {
          throw error;
        }
        
        if (attempt < this.maxRetries - 1) {
          const delay = this.baseDelay * Math.pow(2, attempt);
          console.log(`[${operation}] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }
}

export default function AdminDashboard() {
  const { user: authUser, signOut, isLoading: authLoading } = useAuth();
  const [admin, setAdmin] = useState<any>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<Event[]>([]);
  const [scrapedListings, setScrapedListings] = useState<ScrapedEventListing[]>([]);
  const [displayedListings, setDisplayedListings] = useState<ScrapedEventListing[]>([]);
  const [error, setError] = useState('');
  const [activeView, setActiveView] = useState('scrape');
  const [isOnline, setIsOnline] = useState(true);
  const [recoveringData, setRecoveringData] = useState(false);
  const [processingApproved, setProcessingApproved] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [showReadyDropdown, setShowReadyDropdown] = useState(false);
  const [processingIndividual, setProcessingIndividual] = useState<string | null>(null);
  
  // Use refs to prevent multiple simultaneous operations
  const fetchingRef = useRef(false);
  const supabaseManager = SupabaseManager.getInstance();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Browser storage keys
  const SCRAPED_DATA_KEY = 'pending_scraped_data';
  const SCRAPED_URL_KEY = 'pending_scraped_url';

  // Monitor connection status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Handle click outside dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowReadyDropdown(false);
      }
    };

    if (showReadyDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showReadyDropdown]);

  // Fetch events from DB
  const fetchEvents = useCallback(async () => {
    if (fetchingRef.current) {
      console.log('fetchEvents already in progress, skipping...');
      return;
    }
    
    fetchingRef.current = true;
    console.log('Starting fetchEvents...');
    
    try {
      const data = await supabaseManager.executeQuery(
        async () => {
          const result = await supabase
            .from('events')
            .select(`
              *,
              categories (
                id,
                name
              )
            `)
            .order('created_at', { ascending: false });
          return result;
        },
        'fetchEvents'
      );
      
      setEvents((data as Event[]) || []);
    } catch (err: any) {
      console.error('Error in fetchEvents:', err);
      setError(`Failed to load events: ${err.message}`);
    } finally {
      fetchingRef.current = false;
    }
  }, [supabaseManager]);

  // Fetch scraped listings
  const fetchScrapedListings = useCallback(async () => {
    try {
      console.log('Fetching scraped listings...');
      
      const data = await supabaseManager.executeQuery(
        async () => {
          const result = await supabase
            .from('scraped_listings')
            .select('*')
            .order('created_at', { ascending: false });
          return result;
        },
        'fetchScrapedListings'
      );

      const listings = (data as ScrapedEventListing[]) || [];
      setScrapedListings(listings);
      // Show all listings except rejected and processed ones
      setDisplayedListings(listings.filter(l => l.status !== 'rejected' && l.status !== 'processed'));
    } catch (err: any) {
      console.error('Error fetching scraped listings:', err);
      setError(`Failed to load scraped listings: ${err.message}`);
    }
  }, [supabaseManager]);

  // Load admin data with sequential loading to prevent connection overload
  const loadAdminData = useCallback(async () => {
    if (!authUser) {
      router.push('/auth/login');
      return;
    }

    try {
      setPageLoading(true);
      setError('');
      
      // Get admin profile
      const profile = await supabaseManager.executeQuery(
        async () => {
          const result = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .single();
          return result;
        },
        'loadAdminProfile'
      );

      // Verify admin role
      if (!profile || (profile as any).role !== 'admin') {
        router.push('/dashboard/user');
        return;
      }

      setAdmin(profile);

      // Load data sequentially with delays to prevent overwhelming the connection
      console.log('Loading admin data sequentially...');
      
      await fetchEvents();
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
      
      await fetchScrapedListings();
      
      console.log('Admin data loaded successfully');
      
    } catch (error: any) {
      console.error('Error loading admin data:', error);
      setError(`Failed to load admin data: ${error.message}`);
    } finally {
      setPageLoading(false);
    }
  }, [authUser, router, fetchEvents, fetchScrapedListings, supabaseManager]);

  // Check for pending scraped data on component mount
  const checkPendingScrapedData = useCallback(async () => {
    try {
      const pendingData = localStorage.getItem(SCRAPED_DATA_KEY);
      const pendingUrl = localStorage.getItem(SCRAPED_URL_KEY);
      
      if (pendingData && pendingUrl) {
        setRecoveringData(true);
        console.log('Found pending scraped data, attempting to save...');
        const scrapedData = JSON.parse(pendingData);
        
        // Prepare data for database
        const upsertData = scrapedData.map((item: any) => ({
          title: item.title?.trim() || 'Untitled Event',
          url: item.articleUrl?.trim() || item.url?.trim(),
          image_url: item.imageUrl?.trim() || null,
          status: 'pending'
        })).filter((item: { url: any; }) => item.url);

        if (upsertData.length > 0) {
          await supabaseManager.executeQuery(
            async () => {
              const result = await supabase
                .from('scraped_listings')
                .upsert(upsertData, { 
                  onConflict: 'url',
                  ignoreDuplicates: true 
                })
                .select();
              return result;
            },
            'savePendingScrapedData'
          );

          // Clear localStorage after successful save
          localStorage.removeItem(SCRAPED_DATA_KEY);
          localStorage.removeItem(SCRAPED_URL_KEY);
          
          console.log('Successfully saved pending scraped data');
          
          // Refresh scraped listings
          await fetchScrapedListings();
        }
      }
    } catch (error) {
      console.error('Error processing pending scraped data:', error);
      // Keep data in localStorage for next attempt
    } finally {
      setRecoveringData(false);
    }
  }, [supabaseManager, fetchScrapedListings, SCRAPED_DATA_KEY, SCRAPED_URL_KEY]);

  useEffect(() => {
    console.log('useEffect triggered - authLoading:', authLoading, 'authUser:', authUser);
    if (!authLoading && isOnline) {
      loadAdminData().then(() => {
        // Check for pending data after admin data is loaded
        checkPendingScrapedData();
      });
    }
  }, [authLoading, loadAdminData, isOnline, checkPendingScrapedData]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/auth/login');
  };

  // Handle event status update
  const handleUpdateEventStatus = async (eventId: string, newStatus: EventStatus) => {
    try {
      await supabaseManager.executeQuery(
        async () => {
          const result = await supabase
            .from('events')
            .update({ 
              status: newStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', eventId);
          return result;
        },
        'updateEventStatus'
      );

      // Update local state optimistically
      setEvents(prevEvents =>
        prevEvents.map(event =>
          event.id === eventId ? { ...event, status: newStatus } : event
        )
      );
    } catch (err: any) {
      console.error('Error updating event status:', err);
      setError(`Failed to update event status: ${err.message}`);
    }
  };

  // Handle event deletion with better error handling
  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) {
      return;
    }

    try {
      await supabaseManager.executeQuery(
        async () => {
          const result = await supabase
            .from('events')
            .delete()
            .eq('id', eventId);
          return result;
        },
        'deleteEvent'
      );

      // Update local state optimistically
      setEvents(prevEvents => prevEvents.filter(event => event.id !== eventId));
    } catch (err: any) {
      console.error('Error deleting event:', err);
      setError(`Failed to delete event: ${err.message}`);
    }
  };

  // Handle initial URL scraping with improved error handling and timeout
  const handleScrapeListings = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim() || scraping || !isOnline) return;

    setScraping(true);
    setError('');
    console.log('Starting listings scrape...');

    try {
      // Validate URL
      new URL(url);

      // Make scraping request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 second timeout

      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ url: url.trim() }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Scraping failed (${response.status})`);
      }

      const scrapedData = await response.json();

      if (!scrapedData || !Array.isArray(scrapedData) || scrapedData.length === 0) {
        throw new Error('No events found at this URL');
      }

      console.log('Scraped data:', scrapedData);

      // Save to localStorage immediately as backup
      localStorage.setItem(SCRAPED_DATA_KEY, JSON.stringify(scrapedData));
      localStorage.setItem(SCRAPED_URL_KEY, url.trim());
      console.log('Saved scraped data to localStorage as backup');

      // Save to database with better error handling
      const upsertData = scrapedData.map((item: any) => ({
        title: item.title?.trim() || 'Untitled Event',
        url: item.articleUrl?.trim() || item.url?.trim(),
        image_url: item.imageUrl?.trim() || null,
        status: 'pending'
      })).filter(item => item.url); // Filter out items without URLs

      if (upsertData.length === 0) {
        throw new Error('No valid events found with URLs');
      }

      console.log('Saving to database:', upsertData);

      await supabaseManager.executeQuery(
        async () => {
          const result = await supabase
            .from('scraped_listings')
            .upsert(upsertData, { 
              onConflict: 'url',
              ignoreDuplicates: true 
            })
            .select();
          return result;
        },
        'saveScrapedListings'
      );

      // Clear localStorage after successful database save
      localStorage.removeItem(SCRAPED_DATA_KEY);
      localStorage.removeItem(SCRAPED_URL_KEY);
      console.log('Successfully saved to database, cleared localStorage backup');

      // Clear form and refresh data
      setUrl('');
      await fetchScrapedListings();
      
    } catch (err: any) {
      console.error('Scraping error:', err);
      if (err.name === 'AbortError') {
        setError('Scraping timed out. Please try again with a different URL.');
      } else if (err.message?.includes('Invalid URL')) {
        setError('Please enter a valid URL');
      } else {
        setError(err.message || 'Failed to scrape content');
      }
    } finally {
      setScraping(false);
    }
  };

  // Handle event listing approval
  const handleApproveForScraping = async (listingId: string) => {
    try {
      await supabaseManager.executeQuery(
        async () => {
          const result = await supabase
            .from('scraped_listings')
            .update({ status: 'approved' })
            .eq('id', listingId);
          return result;
        },
        'approveListing'
      );

      // Update local state optimistically
      setScrapedListings(prevListings =>
        prevListings.map(l =>
          l.id === listingId ? { ...l, status: 'approved' } : l
        )
      );
      
      // Update displayed listings to keep the approved item visible
      setDisplayedListings(prevDisplayed =>
        prevDisplayed.map(l =>
          l.id === listingId ? { ...l, status: 'approved' } : l
        )
      );
      
    } catch (err: any) {
      console.error('Error approving listing:', err);
      setError(`Failed to approve listing: ${err.message}`);
    }
  };

  // Handle event listing rejection
  const handleRejectListing = async (listingId: string) => {
    try {
      await supabaseManager.executeQuery(
        async () => {
          const result = await supabase
            .from('scraped_listings')
            .update({ status: 'rejected' })
            .eq('id', listingId);
          return result;
        },
        'rejectListing'
      );

      // Update local state optimistically
      setScrapedListings(prevListings =>
        prevListings.map(l =>
          l.id === listingId ? { ...l, status: 'rejected' } : l
        )
      );
      
      // Update displayed listings to keep the rejected item visible
      setDisplayedListings(prevDisplayed =>
        prevDisplayed.map(l =>
          l.id === listingId ? { ...l, status: 'rejected' } : l
        )
      );
      
    } catch (err: any) {
      console.error('Error rejecting listing:', err);
      setError(`Failed to reject listing: ${err.message}`);
    }
  };

  // Handle processing approved and error listings with Jina AI and OpenAI
  const handleProcessApprovedListings = async () => {
    if (processingApproved || !isOnline) return;

    const readyListings = scrapedListings.filter(l => l.status === 'approved' || l.status === 'error');
    
    if (readyListings.length === 0) {
      setError('No listings ready to process');
      return;
    }

    setProcessingApproved(true);
    setError('');
    console.log('Starting approved listings processing...');

    try {
      const listingIds = readyListings.map((l: ScrapedEventListing) => l.id);

      const response = await fetch('/api/process-approved', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ listingIds }),
        signal: AbortSignal.timeout(300000) // 5 minute timeout
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Processing failed (${response.status})`);
      }

      const result = await response.json();
      console.log('Processing result:', result);

      if (result.errors && result.errors.length > 0) {
        console.warn('Some listings failed to process:', result.errors);
        setError(`Processed ${result.processed}/${result.total} listings. ${result.errors.length} failed.`);
      } else {
        setError(''); // Clear any previous errors
      }

      // Refresh data
      await Promise.all([
        fetchScrapedListings(),
        fetchEvents()
      ]);

      console.log(`Successfully processed ${result.processed} listings into events`);
      
    } catch (err: any) {
      console.error('Processing error:', err);
      if (err.name === 'AbortError') {
        setError('Processing timed out. Some events may have been created.');
      } else {
        setError(err.message || 'Failed to process approved listings');
      }
    } finally {
      setProcessingApproved(false);
    }
  };

  // Handle individual listing processing
  const handleProcessIndividualListing = async (listingId: string) => {
    if (processingIndividual || !isOnline) return;

    setProcessingIndividual(listingId);
    setError('');

    try {
      const response = await fetch('/api/process-approved', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ listingIds: [listingId] }),
        signal: AbortSignal.timeout(300000) // 5 minute timeout
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Processing failed (${response.status})`);
      }

      const result = await response.json();
      console.log('Individual processing result:', result);

      if (result.errors && result.errors.length > 0) {
        setError(`Processing failed: ${result.errors[0].error}`);
      } else {
        setError(''); // Clear any previous errors
      }

      // Refresh data
      await Promise.all([
        fetchScrapedListings(),
        fetchEvents()
      ]);

    } catch (err: any) {
      console.error('Individual processing error:', err);
      setError(err.message || 'Failed to process listing');
    } finally {
      setProcessingIndividual(null);
    }
  };

  // Handle resetting listing status to pending
  const handleResetListingStatus = async (listingId: string) => {
    try {
      await supabaseManager.executeQuery(
        async () => {
          const result = await supabase
            .from('scraped_listings')
            .update({ status: 'pending' })
            .eq('id', listingId);
          return result;
        },
        'resetListingStatus'
      );

      // Update local state optimistically
      setScrapedListings(prevListings =>
        prevListings.map(l =>
          l.id === listingId ? { ...l, status: 'pending' } : l
        )
      );
      
      // Update displayed listings
      setDisplayedListings(prevDisplayed =>
        prevDisplayed.map(l =>
          l.id === listingId ? { ...l, status: 'pending' } : l
        )
      );
      
    } catch (err: any) {
      console.error('Error resetting listing status:', err);
      setError(`Failed to reset listing status: ${err.message}`);
    }
  };

  if (authLoading || pageLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-600">Loading admin dashboard...</p>
        {!isOnline && (
          <p className="text-red-600 mt-2">⚠️ No internet connection</p>
        )}
      </div>
    );
  }

  if (!authUser || !admin) {
    return null; // Let the redirect happen
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Connection Status */}
      {!isOnline && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
          ⚠️ You are offline. Some features may not work properly.
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Sign Out
          </button>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Welcome, Admin {admin?.full_name}</h2>
          <p className="text-gray-600">Email: {admin?.email}</p>
        </div>
      </div>

      <div className="mt-6 max-w-2xl mx-auto">
        <h2 className="text-2xl font-semibold mb-4">Event Management</h2>
        
        <div className="mb-4 flex border-b">
          <button 
            className={`py-2 px-6 transition-colors ${
              activeView === 'scrape' 
                ? 'border-b-2 border-blue-500 text-blue-500 font-medium' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveView('scrape')}
          >
            Scrape Events
          </button>
          <button 
            className={`py-2 px-6 transition-colors ${
              activeView === 'review' 
                ? 'border-b-2 border-blue-500 text-blue-500 font-medium' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveView('review')}
          >
            Review Events ({events.filter(e => e.status === 'pending').length})
          </button>
          <button 
            className={`py-2 px-6 transition-colors ${
              activeView === 'approved' 
                ? 'border-b-2 border-blue-500 text-blue-500 font-medium' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveView('approved')}
          >
            Approved Events ({events.filter(e => e.status === 'approved').length})
          </button>
        </div>
        
        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg flex items-center">
            <svg className="h-5 w-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
            </svg>
            <span className="flex-1">{error}</span>
            <button 
              onClick={() => setError('')}
              className="ml-2 text-red-500 hover:text-red-700 transition-colors"
            >
              ×
            </button>
          </div>
        )}

        {activeView === 'scrape' && (
          <>
            {recoveringData && (
              <div className="mb-4 p-3 bg-blue-100 text-blue-700 rounded-lg flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Recovering previously scraped data...
              </div>
            )}

            <form onSubmit={handleScrapeListings} className="flex gap-2 mb-6">
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="Enter website URL to scrape events from"
                className="flex-1 border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                disabled={scraping || !isOnline}
                required
              />
              <button
                type="submit"
                disabled={scraping || !url.trim() || !isOnline}
                className="px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium min-w-[120px] flex items-center justify-center"
              >
                {scraping ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Scraping...
                  </>
                ) : (
                  'Scrape Events'
                )}
              </button>
            </form>

            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Scraped Listings</h3>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">
                    {displayedListings.length} displayed, {displayedListings.filter(l => l.status === 'pending').length} pending, {scrapedListings.filter(l => l.status === 'approved').length} approved, {scrapedListings.filter(l => l.status === 'error').length} failed
                  </span>
                  {(scrapedListings.filter(l => l.status === 'approved').length > 0 || scrapedListings.filter(l => l.status === 'error').length > 0) && (
                    <div className="relative" ref={dropdownRef}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleProcessApprovedListings}
                          disabled={processingApproved || !isOnline}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center"
                        >
                          {processingApproved ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Processing...
                            </>
                          ) : (
                            `Process ${scrapedListings.filter(l => l.status === 'approved' || l.status === 'error').length} Listings`
                          )}
                        </button>
                        <button
                          onClick={() => setShowReadyDropdown(!showReadyDropdown)}
                          className="px-2 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                          title="View ready listings"
                        >
                          <svg className={`w-4 h-4 transition-transform ${showReadyDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                      
                      {showReadyDropdown && (
                        <div className="absolute top-full right-0 mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-80 overflow-y-auto">
                          <div className="p-3 border-b bg-gray-50">
                            <h4 className="font-medium text-gray-900">Ready Listings ({scrapedListings.filter(l => l.status === 'approved' || l.status === 'error').length})</h4>
                          </div>
                          <div className="max-h-64 overflow-y-auto">
                            {scrapedListings.filter(l => l.status === 'approved' || l.status === 'error').map(listing => (
                              <div key={listing.id} className="p-3 border-b border-gray-100 last:border-b-0">
                                <div className="flex items-center justify-between gap-3 h-16">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                        listing.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                      }`}>
                                        {listing.status}
                                      </span>
                                    </div>
                                    <p className="text-sm font-medium text-gray-900 truncate" title={listing.title}>
                                      {listing.title}
                                    </p>
                                    {listing.status === 'error' && (
                                      <p className="text-xs text-red-600 truncate" title="Processing failed">
                                        Error: Processing failed
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex gap-1 flex-shrink-0">
                                    <button
                                      onClick={() => handleResetListingStatus(listing.id)}
                                      disabled={!isOnline}
                                      className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors disabled:opacity-50"
                                      title="Reset to pending"
                                    >
                                      Remove
                                    </button>
                                    <button
                                      onClick={() => handleProcessIndividualListing(listing.id)}
                                      disabled={processingIndividual === listing.id || !isOnline}
                                      className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center"
                                      title="Process this listing"
                                    >
                                      {processingIndividual === listing.id ? (
                                        <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                      ) : (
                                        'Process'
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {scrapedListings.filter(l => l.status === 'approved' || l.status === 'error').length === 0 && (
                              <div className="p-4 text-center text-gray-500 text-sm">
                                No ready listings
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {displayedListings.map(listing => (
                <div key={listing.id} className="bg-white p-4 rounded-lg shadow border">
                  <div className="flex gap-4">
                    <div className="w-1/3 h-48 relative">
                      <img 
                        src={listing.image_url || '/placeholder-event.jpg'} 
                        alt={listing.title} 
                        className="w-full h-full object-cover rounded-lg" 
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder-event.jpg';
                        }}
                      />
                    </div>
                    <div className="w-2/3 flex flex-col">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {listing.title}
                      </h3>
                      <div className="flex-grow">
                        <p className="text-sm text-gray-600 mb-2">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium mr-2 ${
                            listing.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            listing.status === 'approved' ? 'bg-green-100 text-green-800' :
                            listing.status === 'processed' ? 'bg-blue-100 text-blue-800' :
                            listing.status === 'error' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {listing.status}
                          </span>
                        </p>
                        <p className="text-sm text-gray-600 mb-2">
                          Source: <a href={listing.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{listing.url}</a>
                        </p>
                        <p className="text-sm text-gray-600">
                          Added: {new Date(listing.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {(listing.status === 'pending' || listing.status === 'error') && (
                        <div className="mt-4">
                          {listing.status === 'error' && (
                            <div className="mb-3">
                              <p className="text-sm text-red-600 font-medium">⚠ Previous processing failed - you can retry below</p>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleRejectListing(listing.id)}
                              disabled={!isOnline}
                              className="flex-1 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                            >
                              Reject
                            </button>
                            <button 
                              onClick={() => handleApproveForScraping(listing.id)}
                              disabled={!isOnline}
                              className="flex-1 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {listing.status === 'error' ? 'Retry Processing' : 'Approve for Processing'}
                            </button>
                          </div>
                        </div>
                      )}
                      {listing.status === 'processed' && (
                        <div className="mt-4">
                          <p className="text-sm text-blue-600 font-medium">✓ Successfully processed into event</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {displayedListings.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No pending listings found. Scrape a website to get started.
                </div>
              )}
            </div>
          </>
        )}

        {activeView === 'review' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Events to Review</h3>
              <span className="text-sm text-gray-500">
                {events.filter(e => e.status === 'pending').length} pending events
              </span>
            </div>

            {events.filter(e => e.status === 'pending').map(event => {
              const isExpanded = expandedEventId === event.id;
              
              return (
                <div key={event.id} className="bg-white rounded-lg shadow border overflow-hidden">
                  {/* Main Event Card */}
                  <div className="p-4">
                    <div className="flex gap-4">
                      <div className="w-1/3 h-48 relative">
                        <img 
                          src={event.images?.[0] || '/placeholder-event.jpg'} 
                          alt={event.name} 
                          className="w-full h-full object-cover rounded-lg" 
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/placeholder-event.jpg';
                          }}
                        />
                      </div>
                      <div className="w-2/3 flex flex-col">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-lg font-medium text-gray-900 flex-1 pr-4">
                            {event.name}
                          </h3>
                          <button
                            onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                            title={isExpanded ? "Hide details" : "Show details"}
                          >
                            <svg 
                              className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                        <div className="flex-grow">
                          <p className="text-sm text-gray-600 mb-2">
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="font-medium">Date:</span> {event.start_date ? new Date(event.start_date).toLocaleDateString() : 'No date specified'}
                              {event.end_date && event.end_date !== event.start_date && (
                                <span> - {new Date(event.end_date).toLocaleDateString()}</span>
                              )}
                            </span>
                          </p>
                          {event.time && (
                            <p className="text-sm text-gray-600 mb-2">
                              <span className="flex items-center gap-1">
                                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="font-medium">Time:</span> {event.time}
                              </span>
                            </p>
                          )}
                          <p className="text-sm text-gray-600 mb-2">
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span className="font-medium">Location:</span> {event.location}
                            </span>
                          </p>
                          <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                            <span className="font-medium">Description:</span> {event.description || 'No description available'}
                          </p>
                          <p className="text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                              </svg>
                              <span className="font-medium">Category:</span> {Array.isArray(event.categories) ? event.categories[0]?.name || 'Uncategorized' : event.categories?.name || 'Uncategorized'}
                            </span>
                          </p>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                            className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                          >
                            {isExpanded ? 'Hide Details' : 'View Details'}
                          </button>
                          <a 
                            href={event.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex-1 py-2 text-sm font-medium text-center text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                          >
                            View Source
                          </a>
                          <button 
                            onClick={() => handleDeleteEvent(event.id)}
                            disabled={!isOnline}
                            className="flex-1 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                          >
                            Delete
                          </button>
                          <button 
                            onClick={() => handleUpdateEventStatus(event.id, 'approved')}
                            disabled={!isOnline}
                            className="flex-1 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                          >
                            Approve
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details Section */}
                  {isExpanded && (
                    <div className="border-t bg-gray-50 p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left Column - Event Details */}
                        <div className="space-y-4">
                          <h4 className="text-md font-semibold text-gray-900 border-b pb-2">Event Information</h4>
                          
                          <div className="space-y-3">
                            <div>
                              <label className="text-sm font-medium text-gray-700">Event Name:</label>
                              <p className="text-sm text-gray-900 mt-1">{event.name}</p>
                            </div>
                            
                            <div>
                              <label className="text-sm font-medium text-gray-700">Full Description:</label>
                              <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">
                                {event.description || 'No description available'}
                              </p>
                            </div>
                            
                            <div>
                              <label className="text-sm font-medium text-gray-700">Location:</label>
                              <p className="text-sm text-gray-900 mt-1">{event.location}</p>
                            </div>
                            
                            {event.coordinates && (
                              <div>
                                <label className="text-sm font-medium text-gray-700">Coordinates:</label>
                                <p className="text-sm text-gray-900 mt-1 font-mono">{event.coordinates}</p>
                              </div>
                            )}
                            
                            <div>
                              <label className="text-sm font-medium text-gray-700">Category:</label>
                              <p className="text-sm text-gray-900 mt-1">{Array.isArray(event.categories) ? event.categories[0]?.name || 'Uncategorized' : event.categories?.name || 'Uncategorized'}</p>
                            </div>
                          </div>
                        </div>

                        {/* Right Column - Metadata & Images */}
                        <div className="space-y-4">
                          <h4 className="text-md font-semibold text-gray-900 border-b pb-2">Metadata</h4>
                          
                          <div className="space-y-3">
                            <div>
                              <label className="text-sm font-medium text-gray-700">Event ID:</label>
                              <p className="text-sm text-gray-900 mt-1 font-mono break-all">{event.id}</p>
                            </div>
                            
                            <div>
                              <label className="text-sm font-medium text-gray-700">Start Date:</label>
                              <p className="text-sm text-gray-900 mt-1">
                                {event.start_date ? (
                                  <>
                                    {new Date(event.start_date).toLocaleDateString()}
                                    <br />
                                    <span className="text-xs text-gray-500">({event.start_date})</span>
                                  </>
                                ) : (
                                  'No date specified'
                                )}
                              </p>
                            </div>
                            
                            <div>
                              <label className="text-sm font-medium text-gray-700">End Date:</label>
                              <p className="text-sm text-gray-900 mt-1">
                                {event.end_date ? (
                                  <>
                                    {new Date(event.end_date).toLocaleDateString()}
                                    <br />
                                    <span className="text-xs text-gray-500">({event.end_date})</span>
                                  </>
                                ) : (
                                  'No end date specified'
                                )}
                              </p>
                            </div>
                            
                            {event.time && (
                              <div>
                                <label className="text-sm font-medium text-gray-700">Time:</label>
                                <p className="text-sm text-gray-900 mt-1">{event.time}</p>
                              </div>
                            )}
                            
                            <div>
                              <label className="text-sm font-medium text-gray-700">Source URL:</label>
                              <a 
                                href={event.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline mt-1 block break-all"
                              >
                                {event.url}
                              </a>
                            </div>
                            
                            <div>
                              <label className="text-sm font-medium text-gray-700">Created:</label>
                              <p className="text-sm text-gray-900 mt-1">
                                {new Date(event.created_at).toLocaleDateString()} at {new Date(event.created_at).toLocaleTimeString()}
                              </p>
                            </div>
                            
                            <div>
                              <label className="text-sm font-medium text-gray-700">Last Updated:</label>
                              <p className="text-sm text-gray-900 mt-1">
                                {new Date(event.updated_at).toLocaleDateString()} at {new Date(event.updated_at).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                          
                          {/* Images Section */}
                          {event.images && event.images.length > 0 && (
                            <div>
                              <label className="text-sm font-medium text-gray-700">Images ({event.images.length}):</label>
                              <div className="mt-2 grid grid-cols-2 gap-2">
                                {event.images.map((imageUrl, index) => (
                                  <div key={index} className="relative">
                                    <img 
                                      src={imageUrl} 
                                      alt={`Event image ${index + 1}`}
                                      className="w-full h-24 object-cover rounded border"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).src = '/placeholder-event.jpg';
                                      }}
                                    />
                                    <a 
                                      href={imageUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center"
                                      title="View full image"
                                    >
                                      <svg className="w-6 h-6 text-white opacity-0 hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                    </a>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {events.filter(e => e.status === 'pending').length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No events pending review.
              </div>
            )}
          </div>
        )}

        {activeView === 'approved' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Approved Events</h3>
              <span className="text-sm text-gray-500">
                {events.filter(e => e.status === 'approved').length} approved events
              </span>
            </div>

            {events.filter(e => e.status === 'approved').map(event => (
              <div key={event.id} className="bg-white p-4 rounded-lg shadow border">
                <div className="flex gap-4">
                  <div className="w-1/3 h-48 relative">
                    <img 
                      src={event.images?.[0] || '/placeholder-event.jpg'} 
                      alt={event.name} 
                      className="w-full h-full object-cover rounded-lg" 
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder-event.jpg';
                      }}
                    />
                  </div>
                  <div className="w-2/3 flex flex-col">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {event.name}
                    </h3>
                    <div className="flex-grow">
                      <p className="text-sm text-gray-600 mb-2">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="font-medium">Date:</span> {event.start_date ? new Date(event.start_date).toLocaleDateString() : 'No date specified'}
                          {event.end_date && event.end_date !== event.start_date && (
                            <span> - {new Date(event.end_date).toLocaleDateString()}</span>
                          )}
                        </span>
                      </p>
                      {event.time && (
                        <p className="text-sm text-gray-600 mb-2">
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-medium">Time:</span> {event.time}
                          </span>
                        </p>
                      )}
                      <p className="text-sm text-gray-600 mb-2">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="font-medium">Location:</span> {event.location}
                        </span>
                      </p>
                      <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                        {event.description}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                          <span className="font-medium">Category:</span> {Array.isArray(event.categories) ? event.categories[0]?.name || 'Uncategorized' : event.categories?.name || 'Uncategorized'}
                        </span>
                      </p>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <a 
                        href={event.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex-1 py-2 text-sm font-medium text-center text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                      >
                        View Source
                      </a>
                      <button 
                        onClick={() => handleDeleteEvent(event.id)}
                        disabled={!isOnline}
                        className="flex-1 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {events.filter(e => e.status === 'approved').length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No approved events yet.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}