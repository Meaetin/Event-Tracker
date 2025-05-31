import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Navigation from './components/Navigation';
import { AuthProvider } from './context/AuthContext';
import { Suspense } from 'react';
import { StagewiseToolbar } from '@stagewise/toolbar-next';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'EventScapeSG',
  description: 'Discover events happening around Singapore with EventScapeSG',
};

function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <Suspense fallback={<LoadingSpinner />}>
            <Navigation />
            <main>
              {children}
            </main>
          </Suspense>
        </AuthProvider>
        {process.env.NODE_ENV === 'development' && (
          <StagewiseToolbar config={{ plugins: [] }} />
        )}
      </body>
    </html>
  );
}
