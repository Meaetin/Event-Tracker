"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabaseClient';
import { 
  Search, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Calendar,
  Database,
  X,
  Edit,
  Eye
} from 'lucide-react';

export default function AdminDashboard() {
  // Scraper state
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  // Pending and approved listings state
  const [pendingListings, setPendingListings] = useState<
    { id: string; title: string; url: string; image_url: string; status: string; created_at: string }[]
  >([]);
  const [processingQueue, setProcessingQueue] = useState<
    { id: string; title: string; url: string; image_url: string; status: string; created_at: string; queued_for_processing: boolean; updated_at: string; processing_started_at: string | null }[]
  >([]);
  const [processedEvents, setProcessedEvents] = useState<
    { id: string; event_name: string; page_url: string; image_url: string; updated_at: string; start_date: string; location_text: string; description: string }[]
  >([]);
  const [errorItems, setErrorItems] = useState<
    { id: string; title: string; url: string; image_url: string; status: string; created_at: string; queued_for_processing: boolean; updated_at: string }[]
  >([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [processingItems, setProcessingItems] = useState<Set<string>>(new Set());
  const [queueProcessing, setQueueProcessing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Direct URL addition state
  const [directUrl, setDirectUrl] = useState("");
  const [directUrlLoading, setDirectUrlLoading] = useState(false);
  const [directUrlError, setDirectUrlError] = useState<string | null>(null);

  // Event viewing and editing state
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Fetch pending listings and approved count
  async function fetchListings() {
    try {
      // Fetch pending listings
      const { data: pending, error: pendingError } = await supabase
        .from('scraped_listings')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (pendingError) throw pendingError;
      setPendingListings(pending || []);

      // Fetch items in processing queue (approved items and error items queued for retry)
      try {
        // Try to fetch with processing_started_at field first
        let queueItems, queueError;
        try {
          const result = await supabase
            .from('scraped_listings')
            .select('id, title, url, image_url, status, created_at, queued_for_processing, updated_at, processing_started_at')
            .in('status', ['approved', 'error'])
            .eq('queued_for_processing', true)
            .order('updated_at', { ascending: false });
          
          queueItems = result.data;
          queueError = result.error;
        } catch (fieldError) {
          // If processing_started_at field doesn't exist, fetch without it
          console.log('processing_started_at field not found, fetching without it');
          const result = await supabase
            .from('scraped_listings')
            .select('id, title, url, image_url, status, created_at, queued_for_processing, updated_at')
            .in('status', ['approved', 'error'])
            .eq('queued_for_processing', true)
            .order('updated_at', { ascending: false });
          
          queueItems = result.data;
          queueError = result.error;
        }
        
        if (queueError) {
          console.error('Error fetching queue items:', queueError);
          setProcessingQueue([]);
        } else {
          // Add processing_started_at as null for backward compatibility if it doesn't exist
          const queueItemsWithProcessing = (queueItems || []).map((item: any) => ({
            ...item,
            processing_started_at: item.processing_started_at || null
          }));
          setProcessingQueue(queueItemsWithProcessing);
        }
      } catch (queueException) {
        console.error('Exception fetching queue items:', queueException);
        setProcessingQueue([]);
      }

      // Also fetch error items that are not queued for retry (for the error section)
      try {
        const { data: errorItems, error: errorItemsError } = await supabase
          .from('scraped_listings')
          .select('id, title, url, image_url, status, created_at, queued_for_processing, updated_at')
          .eq('status', 'error')
          .eq('queued_for_processing', false)
          .order('updated_at', { ascending: false });
        
        if (errorItemsError) {
          console.error('Error fetching error items:', errorItemsError);
          setErrorItems([]);
        } else {
          setErrorItems(errorItems || []);
        }
      } catch (errorItemsException) {
        console.error('Exception fetching error items:', errorItemsException);
        setErrorItems([]);
      }

      // Fetch processed events from events table (sorted by recently updated)
      try {
        const { data: events, error: eventsError } = await supabase
          .from('events')
          .select('*')
          .order('updated_at', { ascending: false });
        
        if (eventsError) {
          console.error('Error fetching events:', eventsError);
          // If events table doesn't exist, that's okay - just set empty array
          if (eventsError.code === 'PGRST106' || eventsError.message?.includes('does not exist')) {
            console.log('Events table does not exist yet - this is normal for new installations');
          }
          setProcessedEvents([]);
        } else {
          setProcessedEvents(events || []);
        }
      } catch (eventsException) {
        console.error('Exception fetching events:', eventsException);
        setProcessedEvents([]);
      }

    } catch (error) {
      console.error('Error fetching listings:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
    } finally {
      setLoadingListings(false);
    }
  }

  // Handle approve action
  async function handleApprove(itemId: string) {
    setProcessingItems(prev => new Set(prev).add(itemId));
    try {
      const { error } = await supabase
        .from('scraped_listings')
        .update({ 
          status: 'approved',
          queued_for_processing: true
        })
        .eq('id', itemId);
      
      if (error) throw error;
      
      // Refresh listings after successful update
      await fetchListings();
      
      // Trigger background processing
      try {
        await fetch('/api/process-queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (processError) {
        console.error('Error triggering queue processing:', processError);
        // Don't fail the approval if queue trigger fails
      }
    } catch (error) {
      console.error('Error approving item:', error);
      
    } finally {
      setProcessingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  }

  // Handle reject action
  async function handleReject(itemId: string) {
    setProcessingItems(prev => new Set(prev).add(itemId));
    try {
      const { error } = await supabase
        .from('scraped_listings')
        .update({ status: 'rejected' })
        .eq('id', itemId);
      
      if (error) throw error;
      
      // Refresh listings after successful update
      await fetchListings();
    } catch (error) {
      console.error('Error rejecting item:', error);
      // You could add a toast notification here
    } finally {
      setProcessingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  }

  // Handle retry processing for error items
  async function handleRetryProcessing(itemId: string) {
    setProcessingItems(prev => new Set(prev).add(itemId));
    try {
      const { error } = await supabase
        .from('scraped_listings')
        .update({ 
          queued_for_processing: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', itemId);
      
      if (error) throw error;
      
      // Refresh listings to show queued status
      await fetchListings();
      
      // Wait a moment for the UI to update, then trigger processing
      setTimeout(async () => {
        try {
          const response = await fetch('/api/process-queue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (response.ok) {
            // Wait a bit then refresh to show updated status
            setTimeout(async () => {
              await fetchListings();
            }, 2000);
          }
        } catch (processError) {
          console.error('Error triggering queue processing:', processError);
          // Refresh anyway to show current state
          await fetchListings();
        }
      }, 500);
      
    } catch (error) {
      console.error('Error retrying item:', error);
    } finally {
      setProcessingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  }

  // Fetch pending listings and approved count on component load
  useEffect(() => {
    fetchListings();
  }, []);

  // Handle Escape key to close modals
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.code === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        
        if (isViewModalOpen) {
          closeViewModal();
          closeEditModal();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);

    // Cleanup event listeners
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isViewModalOpen, isEditModalOpen]);

  // Auto-refresh when there are items being processed
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    const hasQueuedItems = processingQueue.some(item => item.queued_for_processing);
    
    if (hasQueuedItems || queueProcessing) {
      setAutoRefresh(true);
      interval = setInterval(() => {
        fetchListings();
      }, 3000); // Refresh every 3 seconds
    } else {
      setAutoRefresh(false);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [processingQueue, queueProcessing]);

  async function handleScrapeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setScrapeError(null);
    setScrapeLoading(true);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: scrapeUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scrape failed");
      
      // Refresh listings after successful scrape
      await fetchListings();
      
      // Clear the URL input after successful scrape
      setScrapeUrl("");
    } catch (err: any) {
      setScrapeError(err.message || "Unknown error");
    } finally {
      setScrapeLoading(false);
    }
  }

  // Manual queue processing trigger
  async function triggerQueueProcessing() {
    setQueueProcessing(true);
    try {
      const response = await fetch('/api/process-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Queue processing failed');
      }
      
      console.log('Queue processing completed:', data);
      
      // Refresh listings after processing
      await fetchListings();
    } catch (error) {
      console.error('Error triggering queue processing:', error);
      // Still refresh to show current state
      await fetchListings();
    } finally {
      setQueueProcessing(false);
    }
  }

  // Handle direct URL addition to processing queue
  async function handleDirectUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDirectUrlError(null);
    setDirectUrlLoading(true);
    try {
      const res = await fetch("/api/add-to-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: directUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add URL to queue");
      
      // Refresh listings after successful addition
      await fetchListings();
      
      // Clear the URL input after successful addition
      setDirectUrl("");
    } catch (err: any) {
      setDirectUrlError(err.message || "Unknown error");
    } finally {
      setDirectUrlLoading(false);
    }
  }

  // Handle view event details
  function handleViewEvent(event: any) {
    setSelectedEvent(event);
    setIsViewModalOpen(true);
    // Focus the modal after a short delay to ensure it's rendered
    setTimeout(() => {
      const modal = document.querySelector('[role="dialog"]') as HTMLElement;
      if (modal) modal.focus();
    }, 100);
  }

  // Handle edit event
  function handleEditEvent(event: any) {
    setEditingEvent({ ...event });
    setIsEditModalOpen(true);
    setUpdateError(null);
    // Focus the modal after a short delay to ensure it's rendered
    setTimeout(() => {
      const modal = document.querySelector('[role="dialog"]') as HTMLElement;
      if (modal) modal.focus();
    }, 100);
  }

  // Handle update event
  async function handleUpdateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEvent) return;
    
    setUpdateLoading(true);
    setUpdateError(null);
    
    try {
      // Create update object with all editable fields, excluding id and auto-managed fields
      const updateData = { ...editingEvent };
      delete updateData.id;
      updateData.updated_at = new Date().toISOString();
      
      const { error } = await supabase
        .from('events')
        .update(updateData)
        .eq('id', editingEvent.id);
      
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      // Refresh events list
      await fetchListings();
      
      // Close modal
      setIsEditModalOpen(false);
      setEditingEvent(null);
    } catch (error: any) {
      setUpdateError(error.message || "Failed to update event");
    } finally {
      setUpdateLoading(false);
    }
  }

  // Close modals
  function closeViewModal() {
    setIsViewModalOpen(false);
    setSelectedEvent(null);
  }

  function closeEditModal() {
    setIsEditModalOpen(false);
    setEditingEvent(null);
    setUpdateError(null);
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Manage events, users, and system settings
            </p>
          </div>
          <Button>
            <Database className="w-4 h-4 mr-2" />
            System Status
          </Button>
        </div>

        {/* Stats Cards - Enhanced with section background */}
        <div className="section-bg-light p-6 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="card-enhanced">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,234</div>
              <p className="text-xs text-muted-foreground">
                +12% from last month
              </p>
            </CardContent>
          </Card>

          <Card className="card-enhanced">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingListings.length}</div>
              <p className="text-xs text-muted-foreground">
                Scraped listings awaiting review
              </p>
            </CardContent>
          </Card>

          <Card className="card-enhanced">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Processing Queue</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{processingQueue.filter(item => item.queued_for_processing).length}</div>
              <p className="text-xs text-muted-foreground">
                Items waiting to be processed
              </p>
            </CardContent>
          </Card>

          <Card className="card-enhanced">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Processed Events</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{processedEvents.length}</div>
              <p className="text-xs text-muted-foreground">
                AI processed and ready
              </p>
            </CardContent>
          </Card>
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="scrape" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="scrape" className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              Scrape Events
            </TabsTrigger>
            
            <TabsTrigger value="process" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Process
            </TabsTrigger>

            <TabsTrigger value="events" className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Events
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scrape" className="space-y-4">
            {/* Scraper Form */}
            <Card>
              <CardHeader>
                <CardTitle>Scrape a Website for Events</CardTitle>
                <CardDescription>Enter a URL to scrape event data using Puppeteer.</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Error box above input */}
                {scrapeError && (
                  <div className="mb-4 p-3 rounded border border-red-400 bg-red-100 text-red-800 text-sm font-medium">
                    {scrapeError}
                  </div>
                )}
                <form onSubmit={handleScrapeSubmit} className="flex flex-col gap-4 md:flex-row md:items-end">
                  <div className="flex-1">
                    <label htmlFor="scrape-url" className="block text-sm font-medium mb-1">Event Source URL</label>
                    <input
                      id="scrape-url"
                      type="url"
                      required
                      value={scrapeUrl}
                      onChange={e => setScrapeUrl(e.target.value)}
                      placeholder="https://example.com/events"
                      className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                    />
                  </div>
                  <Button type="submit" className="mt-2 md:mt-0" disabled={scrapeLoading}>
                    {scrapeLoading ? (
                      <>
                        <Search className="w-4 h-4 mr-2 animate-spin" />
                        Scraping...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4 mr-2" />
                        Scrape
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Pending Listings Section */}
            {loadingListings ? (
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">Loading pending listings...</div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Pending Scraped Listings ({pendingListings.length})</CardTitle>
                  <CardDescription>
                    Review and approve scraped events before they go live
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {pendingListings.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No pending listings found. Scrape some websites to get started!
                    </div>
                  ) : (
                    <div className="grid gap-6">
                      {pendingListings.map(item => {
                        const isProcessing = processingItems.has(item.id);
                        return (
                          <div key={item.id} className="rounded-xl border p-4 flex gap-6 bg-background shadow-sm">
                            <div className="flex-shrink-0">
                              {item.image_url ? (
                                <img src={item.image_url} alt={item.title} className="w-60 h-32 object-cover rounded-lg" />
                              ) : (
                                <div className="w-40 h-28 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400">No Image</div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-2 mb-1">
                                <div className="flex-1">
                                  <h3 className="font-bold text-xl leading-tight mb-1" title={item.title}>{item.title}</h3>
                                  <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-yellow-100 text-yellow-800">
                                    pending
                                  </span>
                                </div>
                                <div className="flex gap-2 ml-4">
                                  <button 
                                    onClick={() => handleReject(item.id)}
                                    disabled={isProcessing}
                                    className="bg-red-600 text-white px-4 py-2 rounded font-semibold hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {isProcessing ? 'Processing...' : 'Reject'}
                                  </button>
                                  <button 
                                    onClick={() => handleApprove(item.id)}
                                    disabled={isProcessing}
                                    className="bg-green-600 text-white px-4 py-2 rounded font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {isProcessing ? 'Processing...' : 'Approve for Processing'}
                                  </button>
                                </div>
                              </div>
                              <div className="text-sm mb-1">
                                Source: <a href={item.url} className="text-blue-600 underline break-all" target="_blank" rel="noopener noreferrer">{item.url}</a>
                              </div>
                              <div className="text-xs text-gray-500">
                                Added: {item.created_at ? new Date(item.created_at).toLocaleString() : '-'}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            
          </TabsContent>

          <TabsContent value="review" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Events Pending Review</CardTitle>
                <CardDescription>
                  Review and approve events before they go live
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Sample pending events */}
                  <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          Singapore Food Festival 2024
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Marina Bay • Dec 18-20, 2024
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">
                        <Clock className="w-3 h-3 mr-1" />
                        Pending
                      </Badge>
                      <Button size="sm">Review</Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-secondary/50 rounded-lg flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-secondary-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          Tech Startup Meetup
                        </p>
                        <p className="text-sm text-muted-foreground">
                          One Raffles Place • Dec 22, 2024
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Flagged
                      </Badge>
                      <Button size="sm" variant="outline">Review</Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-accent/50 rounded-lg flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-accent-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          Christmas Market at Orchard
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Orchard Road • Dec 24-25, 2024
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">
                        <Clock className="w-3 h-3 mr-1" />
                        Pending
                      </Badge>
                      <Button size="sm">Review</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="process" className="space-y-4">
            {/* Direct URL Addition Form - Enhanced with section background */}
            <div className="section-bg-soft p-6 rounded-lg">
              <Card className="card-enhanced">
              <CardHeader>
                <CardTitle>Add URL Directly to Processing Queue</CardTitle>
                <CardDescription>Add a URL directly to be processed with FireCrawl and AI without scraping first.</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Error box above input */}
                {directUrlError && (
                  <div className="mb-4 p-3 rounded border border-red-400 bg-red-100 text-red-800 text-sm font-medium">
                    {directUrlError}
                  </div>
                )}
                <form onSubmit={handleDirectUrlSubmit} className="flex flex-col gap-4 md:flex-row md:items-end">
                  <div className="flex-1">
                    <label htmlFor="direct-url" className="block text-sm font-medium mb-1">Event URL</label>
                    <input
                      id="direct-url"
                      type="url"
                      required
                      value={directUrl}
                      onChange={e => setDirectUrl(e.target.value)}
                      placeholder="https://example.com/event-page"
                      className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                    />
                  </div>
                  <Button type="submit" className="mt-2 md:mt-0" disabled={directUrlLoading}>
                    {directUrlLoading ? (
                      <>
                        <Clock className="w-4 h-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Database className="w-4 h-4 mr-2" />
                        Add to Queue
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
            </div>

            {/* Processing Queue */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Processing Queue</CardTitle>
                    <CardDescription>
                      Items waiting to be processed with FireCrawl and AI
                      {autoRefresh && (
                        <span className="ml-2 inline-flex items-center text-xs text-blue-600">
                          <Clock className="w-3 h-3 mr-1 animate-spin" />
                          Auto-refreshing...
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={triggerQueueProcessing}
                    disabled={queueProcessing || processingQueue.filter(item => item.queued_for_processing).length === 0}
                    className="ml-4"
                  >
                    {queueProcessing ? (
                      <>
                        <Clock className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Database className="w-4 h-4 mr-2" />
                        Process with FireCrawl + AI ({processingQueue.filter(item => item.queued_for_processing).length})
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingListings ? (
                  <div className="text-center py-8">Loading queue items...</div>
                ) : processingQueue.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No items in processing queue. Add URLs above or approve pending listings!
                  </div>
                ) : (
                  <div className="space-y-4">
                    {processingQueue.map(item => {
                      const getStatusBadge = () => {
                        if (item.processing_started_at) {
                          return <Badge variant="outline" className="bg-blue-100 text-blue-800">
                            <Clock className="w-3 h-3 mr-1 animate-spin" />
                            Processing...
                          </Badge>;
                        } else if (item.status === 'approved' && item.queued_for_processing) {
                          return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Queued for Processing</Badge>;
                        } else if (item.status === 'error' && item.queued_for_processing) {
                          return <Badge variant="outline" className="bg-orange-100 text-orange-800">Queued for Retry</Badge>;
                        }
                        return <Badge variant="outline">In Queue</Badge>;
                      };

                      const getTimestamp = () => {
                        if (item.processing_started_at) {
                          return `Processing started: ${new Date(item.processing_started_at).toLocaleString()}`;
                        }
                        return `Added to queue: ${new Date(item.updated_at).toLocaleString()}`;
                      };

                      return (
                        <div key={item.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                              {item.processing_started_at ? (
                                <Clock className="w-6 h-6 text-primary animate-spin" />
                              ) : (
                                <Calendar className="w-6 h-6 text-primary" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{item.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {item.url}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {getTimestamp()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {getStatusBadge()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Error Items */}
            {errorItems.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Failed Processing Items ({errorItems.length})</CardTitle>
                  <CardDescription>
                    Items that failed processing and need to be retried
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {errorItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                            <AlertCircle className="w-6 h-6 text-red-600" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{item.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.url}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Failed: {new Date(item.updated_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="destructive">Processing Error</Badge>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleRetryProcessing(item.id)}
                            disabled={processingItems.has(item.id)}
                            className="text-orange-600 border-orange-600 hover:bg-orange-50"
                          >
                            {processingItems.has(item.id) ? (
                              <>
                                <Clock className="w-3 h-3 mr-1 animate-spin" />
                                Retrying...
                              </>
                            ) : (
                              'Retry Processing'
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            {/* Processed Events */}
            <Card>
              <CardHeader>
                <CardTitle>Processed Events ({processedEvents.length})</CardTitle>
                <CardDescription>
                  Events that have been successfully processed with AI and added to the events database
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingListings ? (
                  <div className="text-center py-8">Loading processed events...</div>
                ) : processedEvents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No processed events found. Process some URLs to see them here!
                  </div>
                ) : (
                  <div className="space-y-4">
                    {processedEvents.map(event => (
                      <div key={event.id} className="rounded-xl border p-4 flex gap-6 bg-background shadow-sm">
                        <div className="flex-shrink-0">
                          {event.image_url ? (
                            <img src={event.image_url} alt={event.event_name} className="w-60 h-32 object-cover rounded-lg" />
                          ) : (
                            <div className="w-40 h-28 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400">No Image</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2 mb-1">
                            <div className="flex-1">
                              <h3 className="font-bold text-xl leading-tight mb-1" title={event.event_name}>{event.event_name}</h3>
                              <Badge className="bg-green-100 text-green-800 mb-2">AI Processed</Badge>
                              <div className="text-sm mb-1">
                                <strong>Date:</strong> {event.start_date ? new Date(event.start_date).toLocaleDateString() : 'Not specified'}
                              </div>
                              <div className="text-sm mb-1">
                                <strong>Location:</strong> {event.location_text || 'Not specified'}
                              </div>
                              <div className="text-sm mb-2">
                                <strong>Description:</strong> {event.description ? event.description.substring(0, 150) + '...' : 'Not available'}
                              </div>
                            </div>
                            <div className="flex gap-2 ml-4">
                              <Button size="sm" variant="outline" onClick={() => handleViewEvent(event)}>
                                <Eye className="w-3 h-3 mr-1" />
                                View Full Details
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleEditEvent(event)}>
                                <Edit className="w-3 h-3 mr-1" />
                                Edit Event
                              </Button>
                            </div>
                          </div>
                          <div className="text-sm mb-1">
                            Source: <a href={event.page_url} className="text-blue-600 underline break-all" target="_blank" rel="noopener noreferrer">{event.page_url}</a>
                          </div>
                          <div className="text-xs text-gray-500">
                            Processed: {event.updated_at ? new Date(event.updated_at).toLocaleString() : '-'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* View Event Details Modal */}
        {isViewModalOpen && selectedEvent && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={(e) => {
              // Close modal when clicking on backdrop
              if (e.target === e.currentTarget) {
                closeViewModal();
              }
            }}
            onKeyDown={(e) => {
              console.log('Modal keydown:', e.key, e.code, e.which);
              if (e.key === 'Escape' || e.code === 'Escape' || e.which === 27) {
                e.preventDefault();
                e.stopPropagation();
                closeViewModal();
              }
            }}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
          >
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-bold">Event Details</h2>
                <Button variant="ghost" size="sm" onClick={closeViewModal}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="p-6 space-y-4">
                {selectedEvent.image_url && (
                  <img 
                    src={selectedEvent.image_url} 
                    alt={selectedEvent.event_name || 'Event image'}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                )}
                <div>
                  <h3 className="font-semibold text-lg mb-4">{selectedEvent.event_name || 'Untitled Event'}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {Object.entries(selectedEvent).map(([key, value]) => {
                      // Skip certain fields or format them specially
                      if (key === 'image_url' || key === 'event_name') return null;
                      
                      const formatValue = (val: any) => {
                        if (val === null || val === undefined) return 'Not specified';
                        if (typeof val === 'boolean') return val ? 'Yes' : 'No';
                        if (key.includes('date') || key.includes('time')) {
                          try {
                            const date = new Date(val);
                            // For date-only fields, show just the date
                            if (key === 'start_date' || key === 'end_date') {
                              return date.toLocaleDateString();
                            }
                            // For timestamp fields, show full date and time
                            return date.toLocaleString();
                          } catch {
                            return val.toString();
                          }
                        }
                        if (key === 'page_url' && val) {
                          return (
                            <a href={val} className="text-blue-600 underline break-all" target="_blank" rel="noopener noreferrer">
                              {val}
                            </a>
                          );
                        }
                        if (typeof val === 'string' && val.length > 100) {
                          return val;
                        }
                        return val.toString();
                      };

                      const formatFieldName = (fieldName: string) => {
                        return fieldName
                          .split('_')
                          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                          .join(' ');
                      };

                      const isLongText = typeof value === 'string' && value.length > 100;
                      const colSpan = isLongText ? 'md:col-span-2' : '';

                      return (
                        <div key={key} className={colSpan}>
                          <strong>{formatFieldName(key)}:</strong>
                          <div className={`mt-1 ${isLongText ? 'whitespace-pre-wrap' : ''}`}>
                            {formatValue(value)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Event Modal */}
        {isEditModalOpen && editingEvent && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={(e) => {
              // Close modal when clicking on backdrop
              if (e.target === e.currentTarget) {
                closeEditModal();
              }
            }}
            onKeyDown={(e) => {
              console.log('Edit modal keydown:', e.key, e.code, e.which);
              if (e.key === 'Escape' || e.code === 'Escape' || e.which === 27) {
                console.log('Edit modal detected Escape - closing edit modal');
                e.preventDefault();
                e.stopPropagation();
                closeEditModal();
              }
            }}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
          >
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-bold">Edit Event</h2>
                <Button variant="ghost" size="sm" onClick={closeEditModal}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <form onSubmit={handleUpdateEvent} className="p-6 space-y-4">
                {updateError && (
                  <div className="p-3 rounded border border-red-400 bg-red-100 text-red-800 text-sm">
                    {updateError}
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(editingEvent).map(([key, value]) => {
                    // Skip non-editable fields
                    if (key === 'id' || key === 'created_at' || key === 'updated_at') return null;
                    
                    const formatFieldName = (fieldName: string) => {
                      return fieldName
                        .split('_')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                    };

                    const handleFieldChange = (fieldKey: string, newValue: any) => {
                      setEditingEvent({...editingEvent, [fieldKey]: newValue});
                    };

                    const getInputType = (fieldKey: string, fieldValue: any) => {
                      // Handle specific date fields from the schema
                      if (fieldKey === 'start_date' || fieldKey === 'end_date') return 'date';
                      if (fieldKey.includes('time') || fieldKey === 'created_at' || fieldKey === 'updated_at') return 'datetime-local';
                      if (fieldKey.includes('url') || fieldKey.includes('link')) return 'url';
                      if (fieldKey.includes('email')) return 'email';
                      if (fieldKey.includes('phone')) return 'tel';
                      if (typeof fieldValue === 'number') return 'number';
                      if (typeof fieldValue === 'boolean') return 'checkbox';
                      return 'text';
                    };

                    const isLongText = typeof value === 'string' && (
                      key.includes('description') || 
                      key.includes('content') || 
                      key.includes('details') ||
                      (typeof value === 'string' && value.length > 100)
                    );

                    const colSpan = isLongText ? 'md:col-span-2' : '';
                    const inputType = getInputType(key, value);
                    const isRequired = key === 'event_name';

                    if (inputType === 'checkbox') {
                      return (
                        <div key={key} className={colSpan}>
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={!!value}
                              onChange={e => handleFieldChange(key, e.target.checked)}
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm font-medium">{formatFieldName(key)}</span>
                          </label>
                        </div>
                      );
                    }

                    if (isLongText) {
                      return (
                        <div key={key} className={colSpan}>
                          <label htmlFor={key} className="block text-sm font-medium mb-1">
                            {formatFieldName(key)}
                            {isRequired && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          <textarea
                            id={key}
                            rows={4}
                            required={isRequired}
                            value={(value as string) || ''}
                            onChange={e => handleFieldChange(key, e.target.value)}
                            className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                          />
                        </div>
                      );
                    }

                    return (
                      <div key={key} className={colSpan}>
                        <label htmlFor={key} className="block text-sm font-medium mb-1">
                          {formatFieldName(key)}
                          {isRequired && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <input
                          id={key}
                          type={inputType}
                          required={isRequired}
                          value={
                            inputType === 'datetime-local' && value
                              ? (() => {
                                  try {
                                    return new Date(value as string).toISOString().slice(0, 16);
                                  } catch {
                                    return '';
                                  }
                                })()
                              : inputType === 'date' && value
                              ? (() => {
                                  try {
                                    // For date fields, just use the date part
                                    const date = new Date(value as string);
                                    return date.toISOString().slice(0, 10);
                                  } catch {
                                    return '';
                                  }
                                })()
                              : (value as string) || ''
                          }
                          onChange={e => {
                            let newValue: any = e.target.value;
                            if (inputType === 'datetime-local' && newValue) {
                              newValue = new Date(newValue).toISOString();
                            } else if (inputType === 'date' && newValue) {
                              // For date fields, keep as date string (YYYY-MM-DD)
                              newValue = newValue;
                            } else if (inputType === 'number') {
                              newValue = parseFloat(newValue) || 0;
                            }
                            handleFieldChange(key, newValue);
                          }}
                          className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={closeEditModal}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateLoading}>
                    {updateLoading ? (
                      <>
                        <Clock className="w-4 h-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Update Event'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}