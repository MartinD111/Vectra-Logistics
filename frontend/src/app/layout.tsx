import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import 'leaflet/dist/leaflet.css'
import Navbar from '@/components/layout/Navbar'
import { Providers } from '@/components/layout/Providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'VECTRA - Intelligent Freight Marketplace',
  description: 'Monetize unused truck capacity with dynamic LTL consolidation.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <Providers>
          <Navbar />
          <main className="flex-1 w-full relative">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
