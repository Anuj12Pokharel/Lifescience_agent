import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/lib/auth-context'
import { ReactQueryProvider } from '@/lib/query-client'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'Life Science AI - Advanced AI for Research & Lab Management',
  description: 'Intelligent life science platform with AI-powered research assistance, lab booking, and inquiry management. Streamline your scientific workflow with specialised AI agents.',
  keywords: [
    'life science AI',
    'research assistant',
    'lab management',
    'scientific AI',
    'biotechnology',
    'genomics AI',
    'proteomics assistant',
    'clinical trials',
    'laboratory scheduling',
    'research automation',
    'bioinformatics',
    'molecular biology',
    'drug discovery',
    'life science research',
    'AI lab assistant',
    'scientific workflow'
  ],
  authors: [{ name: 'LifeAI Team' }],
  creator: 'LifeAI Intelligence Platform',
  publisher: 'LifeAI',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://life-science-ai.vercel.app'),
  alternates: {
    canonical: '/',
    languages: {
      'en-US': '/',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://life-science-ai.vercel.app',
    title: 'Life Science AI - Advanced AI for Research & Lab Management',
    description: 'Intelligent life science platform with AI-powered research assistance, lab booking, and inquiry management. Streamline your scientific workflow with specialised AI agents.',
    siteName: 'Life Science AI',
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        alt: 'Life Science AI - Advanced Research Assistant',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Life Science AI - Advanced AI for Research & Lab Management',
    description: 'Intelligent life science platform with AI-powered research assistance, lab booking, and inquiry management.',
    images: ['/logo.png'],
    creator: '@lifescienceai',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
    yandex: 'your-yandex-verification-code',
    yahoo: 'your-yahoo-verification-code',
  },
  icons: {
    icon: [
      {
        url: '/logo.png',
        media: '(prefers-color-scheme: light)',
        sizes: '32x32',
      },
      {
        url: '/logo.png',
        media: '(prefers-color-scheme: dark)',
        sizes: '32x32',
      },
      {
        url: '/logo.png',
        type: 'image/svg+xml',
        sizes: 'any',
      },
    ],
    apple: [
      {
        url: '/logo.png',
        sizes: '180x180',
      },
    ],
  },
  manifest: '/site.webmanifest',
  other: {
    'msapplication-TileColor': '#020B18',
    'msapplication-config': '/browserconfig.xml',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <ReactQueryProvider>
          <AuthProvider>
            {children}
            <Toaster position="top-right" richColors />
          </AuthProvider>
        </ReactQueryProvider>
        <Analytics />
      </body>
    </html>
  )
}
