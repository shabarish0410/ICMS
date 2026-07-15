'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard, GraduationCap, Users2, FolderKanban, Calendar,
  Bell, Settings, ClipboardList, FileText, Megaphone,
  Video, ChevronLeft, ChevronRight, Cpu, LogOut, ScanFace, Shield, Shirt, UserCheck, FileBadge
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
  { label: 'Face Management', href: '/dashboard/admins/face-management', icon: Cpu },
  { label: 'Uniform Mgmt', href: '/dashboard/admins/uniform-management', icon: Shirt },
  { label: 'Approvals', href: '/dashboard/admins/achievements', icon: FileBadge },
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
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user, isAdmin, logout } = useAuth();

  const menuItems = isAdmin ? adminMenu : studentMenu;

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 80 : 260 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 left-0 h-screen z-40 hidden lg:flex flex-col bg-white dark:bg-dark-950/95 backdrop-blur-2xl border-r border-dark-200 dark:border-white/5 shadow-xl shadow-brand-indigo/5 dark:shadow-2xl"
    >
      {/* Premium Glowing Logo */}
      <div className="h-24 flex items-center gap-3 px-6 shrink-0 relative overflow-hidden">
        {/* Subtle Background Glow */}
        <div className="absolute top-1/2 left-10 -translate-y-1/2 w-20 h-20 bg-brand-indigo/20 dark:bg-brand-indigo/30 rounded-full blur-[30px] pointer-events-none" />
        
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden shadow-lg shadow-brand-indigo/20 dark:shadow-brand-indigo/30 bg-gradient-to-br from-brand-indigo to-brand-cyan border border-white/20 dark:border-white/10 z-10 relative">
          {/* Logo image with CSS filters to give a premium SVG look */}
          <img 
            src="/logo.jpg" 
            alt="Spark Logo" 
            className="w-full h-full object-cover mix-blend-screen contrast-125 brightness-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" 
          />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: -10 }} 
              className="flex flex-col z-10"
            >
              <h1 className="text-xl font-heading font-bold text-dark-900 dark:text-white tracking-tight whitespace-nowrap drop-shadow-sm">Spark</h1>
              <p className="text-[10px] text-brand-indigo dark:text-brand-cyan font-semibold -mt-1 whitespace-nowrap tracking-widest uppercase">Innovation</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-1 scrollbar-hide relative z-10">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ x: collapsed ? 0 : 4 }}
                whileTap={{ scale: 0.98 }}
                className={`relative flex items-center h-10 rounded-xl group transition-all duration-300 ${
                  isActive 
                    ? 'bg-brand-indigo/10 dark:bg-brand-indigo/10 text-brand-indigo dark:text-white font-semibold' 
                    : 'text-dark-500 dark:text-dark-400 hover:bg-dark-50 dark:hover:bg-white/5 hover:text-dark-900 dark:hover:text-white'
                } ${collapsed ? 'justify-center w-12 mx-auto px-0' : 'px-3'}`}
                title={collapsed ? item.label : undefined}
              >
                {/* Active Indicator */}
                {isActive && (
                  <motion.div
                    layoutId="activePill"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-brand-indigo dark:bg-brand-cyan rounded-r-full shadow-[0_0_10px_rgba(99,102,241,0.5)] dark:shadow-[0_0_10px_rgba(6,182,212,0.8)]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}

                <Icon className={`w-[18px] h-[18px] flex-shrink-0 transition-colors duration-300 ${isActive ? 'text-brand-indigo dark:text-brand-cyan drop-shadow-[0_0_5px_rgba(99,102,241,0.3)] dark:drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]' : 'group-hover:text-brand-indigo dark:group-hover:text-white'}`} />
                
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      exit={{ opacity: 0 }} 
                      transition={{ duration: 0.2 }} 
                      className="ml-3 text-sm whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Footer Area */}
      <div className="p-3 space-y-1 relative z-10 bg-gradient-to-t from-white via-white dark:from-dark-950 dark:via-dark-950 to-transparent pt-8">
        {/* Settings Link */}
        <Link href="/dashboard/settings">
          <motion.div
            whileHover={{ x: collapsed ? 0 : 4 }}
            whileTap={{ scale: 0.98 }}
            className={`relative flex items-center h-10 rounded-xl group transition-all duration-300 ${
              pathname.startsWith('/dashboard/settings') 
                ? 'bg-dark-100 dark:bg-white/10 text-dark-900 dark:text-white font-semibold' 
                : 'text-dark-500 dark:text-dark-400 hover:bg-dark-50 dark:hover:bg-white/5 hover:text-dark-900 dark:hover:text-white'
            } ${collapsed ? 'justify-center w-12 mx-auto px-0' : 'px-3'}`}
            title={collapsed ? 'Settings' : undefined}
          >
            {pathname.startsWith('/dashboard/settings') && (
              <motion.div
                layoutId="activePill"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-dark-900 dark:bg-white rounded-r-full shadow-[0_0_10px_rgba(15,23,42,0.2)] dark:shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              />
            )}
            <Settings className={`w-[18px] h-[18px] flex-shrink-0 transition-colors duration-300 ${pathname.startsWith('/dashboard/settings') ? 'text-dark-900 dark:text-white drop-shadow-[0_0_5px_rgba(15,23,42,0.2)] dark:drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]' : 'group-hover:text-dark-900 dark:group-hover:text-white'}`} />
            <AnimatePresence>
              {!collapsed && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="ml-3 text-sm whitespace-nowrap">
                  Settings
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
        </Link>

        {/* Collapse Button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`relative flex items-center w-full h-10 rounded-xl group transition-all duration-300 text-dark-500 dark:text-dark-400 hover:bg-dark-50 dark:hover:bg-white/5 hover:text-dark-900 dark:hover:text-white ${collapsed ? 'justify-center w-12 mx-auto px-0' : 'px-3'}`}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronRight className="w-[18px] h-[18px] flex-shrink-0" /> : <ChevronLeft className="w-[18px] h-[18px] flex-shrink-0" />}
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="ml-3 text-sm font-medium whitespace-nowrap">
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Premium User Profile Pill */}
        <AnimatePresence>
          {user && (
            <motion.div
              layout
              className={`mt-2 p-1.5 flex items-center justify-between bg-dark-50 dark:bg-white/5 border border-dark-100 dark:border-white/10 rounded-2xl hover:bg-dark-100 dark:hover:bg-white/10 transition-colors ${collapsed ? 'flex-col gap-2 rounded-[24px]' : 'flex-row'}`}
            >
              <div className={`flex items-center gap-2 ${collapsed ? 'flex-col' : ''}`}>
                <div className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-br from-brand-indigo to-brand-cyan flex items-center justify-center text-white font-bold text-sm shadow-inner border border-white/20">
                  {user.full_name.charAt(0).toUpperCase()}
                </div>
                {!collapsed && (
                  <div className="min-w-0 pr-2">
                    <p className="text-sm font-semibold text-dark-900 dark:text-white truncate leading-tight">{user.full_name}</p>
                    <p className="text-[10px] text-brand-indigo dark:text-brand-cyan uppercase tracking-wider font-semibold truncate leading-tight">{user.role?.name}</p>
                  </div>
                )}
              </div>
              
              <button 
                onClick={logout}
                title="Logout"
                className={`p-2 rounded-xl text-dark-500 dark:text-dark-400 hover:text-brand-red hover:bg-brand-red/10 transition-colors ${collapsed ? 'w-9 h-9 flex justify-center items-center' : ''}`}
              >
                <LogOut className="w-[18px] h-[18px]" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
