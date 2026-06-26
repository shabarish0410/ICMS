'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard, GraduationCap, Users2, FolderKanban, Calendar,
  Bell, Settings, ClipboardList, FileText, Clock, Megaphone,
  Video, ChevronLeft, ChevronRight, Cpu, LogOut, Sparkles, UserCheck, ScanFace, Shield,
} from 'lucide-react';

const adminMenu = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Students', href: '/dashboard/students', icon: GraduationCap },
  { label: 'Teams', href: '/dashboard/teams', icon: Users2 },
  { label: 'Projects', href: '/dashboard/projects', icon: FolderKanban },
  { label: 'Forms', href: '/dashboard/forms', icon: ClipboardList },
  { label: 'Attendance', href: '/dashboard/attendance', icon: UserCheck },
  { label: 'Snapshots', href: '/dashboard/attendance/snapshots', icon: ScanFace },
  { label: 'Weekly Reports', href: '/dashboard/weekly-reports', icon: FileText },
  { label: 'Announcements', href: '/dashboard/announcements', icon: Megaphone },
  { label: 'Meetings', href: '/dashboard/meetings', icon: Video },
  { label: 'Events', href: '/dashboard/events', icon: Calendar },
  { label: 'Notifications', href: '/dashboard/notifications', icon: Bell },
  { label: 'Admins', href: '/dashboard/admins', icon: Shield },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
];

const studentMenu = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'My Project', href: '/dashboard/projects', icon: FolderKanban },
  { label: 'Forms', href: '/dashboard/forms', icon: ClipboardList },
  { label: 'Attendance', href: '/dashboard/attendance', icon: UserCheck },
  { label: 'Snapshots', href: '/dashboard/attendance/snapshots', icon: ScanFace },
  { label: 'Weekly Reports', href: '/dashboard/weekly-reports', icon: FileText },
  { label: 'Meetings', href: '/dashboard/meetings', icon: Video },
  { label: 'Announcements', href: '/dashboard/announcements', icon: Megaphone },
  { label: 'Events', href: '/dashboard/events', icon: Calendar },
  { label: 'Notifications', href: '/dashboard/notifications', icon: Bell },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user, isAdmin, logout } = useAuth();

  const menuItems = isAdmin ? adminMenu : studentMenu;

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="fixed top-0 left-0 h-screen z-40 hidden lg:flex flex-col bg-white dark:bg-dark-950 border-r border-dark-200 dark:border-dark-800"
    >
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-4 border-b border-dark-200 dark:border-dark-800">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
          <Cpu className="w-5 h-5 text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h1 className="text-lg font-bold text-dark-900 dark:text-white whitespace-nowrap">Spark</h1>
              <p className="text-[10px] text-dark-400 -mt-1 whitespace-nowrap">Innovation Center</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* User Info */}
      <AnimatePresence>
        {!collapsed && user && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-4 py-3 border-b border-dark-200 dark:border-dark-800"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold text-sm">
                {user.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-dark-900 dark:text-white truncate">{user.full_name}</p>
                <p className="text-[11px] text-dark-400 truncate">{user.ic_number} · {user.role?.name}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                className={`sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* AI Insights */}
      <AnimatePresence>
        {!collapsed && isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="mx-3 mb-3 p-4 rounded-xl bg-gradient-to-br from-primary-500/10 to-violet-500/10 border border-primary-500/20"
          >
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-primary-500" />
              <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">AI Insights</span>
            </div>
            <p className="text-[11px] text-dark-500 dark:text-dark-400">
              3 projects approaching deadlines. Review recommended.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="border-t border-dark-200 dark:border-dark-800 p-3 space-y-2">
        <button
          onClick={logout}
          className={`sidebar-link w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 ${collapsed ? 'justify-center px-0' : ''}`}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`sidebar-link w-full ${collapsed ? 'justify-center px-0' : ''}`}
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </motion.aside>
  );
}
