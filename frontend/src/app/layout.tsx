import type { Metadata, Viewport } from 'next';
import './globals.css';
import Providers from '@/context/Providers';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export const metadata: Metadata = {
  title: 'Spark Innovation Center',
  description: 'A comprehensive management system for the Spark Innovation Center. Manage students, projects, events, and more.',
  keywords: ['spark', 'innovation center', 'management system', 'education', 'projects', 'hackathons'],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Spark IC',
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
