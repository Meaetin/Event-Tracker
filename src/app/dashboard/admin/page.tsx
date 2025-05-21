"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase/supabaseClient';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';

interface ScrapedEvent {
  id: number;
  article_title: string;
  article_url: string;
  image_url: string;
  status?: string;
}

export default function AdminDashboard() {
  const { user: authUser, signOut, isLoading: authLoading } = useAuth();
  const [admin, setAdmin] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<ScrapedEvent[]>([]);
  const [error, setError] = useState('');
  const [activeView, setActiveView] = useState('review');

  // Fetch events from DB with timeout
  const fetchEvents = useCallback(async () => {
    console.log('Starting fetchEvents...');
    
    // Create a timeout promise
    const timeout = new Promise<ScrapedEvent[]>((_, reject) => {
      setTimeout(() => reject(new Error('Fetch events timeout')), 5000);
    });

    try {
      // Race between the fetch and timeout
      const result = await Promise.race([
        (async () => {
          const { data, error } = await supabase
            .from('scraped_events')
            .select('*')
            .order('id', { ascending: false });
          
          if (error) throw error;
          return data as ScrapedEvent[];
        })(),
        timeout
      ]);

      console.log('Fetch events successful:', result);
      setEvents(result || []);
    } catch (err: any) {
      console.error('Error in fetchEvents:', err);
      // Don't show timeout errors to the user, just refresh the page
      if (err.message === 'Fetch events timeout') {
        console.log('Fetch timeout, refreshing events...');
        window.location.reload();
        return;
      }
      setError(err.message);
    }
  }, []);

  // Load admin data
  const loadAdminData = useCallback(async () => {
    if (!authUser) {
      router.push('/auth/login');
      return;
    }

    try {
      // Get admin profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profileError) throw profileError;

      // Verify admin role
      if (!profile || profile.role !== 'admin') {
        router.push('/dashboard/user');
        return;
      }

      setAdmin(profile);

      // Get all users
      const { data: allUsers, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;
      setUsers(allUsers || []);

      // Initial events fetch
      await fetchEvents();
    } catch (error: any) {
      console.error('Error loading admin data:', error);
      setError('Failed to load admin data: ' + error.message);
    } finally {
      setPageLoading(false);
    }
  }, [authUser, router, fetchEvents]);

  useEffect(() => {
    if (!authLoading) {
      loadAdminData();
    }
  }, [authLoading, loadAdminData]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/auth/login');
  };

  async function handleUpdateUserRole(userId: string, newRole: string) {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (!error) {
      // Update the local state
      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ));
    }
  }

  // Handle scraping
  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim() || scraping) return;

    setScraping(true);
    setError('');
    console.log('Starting scrape process...');

    try {
      // First validate the URL
      try {
        new URL(url);
      } catch {
        throw new Error('Please enter a valid URL');
      }

      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ url: url.trim() })
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        throw new Error('Failed to parse server response');
      }

      if (!response.ok) {
        throw new Error(data.error || `Failed to scrape (${response.status})`);
      }

      if (!data || (Array.isArray(data) && data.length === 0)) {
        throw new Error('No content found to scrape from this URL');
      }

      console.log('Scrape successful, clearing URL...');
      setUrl('');
      
      console.log('Fetching updated events...');
      try {
        await fetchEvents();
        console.log('Events fetch completed');
      } catch (fetchError) {
        console.error('Error fetching events after scrape:', fetchError);
        // If fetching events fails, reload the page
        window.location.reload();
      }
      
    } catch (err: any) {
      console.error('Scraping error:', err);
      setError(err.message || 'Failed to scrape content');
    } finally {
      setScraping(false);
    }
  };

  // Handle event deletion
  const handleDeleteEvent = async (eventId: number) => {
    try {
      setError('');
      const { error } = await supabase
        .from('scraped_events')
        .delete()
        .eq('id', eventId);
      
      if (error) throw error;
      
      // Update local state after successful deletion
      
      setEvents(prevEvents => prevEvents.filter(event => event.id !== eventId));
      console.log('Event deleted successfully');
    } catch (err: any) {
      console.error('Error deleting event:', err);
      setError('Failed to delete event: ' + (err.message || 'Unknown error'));
    }
  };

  // Handle event approval
  const handleApproveEvent = async (eventId: number) => {
    try {
      setError('');
      const { error } = await supabase
        .from('scraped_events')
        .update({ status: 'approved' })
        .eq('id', eventId);
      
      if (error) throw error;
      
      // Update local state after successful approval
      setEvents(prevEvents => 
        prevEvents.map(event => 
          event.id === eventId 
            ? { ...event, status: 'approved' } 
            : event
        )
      );
      console.log('Event approved successfully');
    } catch (err: any) {
      console.error('Error approving event:', err);
      setError('Failed to approve event: ' + (err.message || 'Unknown error'));
    }
  };

  if (authLoading || pageLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!authUser || !admin) {
    return null; // Let the redirect happen
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Sign Out
          </button>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Welcome, Admin {admin?.full_name}</h2>
          <p className="text-gray-600">Email: {admin?.email}</p>
        </div>
      </div>

      {/* User Management Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">User Management</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead>
              <tr className="w-full h-16 border-b border-gray-200 bg-gray-50">
                <th className="text-left pl-4">Name</th>
                <th className="text-left">Email</th>
                <th className="text-left">Role</th>
                <th className="text-left">Created</th>
                <th className="text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="h-16 border-b border-gray-200">
                  <td className="pl-4">{user.full_name}</td>
                  <td>{user.email}</td>
                  <td>{user.role || 'user'}</td>
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td>
                    <select 
                      value={user.role || 'user'} 
                      onChange={(e) => handleUpdateUserRole(user.id, e.target.value)}
                      className="border rounded p-1 text-sm"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 max-w-2xl mx-auto">
        <h2 className="text-2xl font-semibold mb-4">Admin Scraper Dashboard</h2>
        
        <div className="mb-4 flex border-b">
          <button 
            className={`py-2 px-6 ${
              activeView === 'review' 
                ? 'border-b-2 border-blue-500 text-blue-500 font-medium' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveView('review')}
          >
            Review Events
          </button>
          <button 
            className={`py-2 px-6 ${
              activeView === 'current' 
                ? 'border-b-2 border-blue-500 text-blue-500 font-medium' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveView('current')}
          >
            Current Events
          </button>
        </div>
        
        <form onSubmit={handleScrape} className="flex gap-2 mb-6">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="Enter URL to scrape"
            className="flex-1 border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            disabled={scraping}
            required
          />
          <button
            type="submit"
            disabled={scraping || !url.trim()}
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
              'Scrape'
            )}
          </button>
        </form>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg flex items-center">
            <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
            </svg>
            {error}
          </div>
        )}
        
        <div className="space-y-3">
          {events.map(event => (
            <div key={event.id} className="border rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
              <div className="p-3 flex gap-4">
                <div className="w-1/3">
                  <img 
                    src={event.image_url} 
                    alt={event.article_title} 
                    className="w-full h-32 object-cover rounded-lg" 
                  />
                </div>
                <div className="w-2/3 flex flex-col">
                  <h3 className="text-base font-medium text-gray-900 line-clamp-2 mb-2">
                    {event.article_title}
                  </h3>
                  
                  <div className="mt-auto flex gap-1">
                    <a 
                      href={event.article_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex-1 py-1.5 text-center text-sm bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg transition-colors"
                    >
                      Visit URL
                    </a>
                    <button 
                      onClick={() => handleApproveEvent(event.id)}
                      disabled={event.status === 'approved'}
                      className={`flex-1 py-1.5 text-sm text-center text-white rounded-lg transition-colors ${
                        event.status === 'approved'
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-emerald-400 hover:bg-emerald-500'
                      }`}
                    > 
                      {event.status === 'approved' ? 'Approved' : 'Approve'}
                    </button>
                    <button 
                      onClick={() => handleDeleteEvent(event.id)}
                      className="px-3 py-1.5 text-sm bg-red-400 hover:bg-red-500 text-white rounded-lg transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 