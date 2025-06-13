"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Calendar,
  TrendingUp,
  Database
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

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
  const [loadingListings, setLoadingListings] = useState(true);

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

  // Fetch pending listings and approved count on component load
  useEffect(() => {
    fetchListings();
  }, []);

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
              <CardTitle className="text-sm font-medium">Approved Listings</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{approvedCount}</div>
              <p className="text-xs text-muted-foreground">
                Ready for processing
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Health</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">98.5%</div>
              <p className="text-xs text-muted-foreground">
                Uptime this month
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
                      {pendingListings.map(item => (
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
                                <button className="bg-red-600 text-white px-4 py-2 rounded font-semibold hover:bg-red-700 transition">Reject</button>
                                <button className="bg-green-600 text-white px-4 py-2 rounded font-semibold hover:bg-green-700 transition">Approve for Processing</button>
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
                      ))}
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
                <CardTitle>Approved Events</CardTitle>
                <CardDescription>
                  Events that have been reviewed and approved for publication
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Sample approved events */}
                  <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          Singapore Art Exhibition
                        </p>
                        <p className="text-sm text-muted-foreground">
                          National Gallery • Dec 15-30, 2024
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Live
                      </Badge>
                      <Button size="sm" variant="outline">Edit</Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-secondary/50 rounded-lg flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-secondary-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          Night Safari Experience
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Singapore Zoo • Ongoing
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Live
                      </Badge>
                      <Button size="sm" variant="outline">Edit</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}