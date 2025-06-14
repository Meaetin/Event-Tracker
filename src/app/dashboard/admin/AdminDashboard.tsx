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
  Database
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
  const [approvedCount, setApprovedCount] = useState(0);
  const [processingQueue, setProcessingQueue] = useState<
    { id: string; title: string; url: string; image_url: string; status: string; created_at: string; queued_for_processing: boolean; updated_at: string }[]
  >([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [processingItems, setProcessingItems] = useState<Set<string>>(new Set());
  const [queueProcessing, setQueueProcessing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

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

      // Fetch approved, processed, and error items (for processing queue view)
      const { data: approved, error: approvedError } = await supabase
        .from('scraped_listings')
        .select('id, title, url, image_url, status, created_at, queued_for_processing, updated_at')
        .in('status', ['approved', 'processed', 'error'])
        .order('created_at', { ascending: false });
      
      if (approvedError) throw approvedError;
      setProcessingQueue(approved || []);

      // Fetch approved count
      const { count, error: countError } = await supabase
        .from('scraped_listings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved');
      
      if (countError) throw countError;
      setApprovedCount(count || 0);
    } catch (error) {
      console.error('Error fetching listings:', error);
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
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

          <Card>
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

          <Card>
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved Listings</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{approvedCount}</div>
              <p className="text-xs text-muted-foreground">
                Total approved items
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="scrape" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="scrape" className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              Scrape Events
            </TabsTrigger>
            <TabsTrigger value="review" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Review Events
            </TabsTrigger>
            <TabsTrigger value="approved" className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Approved Events
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
                          <div key={item.id} className="rounded-xl border p-4 flex gap-6 bg-white shadow-sm">
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

          <TabsContent value="approved" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Processing Queue & Approved Events</CardTitle>
                    <CardDescription>
                      Track FireCrawl scraping and AI processing status of approved events
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
                  <div className="text-center py-8">Loading approved items...</div>
                ) : processingQueue.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No approved items found. Approve some pending listings to see them here!
                  </div>
                ) : (
                  <div className="space-y-4">
                    {processingQueue.map(item => {
                      const getStatusBadge = () => {
                        if (item.queued_for_processing) {
                          return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Queued for Processing</Badge>;
                        } else if (item.status === 'processed') {
                          return <Badge className="bg-green-100 text-green-800">AI Processed</Badge>;
                        } else if (item.status === 'error') {
                          return <Badge variant="destructive">Processing Error</Badge>;
                        }
                        return <Badge>Approved</Badge>;
                      };

                      return (
                        <div key={item.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                              <Calendar className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{item.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {item.url}
                              </p>
                              {(item.status === 'processed' || item.status === 'error') && (
                                <p className="text-xs text-muted-foreground">
                                  {item.status === 'processed' ? 'Processed' : 'Error'}: {new Date(item.updated_at).toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {getStatusBadge()}
                            {item.status === 'processed' && (
                              <Button size="sm" variant="outline">View Details</Button>
                            )}
                            {item.status === 'error' && !item.queued_for_processing && (
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
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}