import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Navbar from '../components/Navbar';
import { AuthProvider } from '../context/AuthProvider';
import { ThemeProvider } from '../components/theme-provider';
import { Suspense } from 'react';
import { StagewiseToolbar } from '@stagewise/toolbar-next';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'EventScapeSG',
  description: 'Discover events happening around Singapore with EventScapeSG',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
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
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <Suspense fallback={<LoadingSpinner />}>
              <Navbar />
              <main>
                {children}
              </main>
            </Suspense>
          </AuthProvider>
        </ThemeProvider>
        {process.env.NODE_ENV === 'development' && (
          <StagewiseToolbar config={{ plugins: [] }} />
        )}
      </body>
    </html>
  );
}
