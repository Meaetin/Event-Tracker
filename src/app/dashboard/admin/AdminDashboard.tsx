"use client";

import { useState } from "react";

export default function AdminDashboard() {
  const [activeView, setActiveView] = useState('scrape');


  return (
    <>
    <div className="container flex items-center flex-col">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      {/* Scrape Content */}
      <div className="flex items-center gap-4 py-4">
        <button className={`py-2 px-6 transition-colors ${
              activeView === 'scrape' 
                ? 'border-b-2 border-blue-500 text-blue-500 font-medium' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveView('scrape')}>Scrape Events</button>
        <button className={`py-2 px-6 transition-colors ${
              activeView === 'review' 
                ? 'border-b-2 border-blue-500 text-blue-500 font-medium' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveView('review')}>Review Events</button>
        <button className={`py-2 px-6 transition-colors ${
              activeView === 'approved' 
                ? 'border-b-2 border-blue-500 text-blue-500 font-medium' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveView('approved')}>Approved Events</button>
      </div>
    </div>
    </>
  );
}