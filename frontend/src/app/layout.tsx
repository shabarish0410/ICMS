import type { Metadata, Viewport } from 'next';
import { Inter, Poppins, Space_Grotesk } from 'next/font/google';
import './globals.css';
import Providers from '@/context/Providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const poppins = Poppins({ weight: ['400', '500', '600', '700'], subsets: ['latin'], variable: '--font-poppins' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });

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
  icons: {
    icon: '/logo.jpg',
    shortcut: '/logo.jpg',
    apple: '/logo.jpg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${poppins.variable} ${spaceGrotesk.variable}`}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/logo.jpg" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
