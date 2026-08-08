'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  GraduationCap,
  Users2,
  FolderKanban,
  Calendar,
  Bell,
  Settings,
  ClipboardList,
  FileText,
  Megaphone,
  Video,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Shield,
  UserCheck,
  FileBadge,
  Shirt,
  Sparkles,
  UserCircle,
} from 'lucide-react';

// ─── Menu Definitions ─────────────────────────────────────────────────────────

const adminGroups = [
  {
    label: null,
    items: [{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'People',
    items: [
      { label: 'Students', href: '/dashboard/students', icon: GraduationCap },
      { label: 'Teams', href: '/dashboard/teams', icon: Users2 },
      { label: 'Admins', href: '/dashboard/admins', icon: Shield },
    ],
  },
  {
    label: 'Academic',
    items: [
      { label: 'Projects', href: '/dashboard/projects', icon: FolderKanban },
      { label: 'Forms', href: '/dashboard/forms', icon: ClipboardList },
      { label: 'Weekly Reports', href: '/dashboard/weekly-reports', icon: FileText },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Attendance', href: '/dashboard/attendance', icon: UserCheck },
      { label: 'Uniform Mgmt', href: '/dashboard/admins/uniform-management', icon: Shirt },
      { label: 'Approvals', href: '/dashboard/admins/achievements', icon: FileBadge },
    ],
  },
  {
    label: 'Communications',
    items: [
      { label: 'Announcements', href: '/dashboard/announcements', icon: Megaphone },
      { label: 'Meetings', href: '/dashboard/meetings', icon: Video },
      { label: 'Events', href: '/dashboard/events', icon: Calendar },
      { label: 'Notifications', href: '/dashboard/notifications', icon: Bell },
    ],
  },
];

const studentGroups = [
  {
    label: null,
    items: [{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Academic',
    items: [
      { label: 'My Project', href: '/dashboard/projects', icon: FolderKanban },
      { label: 'Forms', href: '/dashboard/forms', icon: ClipboardList },
      { label: 'Weekly Reports', href: '/dashboard/weekly-reports', icon: FileText },
      { label: 'Attendance', href: '/dashboard/attendance', icon: UserCheck },
    ],
  },
  {
    label: 'Communications',
    items: [
      { label: 'Meetings', href: '/dashboard/meetings', icon: Video },
      { label: 'Announcements', href: '/dashboard/announcements', icon: Megaphone },
      { label: 'Events', href: '/dashboard/events', icon: Calendar },
      { label: 'Notifications', href: '/dashboard/notifications', icon: Bell },
    ],
  },
];

// ─── Nav Item ─────────────────────────────────────────────────────────────────
function NavItem({
  item,
  collapsed,
  isActive,
}: {
  item: { label: string; href: string; icon: any };
  collapsed: boolean;
  isActive: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link href={item.href}>
      <div
        title={collapsed ? item.label : undefined}
        className={`
          flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium
          transition-all duration-200 cursor-pointer select-none
          ${collapsed ? 'justify-center' : ''}
          ${
            isActive
              ? 'bg-[#2563EB] text-white'
              : 'text-slate-400 hover:bg-[#1E293B] hover:text-slate-100'
          }
        `}
      >
        <Icon
          className={`flex-shrink-0 w-4 h-4 transition-colors duration-200 ${
            isActive ? 'text-white' : 'text-slate-400'
          }`}
        />
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="truncate whitespace-nowrap overflow-hidden"
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </Link>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user, isAdmin, logout } = useAuth();

  const groups = isAdmin ? adminGroups : studentGroups;

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === href
      : pathname === href || pathname.startsWith(href + '/');

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '??';

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 68 : 248 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 left-0 h-screen z-40 hidden lg:flex flex-col overflow-hidden"
      style={{ backgroundColor: '#0F172A' }}
    >
      {/* ── Logo ── */}
      <div
        className="h-16 flex items-center gap-3 px-4 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Logo mark */}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md overflow-hidden bg-white">
          <Image src="/logo.jpg" alt="Spark Logo" width={32} height={32} className="object-cover w-full h-full" />
        </div>

        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col min-w-0"
            >
              <span className="text-white text-sm font-bold truncate leading-tight tracking-tight">
                Spark IC
              </span>
              <span className="text-slate-500 text-[10px] font-medium uppercase tracking-widest truncate">
                Management System
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-hide">
        {groups.map((group, gIdx) => (
          <div key={gIdx} className={gIdx > 0 ? 'mt-3' : ''}>
            {/* Section label */}
            {group.label && !collapsed && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 select-none">
                {group.label}
              </p>
            )}
            {group.label && collapsed && (
              <div className="mx-auto my-2 w-6 h-px bg-slate-800" />
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItem
                  key={item.href}
                  item={item}
                  collapsed={collapsed}
                  isActive={isActive(item.href)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Footer ── */}
      <div
        className="flex-shrink-0 p-3 space-y-1"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Profile */}
        <NavItem
          item={{ label: 'Profile & Settings', href: '/dashboard/profile', icon: UserCircle }}
          collapsed={collapsed}
          isActive={isActive('/dashboard/profile')}
        />

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`
            w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium
            text-slate-500 hover:bg-[#1E293B] hover:text-slate-200
            transition-all duration-200
            ${collapsed ? 'justify-center' : ''}
          `}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <motion.div animate={{ rotate: collapsed ? 0 : 180 }} transition={{ duration: 0.3 }}>
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
          </motion.div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="whitespace-nowrap"
              >
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* User profile */}
        {user && (
          <div
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-xl mt-1
              transition-all duration-200
              ${collapsed ? 'justify-center' : ''}
            `}
            style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
          >
            {/* Avatar */}
            <div className="w-7 h-7 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
              {(user as any).face_image_url ? (
                <img
                  src={(user as any).face_image_url}
                  alt={user.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                initials
              )}
            </div>

            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex-1 min-w-0"
                >
                  <p className="text-xs font-semibold text-white truncate leading-tight">
                    {user.full_name}
                  </p>
                  <p className="text-[10px] text-slate-400 capitalize truncate">
                    {user.role?.name?.replace('_', ' ') || '—'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {!collapsed && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={logout}
                  title="Sign out"
                  className="flex-shrink-0 p-1 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.aside>
  );
}
