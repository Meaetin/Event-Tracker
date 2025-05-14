'use client';

import dynamic from 'next/dynamic';

// Only runs on the client
const MyMap = dynamic(() => import('./myMap'), { ssr: false });

export default function mapClientWrapper() {
  return <MyMap />;
}
