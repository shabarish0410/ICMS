import type { Metadata } from 'next';
import './globals.css';
import Providers from '@/context/Providers';

export const metadata: Metadata = {
  title: 'ICMS - Innovation Center Management System',
  description: 'A comprehensive management system for college Innovation Centers. Manage students, projects, events, and more.',
  keywords: ['innovation center', 'management system', 'education', 'projects', 'hackathons'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
