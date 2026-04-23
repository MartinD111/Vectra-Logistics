import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '../globals.css';
import { Providers } from '@/components/layout/Providers';
import { DriverBottomNav } from '@/components/driver/DriverBottomNav';
import { DriverSWRegistrar } from '@/components/driver/DriverSWRegistrar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'VECTRA Driver',
  description: 'Driver operations terminal',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'VECTRA Driver',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#22c55e',
};

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      {/*
        Standalone driver shell: no Navbar, no sidebar.
        Safe-area insets handle iPhone notch / home bar via env().
      */}
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body
        className={`
          ${inter.className}
          bg-slate-950 text-white
          min-h-screen min-h-dvh
          flex flex-col
          overscroll-none overflow-x-hidden
        `}
      >
        <Providers>
          <DriverSWRegistrar />

          {/* Main content — pb accounts for bottom nav + iPhone home bar */}
          <main className="flex-1 flex flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">
            {children}
          </main>

          {/* Bottom navigation bar — fixed, above safe-area */}
          <DriverBottomNav />
        </Providers>
      </body>
    </html>
  );
}
