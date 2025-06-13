"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Users, 
  Calendar,
  TrendingUp,
  Database
} from 'lucide-react';

export default function AdminDashboard() {
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
              <div className="text-2xl font-bold">23</div>
              <p className="text-xs text-muted-foreground">
                Requires attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">892</div>
              <p className="text-xs text-muted-foreground">
                +5% from last week
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
            <Card>
              <CardHeader>
                <CardTitle>Event Scraping</CardTitle>
                <CardDescription>
                  Scrape events from various sources and add them to the database
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Last Scrape</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium">Date:</span> Dec 10, 2024 14:30
                        </p>
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium">Events Found:</span> 45 new events
                        </p>
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium">Status:</span> 
                          <Badge variant="secondary" className="ml-2">Completed</Badge>
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button className="w-full">
                        <Search className="w-4 h-4 mr-2" />
                        Start New Scrape
                      </Button>
                      <Button variant="outline" className="w-full">
                        View Scrape History
                      </Button>
                      <Button variant="outline" className="w-full">
                        Configure Sources
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
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