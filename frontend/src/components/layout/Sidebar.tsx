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
      animate={{ width: collapsed ? 80 : 280 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 left-0 h-screen z-40 hidden lg:flex flex-col bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-2xl border-r border-dark-100 dark:border-white/5 shadow-2xl"
    >
      {/* Logo */}
      <div className="h-20 flex items-center gap-3 px-6 border-b border-dark-100 dark:border-white/5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden shadow-lg shadow-brand-blue/20 bg-gradient-to-br from-brand-blue to-brand-purple">
          <img src="/logo.jpg" alt="Spark Logo" className="w-full h-full object-cover mix-blend-overlay opacity-90" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="flex flex-col overflow-hidden">
              <h1 className="text-xl font-heading font-bold text-dark-900 dark:text-white tracking-tight whitespace-nowrap">Spark</h1>
              <p className="text-xs text-brand-blue font-medium -mt-1 whitespace-nowrap tracking-wide">Innovation Center</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* User Info */}
      <AnimatePresence>
        {!collapsed && user && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-6 py-4 border-b border-dark-100 dark:border-white/5 overflow-hidden"
          >
            <div className="flex items-center gap-3 glass-card p-3 rounded-xl border border-white/10 bg-white/10">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-blue to-brand-cyan flex items-center justify-center text-white font-bold shadow-inner">
                {user.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-dark-900 dark:text-white truncate">{user.full_name}</p>
                <p className="text-xs text-dark-400 truncate mt-0.5">{user.ic_number} • <span className="text-brand-cyan">{user.role?.name}</span></p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1.5 scrollbar-hide">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.96 }}
                className={`sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : 'px-4'}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 transition-colors duration-300 ${isActive ? 'text-white' : 'text-dark-400 group-hover:text-brand-blue'}`} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="font-medium whitespace-nowrap">
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {isActive && !collapsed && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute right-2 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  />
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-dark-100 dark:border-white/5 p-4 space-y-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`sidebar-link w-full text-dark-500 hover:bg-dark-50 dark:hover:bg-white/5 ${collapsed ? 'justify-center px-0' : 'px-4'}`}
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          {!collapsed && <span className="font-medium">Collapse</span>}
        </button>
        <button
          onClick={logout}
          className={`sidebar-link w-full group text-red-500 hover:text-white hover:bg-gradient-to-r hover:from-red-500 hover:to-brand-pink hover:shadow-lg hover:shadow-red-500/25 transition-all duration-300 ${collapsed ? 'justify-center px-0' : 'px-4'}`}
        >
          <LogOut className="w-5 h-5 flex-shrink-0 group-hover:text-white transition-colors" />
          {!collapsed && <span className="font-medium">Logout</span>}
        </button>
      </div>
    </motion.aside>
  );
}
