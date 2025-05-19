"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/supabaseClient';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';

export default function AdminDashboard() {
  const { user: authUser, signOut, isLoading: authLoading } = useAuth();
  const [admin, setAdmin] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadAdminData() {
      if (!authUser) {
        router.push('/auth/login');
        return;
      }

      // Get admin profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      // Verify admin role
      if (!profile || profile.role !== 'admin') {
        router.push('/dashboard/user');
        return;
      }

      setAdmin(profile);

      // Get all users
      const { data: allUsers } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (allUsers) {
        setUsers(allUsers);
      }

      setLoading(false);
    }

    if (!authLoading) {
      loadAdminData();
    }
  }, [authUser, authLoading, router]);

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

  // Fetch events from DB
  const fetchEvents = async () => {
    const { data, error } = await supabase.from('scraped_events').select('*').order('id', { ascending: false });
    if (error) setError(error.message);
    else setEvents(data || []);
  };

  // Scrape and upload events
  const handleScrape = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error('Scrape failed');
      await fetchEvents();
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  // Initial load
  useEffect(() => {
    fetchEvents();
  }, []);

  if (loading || authLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
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

      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-4">Admin Scraper Dashboard</h2>
        <input
          type="text"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="Enter URL to scrape"
          className="border rounded p-2"
          style={{ width: 400 }}
        />
        <button
          onClick={handleScrape}
          disabled={loading || !url}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 ml-2"
        >
          {loading ? 'Scraping...' : 'Scrape'}
        </button>
        {error && <div className="text-red-500 mt-2">{error}</div>}
        <ul className="mt-4">
          {events.map(event => (
            <li key={event.id} className="mb-2">
              <img src={event.image_url} alt={event.event_name} className="w-20 h-20 mr-4" />
              <a href={event.url} target="_blank" rel="noopener noreferrer" className="text-blue-500">{event.event_name}</a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
} 