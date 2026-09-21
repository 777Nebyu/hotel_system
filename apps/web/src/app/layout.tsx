import type { Metadata, Viewport } from 'next'
import './globals.css'
import NavBar from '@/components/NavBar'
import { AppProviders } from '@/providers/AppProviders'

export const metadata: Metadata = {
  title: {
    default: 'LuxStay — Curated Stays & Grand Resorts',
    template: '%s | LuxStay',
  },
  description:
    'Experience extraordinary luxury hospitality, curated boutique suites, and five-star grand resorts with LuxStay. Instant confirmation and transparent pricing.',
  keywords: [
    'luxury hotels',
    'five star hotel booking',
    'boutique resorts',
    'LuxStay hospitality',
    'executive suites',
  ],
  authors: [{ name: 'LuxStay Global' }],
  creator: 'LuxStay',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'LuxStay',
    title: 'LuxStay — Curated Stays & Grand Resorts',
    description: 'Experience extraordinary luxury hospitality, boutique suites, and grand resorts.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LuxStay — Curated Stays & Grand Resorts',
    description: 'Experience extraordinary luxury hospitality, boutique suites, and grand resorts.',
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0F2942',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F8FAFC] text-[#0F172A] selection:bg-[#D4AF37]/30 selection:text-[#0F2942]">
        <AppProviders>
          <NavBar />
          <main className="pt-18">{children}</main>
        </AppProviders>
      </body>
    </html>
  )
}