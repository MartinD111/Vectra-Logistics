import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import 'leaflet/dist/leaflet.css'
import Navbar from '@/components/Navbar'
import { Providers } from '@/components/Providers'
import SmartActionsToast from '@/components/SmartActionsToast'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Vectra Marketplace',
  description: 'Find and offer freight capacity on the Vectra network.',
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
          <SmartActionsToast />
        </Providers>
      </body>
    </html>
  )
}
