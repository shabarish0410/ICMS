'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { motion } from 'framer-motion';

// Map path segments to readable labels
const labelMap: Record<string, string> = {
  dashboard: 'Dashboard',
  students: 'Students',
  teams: 'Teams',
  projects: 'Projects',
  forms: 'Forms',
  attendance: 'Attendance',
  snapshots: 'Snapshots',
  'weekly-reports': 'Weekly Reports',
  announcements: 'Announcements',
  meetings: 'Meetings',
  events: 'Events',
  notifications: 'Notifications',
  admins: 'Admins',
  'uniform-management': 'Uniform Management',
  achievements: 'Approvals',
  settings: 'Settings',
  logs: 'Logs',
  equipment: 'Equipment',
  users: 'Users',
};

function toLabel(segment: string): string {
  return labelMap[segment] || segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  // Don't render on root /dashboard
  if (segments.length <= 1) return null;

  const crumbs = segments.map((seg, idx) => {
    const href = '/' + segments.slice(0, idx + 1).join('/');
    const isLast = idx === segments.length - 1;
    const label = toLabel(seg);

    // Skip numeric IDs in breadcrumb labels (show only if there's a label)
    const isId = /^\d+$/.test(seg);
    return { href, label: isId ? `#${seg}` : label, isLast };
  });

  return (
    <motion.nav
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 px-6 md:px-8 py-2.5 text-xs text-dark-400 dark:text-dark-500 border-b border-dark-100/60 dark:border-white/5 bg-white/60 dark:bg-transparent backdrop-blur-sm"
    >
      <Link
        href="/dashboard"
        className="flex items-center gap-1 text-dark-400 dark:text-dark-500 hover:text-brand-indigo dark:hover:text-brand-cyan transition-colors font-medium"
      >
        <Home className="w-3 h-3" />
        <span className="hidden sm:inline">Home</span>
      </Link>

      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1.5">
          <ChevronRight className="w-3 h-3 text-dark-300 dark:text-dark-600 flex-shrink-0" />
          {crumb.isLast ? (
            <span className="font-semibold text-dark-700 dark:text-dark-300">
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className="font-medium text-dark-400 dark:text-dark-500 hover:text-brand-indigo dark:hover:text-brand-cyan transition-colors"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </motion.nav>
  );
}
