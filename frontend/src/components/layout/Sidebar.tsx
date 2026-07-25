'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard, GraduationCap, Users2, FolderKanban, Calendar,
  Bell, Settings, ClipboardList, FileText, Megaphone,
  Video, ChevronLeft, ChevronRight, LogOut, ScanFace, Shield, Shirt, UserCheck, FileBadge
} from 'lucide-react';

// ─── Admin Menu Groups ────────────────────────────────────────────────────────
const adminMenuGroups = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
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
    label: 'Attendance',
    items: [
      { label: 'Attendance', href: '/dashboard/attendance', icon: UserCheck },
      { label: 'Snapshots', href: '/dashboard/attendance/snapshots', icon: ScanFace },
    ],
  },
  {
    label: 'Communication',
    items: [
      { label: 'Announcements', href: '/dashboard/announcements', icon: Megaphone },
      { label: 'Meetings', href: '/dashboard/meetings', icon: Video },
      { label: 'Events', href: '/dashboard/events', icon: Calendar },
      { label: 'Notifications', href: '/dashboard/notifications', icon: Bell },
    ],
  },
  {
    label: 'Management',
    items: [
      { label: 'Uniform Mgmt', href: '/dashboard/admins/uniform-management', icon: Shirt },
      { label: 'Approvals', href: '/dashboard/admins/achievements', icon: FileBadge },
    ],
  },
];

// ─── Student Menu Groups ──────────────────────────────────────────────────────
const studentMenuGroups = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Academic',
    items: [
      { label: 'My Project', href: '/dashboard/projects', icon: FolderKanban },
      { label: 'Forms', href: '/dashboard/forms', icon: ClipboardList },
      { label: 'Weekly Reports', href: '/dashboard/weekly-reports', icon: FileText },
    ],
  },
  {
    label: 'Attendance',
    items: [
      { label: 'Attendance', href: '/dashboard/attendance', icon: UserCheck },
      { label: 'Snapshots', href: '/dashboard/attendance/snapshots', icon: ScanFace },
    ],
  },
  {
    label: 'Communication',
    items: [
      { label: 'Meetings', href: '/dashboard/meetings', icon: Video },
      { label: 'Announcements', href: '/dashboard/announcements', icon: Megaphone },
      { label: 'Events', href: '/dashboard/events', icon: Calendar },
      { label: 'Notifications', href: '/dashboard/notifications', icon: Bell },
    ],
  },
];

// ─── Role Badge ───────────────────────────────────────────────────────────────
function RoleBadge({ role, collapsed }: { role?: string; collapsed: boolean }) {
  if (!role || collapsed) return null;
  const isAdmin = role.toLowerCase().includes('admin');
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest ${
      isAdmin
        ? 'bg-brand-indigo/30 text-brand-cyan border border-brand-indigo/40'
        : 'bg-brand-emerald/20 text-brand-emerald border border-brand-emerald/30'
    }`}>
      {isAdmin ? 'Admin' : 'Student'}
    </span>
  );
}

// ─── Nav Item ─────────────────────────────────────────────────────────────────
function NavItem({ item, collapsed, isActive }: { item: { label: string; href: string; icon: any }; collapsed: boolean; isActive: boolean }) {
  const Icon = item.icon;
  return (
    <Link href={item.href}>
      <motion.div
        whileHover={{ x: collapsed ? 0 : 3 }}
        whileTap={{ scale: 0.97 }}
        className={`relative flex items-center h-9 rounded-xl group transition-all duration-200 ${
          isActive
            ? 'bg-white/10 text-white font-semibold'
            : 'text-white/50 hover:bg-white/5 hover:text-white/90'
        } ${collapsed ? 'justify-center w-10 mx-auto px-0' : 'px-3'}`}
        title={collapsed ? item.label : undefined}
      >
        {/* Active indicator bar */}
        {isActive && (
          <motion.div
            layoutId="navActivePill"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-gradient-to-b from-brand-cyan to-brand-indigo rounded-r-full shadow-[0_0_8px_rgba(6,182,212,0.6)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
        )}

        <Icon className={`w-[17px] h-[17px] flex-shrink-0 transition-colors duration-200 ${
          isActive
            ? 'text-brand-cyan drop-shadow-[0_0_4px_rgba(6,182,212,0.5)]'
            : 'group-hover:text-white/90'
        }`} />

        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="ml-3 text-[13px] whitespace-nowrap"
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </Link>
  );
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────
export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user, isAdmin, logout } = useAuth();

  const menuGroups = isAdmin ? adminMenuGroups : studentMenuGroups;

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === href
      : pathname === href || pathname.startsWith(href + '/');

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 256 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 left-0 h-screen z-40 hidden lg:flex flex-col bg-dark-900 border-r border-white/5 shadow-2xl"
    >
      {/* ── Logo ── */}
      <div className="h-[72px] flex items-center gap-3 px-4 shrink-0 relative overflow-hidden border-b border-white/5">
        <div className="absolute top-1/2 left-8 -translate-y-1/2 w-24 h-24 bg-brand-indigo/10 rounded-full blur-[40px] pointer-events-none" />

        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden shadow-lg bg-gradient-to-br from-brand-indigo to-brand-cyan border border-white/10 z-10 relative">
          <img
            src="/logo.jpg"
            alt="Spark Logo"
            className="w-full h-full object-cover mix-blend-screen contrast-125 brightness-110"
          />
        </div>

        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col z-10"
            >
              <h1 className="text-[15px] font-heading font-bold text-white tracking-tight leading-none">
                Spark IC
              </h1>
              <p className="text-[9px] text-brand-cyan font-semibold mt-0.5 tracking-[0.15em] uppercase">
                Management System
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 scrollbar-hide">
        {menuGroups.map((group, gIdx) => (
          <div key={group.label} className={gIdx > 0 ? 'mt-1' : ''}>
            {/* Group divider + label */}
            {gIdx > 0 && !collapsed && (
              <div className="flex items-center gap-2 px-3 py-2 mt-1">
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-[9px] font-bold text-white/25 uppercase tracking-[0.18em] whitespace-nowrap">
                  {group.label}
                </span>
                <div className="flex-1 h-px bg-white/5" />
              </div>
            )}
            {gIdx > 0 && collapsed && (
              <div className="my-2 mx-3 h-px bg-white/5" />
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
      <div className="p-2 space-y-1 border-t border-white/5">
        {/* Settings Link */}
        <Link href="/dashboard/settings">
          <motion.div
            whileHover={{ x: collapsed ? 0 : 3 }}
            whileTap={{ scale: 0.97 }}
            className={`relative flex items-center h-9 rounded-xl group transition-all duration-200 ${
              pathname.startsWith('/dashboard/settings')
                ? 'bg-white/10 text-white font-semibold'
                : 'text-white/50 hover:bg-white/5 hover:text-white/90'
            } ${collapsed ? 'justify-center w-10 mx-auto px-0' : 'px-3'}`}
            title={collapsed ? 'Settings' : undefined}
          >
            {pathname.startsWith('/dashboard/settings') && (
              <motion.div
                layoutId="settingsActivePill"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-white/60 rounded-r-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              />
            )}
            <Settings className={`w-[17px] h-[17px] flex-shrink-0 transition-colors duration-200 ${
              pathname.startsWith('/dashboard/settings') ? 'text-white' : 'group-hover:text-white/90'
            }`} />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="ml-3 text-[13px] whitespace-nowrap"
                >
                  Settings
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
        </Link>

        {/* Collapse Button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`relative flex items-center w-full h-9 rounded-xl group transition-all duration-200 text-white/40 hover:bg-white/5 hover:text-white/70 ${
            collapsed ? 'justify-center w-10 mx-auto px-0' : 'px-3'
          }`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <motion.div
            animate={{ rotate: collapsed ? 0 : 180 }}
            transition={{ duration: 0.3 }}
          >
            <ChevronRight className="w-[17px] h-[17px] flex-shrink-0" />
          </motion.div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="ml-3 text-[13px] font-medium whitespace-nowrap"
              >
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* ── User Profile Pill ── */}
        <AnimatePresence>
          {user && (
            <motion.div
              layout
              className={`mt-1 p-1.5 flex items-center justify-between bg-white/5 border border-white/8 rounded-2xl hover:bg-white/8 transition-colors overflow-hidden ${
                collapsed ? 'flex-col gap-2' : 'flex-row'
              }`}
            >
              <div className={`flex items-center gap-2 overflow-hidden min-w-0 ${collapsed ? 'flex-col' : ''}`}>
                {/* Avatar — real photo if available, else initial */}
                <div className="w-8 h-8 shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-brand-indigo to-brand-cyan flex items-center justify-center text-white font-bold text-sm shadow-inner border border-white/10">
                  {(user as any).face_image_url ? (
                    <img
                      src={(user as any).face_image_url}
                      alt={user.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    user.full_name.charAt(0).toUpperCase()
                  )}
                </div>

                {!collapsed && (
                  <div className="min-w-0 flex-1 pr-1 overflow-hidden">
                    <p className="text-[13px] font-semibold text-white truncate leading-tight">
                      {user.full_name}
                    </p>
                    <RoleBadge role={user.role?.name} collapsed={false} />
                  </div>
                )}
              </div>

              <button
                onClick={logout}
                title="Sign out"
                className={`p-1.5 rounded-xl text-white/40 hover:text-brand-red hover:bg-brand-red/10 transition-colors shrink-0 ${
                  collapsed ? 'w-8 h-8 flex justify-center items-center' : ''
                }`}
              >
                <LogOut className="w-[15px] h-[15px]" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
