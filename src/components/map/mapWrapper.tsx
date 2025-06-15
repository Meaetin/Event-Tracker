'use client';

import dynamic from 'next/dynamic';

// Only runs on the client
const EventsMap = dynamic(() => import('./eventMap'), { ssr: false });

export default function MapClientWrapper() {
  return <EventsMap />;
}
