'use client';

import { useState, useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { notificationsAPI } from '@/services/api';
import {
  Search, Bell, Sun, Moon, ChevronDown, User, Settings, LogOut, Menu,
} from 'lucide-react';

export default function TopNav({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const { data: unreadData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => notificationsAPI.unreadCount(),
    refetchInterval: 30000,
    enabled: !!user,
  });
  const unreadCount = unreadData?.data?.count || 0;

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '??';

  return (
    <header className={`sticky top-0 z-30 h-20 flex items-center justify-between gap-4 px-6 transition-all duration-300 ${
      scrolled ? 'bg-white/70 dark:bg-[#0f172a]/70 backdrop-blur-2xl shadow-lg border-b border-white/10' : 'bg-transparent border-b border-transparent'
    }`}>
      {/* Left: Mobile menu + Search */}
      <div className="flex items-center gap-4 flex-1">
        <button onClick={onMenuToggle} className="lg:hidden btn-ghost p-2 hover:bg-white/10 rounded-xl">
          <Menu className="w-6 h-6" />
        </button>
        <div className="relative w-full max-w-md hidden sm:block">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400 dark:text-dark-500" />
          <input
            type="text"
            placeholder="Search students, projects, events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 text-sm bg-white/50 dark:bg-dark-900/50 backdrop-blur-md border border-dark-200/50 dark:border-white/10 rounded-2xl text-dark-900 dark:text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent transition-all duration-300 shadow-sm hover:bg-white/80 dark:hover:bg-dark-800/80"
            id="global-search"
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Theme toggle */}
        {mounted && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2.5 rounded-xl bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 backdrop-blur-md border border-dark-200/50 dark:border-white/10 shadow-sm transition-all"
            id="theme-toggle"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-brand-orange drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]" /> : <Moon className="w-5 h-5 text-brand-indigo" />}
          </motion.button>
        )}

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2.5 rounded-xl bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 backdrop-blur-md border border-dark-200/50 dark:border-white/10 shadow-sm transition-all relative"
            id="notification-bell"
          >
            <Bell className="w-5 h-5 text-dark-600 dark:text-dark-300" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-brand-pink to-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg shadow-brand-pink/40 border-2 border-white dark:border-dark-900">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </motion.button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="absolute right-0 mt-3 w-80 glass-card p-0 shadow-2xl overflow-hidden rounded-2xl border border-white/20 origin-top-right"
              >
                <div className="p-4 border-b border-dark-100 dark:border-white/10 bg-dark-50/50 dark:bg-white/5 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-dark-900 dark:text-white">Notifications</h3>
                  {unreadCount > 0 && <span className="badge badge-blue">{unreadCount} New</span>}
                </div>
                <div className="p-4 max-h-64 overflow-y-auto">
                  {unreadCount === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-dark-400">
                      <Bell className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-sm">No new notifications</p>
                    </div>
                  ) : (
                    <p className="text-sm text-dark-400 py-4 text-center">
                      You have {unreadCount} unread notifications
                    </p>
                  )}
                </div>
                <a href="/dashboard/notifications" className="block text-center text-xs font-semibold text-brand-blue py-3 border-t border-dark-100 dark:border-white/10 hover:bg-dark-50 dark:hover:bg-white/5 transition-colors">
                  View All Notifications
                </a>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile dropdown */}
        <div ref={profileRef} className="relative ml-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-3 pl-2 pr-4 py-1.5 rounded-full bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border border-dark-200/50 dark:border-white/10 backdrop-blur-md shadow-sm transition-all"
            id="profile-dropdown"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-blue to-brand-purple flex items-center justify-center text-white text-sm font-bold shadow-inner">
              {initials}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-semibold text-dark-900 dark:text-white leading-tight">
                {user?.full_name || 'User'}
              </p>
              <p className="text-xs text-brand-cyan font-medium capitalize">
                {user?.role?.name?.replace('_', ' ') || 'Loading...'}
              </p>
            </div>
            <ChevronDown className="w-4 h-4 text-dark-400 hidden md:block" />
          </motion.button>

          <AnimatePresence>
            {showProfile && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="absolute right-0 mt-3 w-64 glass-card py-2 shadow-2xl rounded-2xl border border-white/20 origin-top-right overflow-hidden"
              >
                <div className="px-5 py-4 border-b border-dark-100 dark:border-white/10 bg-gradient-to-br from-brand-blue/5 to-transparent">
                  <p className="text-base font-bold text-dark-900 dark:text-white">{user?.full_name}</p>
                  <p className="text-xs text-dark-400 mt-1">{user?.email}</p>
                </div>
                <div className="py-2">
                  <a href="/dashboard/settings" className="flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-dark-700 dark:text-dark-200 hover:text-brand-blue hover:bg-dark-50 dark:hover:bg-white/5 transition-colors group">
                    <User className="w-4 h-4 text-dark-400 group-hover:text-brand-blue transition-colors" /> Profile Profile
                  </a>
                  <a href="/dashboard/settings" className="flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-dark-700 dark:text-dark-200 hover:text-brand-blue hover:bg-dark-50 dark:hover:bg-white/5 transition-colors group">
                    <Settings className="w-4 h-4 text-dark-400 group-hover:text-brand-blue transition-colors" /> Account Settings
                  </a>
                </div>
                <div className="border-t border-dark-100 dark:border-white/10 p-2">
                  <button
                    onClick={logout}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-500 hover:text-white hover:bg-gradient-to-r hover:from-red-500 hover:to-brand-pink rounded-xl w-full text-left transition-all duration-300 group shadow-sm hover:shadow-red-500/25"
                  >
                    <LogOut className="w-4 h-4 group-hover:text-white transition-colors" /> Sign Out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
