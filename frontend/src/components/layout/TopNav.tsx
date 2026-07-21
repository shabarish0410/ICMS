'use client';

import { useState, useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { notificationsAPI } from '@/services/api';
import Link from 'next/link';
import {
  Search, Bell, Sun, Moon, ChevronDown, User, Settings, LogOut, Menu, Sparkles, Clock, Calendar
} from 'lucide-react';

export default function TopNav({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearInterval(timer);
    };
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

  const timeString = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateString = currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <header className={`sticky top-0 z-30 h-20 flex items-center justify-between gap-4 px-6 transition-all duration-300 ${
      scrolled ? 'bg-primary/90 backdrop-blur-xl shadow-md border-b border-primary-hover' : 'bg-primary border-b border-transparent'
    }`}>
      {/* Left: Mobile menu + Search */}
      <div className="flex items-center gap-4 flex-1">
        <button onClick={onMenuToggle} className="lg:hidden p-2 text-dark-500 hover:text-dark-900 dark:text-dark-400 dark:hover:text-white hover:bg-dark-50 dark:hover:bg-white/5 rounded-xl transition-colors">
          <Menu className="w-6 h-6" />
        </button>
        
        <div className="relative w-full max-w-md hidden sm:block group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-dark-400 group-focus-within:text-brand-indigo transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Search students, projects, events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-12 py-2.5 text-sm bg-dark-50 dark:bg-white/5 backdrop-blur-md border border-dark-200 dark:border-white/10 rounded-2xl text-dark-900 dark:text-white placeholder-dark-400 focus:outline-none focus:ring-1 focus:ring-brand-indigo/50 focus:border-brand-indigo/50 focus:bg-white dark:focus:bg-white/10 transition-all duration-300 shadow-sm"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <kbd className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-white dark:bg-white/10 text-dark-400 border border-dark-200 dark:border-white/5 shadow-sm">
              /
            </kbd>
          </div>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Date & Time (Hidden on small screens) */}
        <div className="hidden xl:flex items-center gap-3 px-4 py-2 bg-white dark:bg-white/5 border border-dark-100 dark:border-white/5 rounded-2xl mr-2 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs text-dark-500 dark:text-dark-300 font-medium border-r border-dark-200 dark:border-white/10 pr-3">
            <Calendar className="w-3.5 h-3.5 text-brand-cyan" />
            {dateString}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-dark-500 dark:text-dark-300 font-medium">
            <Clock className="w-3.5 h-3.5 text-brand-indigo" />
            {timeString}
          </div>
        </div>

        {/* AI Assistant Shortcut */}
        <button
          className="hidden md:flex items-center justify-center p-2.5 rounded-xl bg-brand-indigo/10 hover:bg-brand-indigo/20 border border-brand-indigo/20 shadow-sm transition-all group"
          title="AI Assistant"
        >
          <Sparkles className="w-5 h-5 text-brand-indigo group-hover:drop-shadow-[0_0_8px_rgba(99,102,241,0.5)] transition-all" />
        </button>

        {/* Theme toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="hidden sm:flex items-center justify-center p-2.5 rounded-xl bg-white dark:bg-white/5 hover:bg-dark-50 dark:hover:bg-white/10 border border-dark-100 dark:border-white/5 shadow-sm transition-all text-dark-500 dark:text-dark-400 hover:text-dark-900 dark:hover:text-white"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        )}

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2.5 rounded-xl bg-white dark:bg-white/5 hover:bg-dark-50 dark:hover:bg-white/10 border border-dark-100 dark:border-white/5 shadow-sm transition-all text-dark-500 dark:text-dark-400 hover:text-dark-900 dark:hover:text-white"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-brand-red to-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md shadow-brand-red/30 border-2 border-white dark:border-[#0B1120]">
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
                className="absolute right-0 mt-3 w-80 bg-white dark:bg-dark-950/95 backdrop-blur-3xl shadow-2xl overflow-hidden rounded-3xl border border-dark-100 dark:border-white/10 origin-top-right z-50"
              >
                <div className="p-4 border-b border-dark-100 dark:border-white/5 flex justify-between items-center bg-dark-50 dark:bg-white/5">
                  <h3 className="text-sm font-bold text-dark-900 dark:text-white">Notifications</h3>
                  {unreadCount > 0 && <span className="px-2 py-0.5 rounded-full bg-brand-cyan/10 text-brand-cyan text-[10px] font-bold border border-brand-cyan/20">{unreadCount} New</span>}
                </div>
                <div className="p-4 max-h-64 overflow-y-auto scrollbar-hide">
                  {unreadCount === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-dark-400">
                      <Bell className="w-8 h-8 mb-2 opacity-30 dark:opacity-50" />
                      <p className="text-sm">No new notifications</p>
                    </div>
                  ) : (
                    <p className="text-sm text-dark-500 dark:text-dark-400 py-4 text-center">
                      You have {unreadCount} unread notifications
                    </p>
                  )}
                </div>
                <Link href="/dashboard/notifications" className="block text-center text-xs font-semibold text-brand-indigo dark:text-brand-cyan py-4 border-t border-dark-100 dark:border-white/5 hover:bg-dark-50 dark:hover:bg-white/5 transition-colors">
                  View All Notifications
                </Link>
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
            className="flex items-center gap-3 pl-2 pr-4 py-1.5 rounded-full bg-white dark:bg-white/5 hover:bg-dark-50 dark:hover:bg-white/10 border border-dark-100 dark:border-white/5 shadow-sm transition-all"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-indigo to-brand-cyan flex items-center justify-center text-white text-sm font-bold shadow-inner border border-white/20">
              {initials}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-semibold text-dark-900 dark:text-white leading-tight">
                {user?.full_name || 'User'}
              </p>
              <p className="text-[10px] text-brand-indigo dark:text-brand-cyan font-semibold uppercase tracking-wider">
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
                className="absolute right-0 mt-3 w-64 bg-white dark:bg-dark-950/95 backdrop-blur-3xl shadow-2xl rounded-3xl border border-dark-100 dark:border-white/10 origin-top-right overflow-hidden z-50"
              >
                <div className="px-5 py-5 border-b border-dark-100 dark:border-white/5 bg-gradient-to-br from-brand-indigo/5 dark:from-brand-indigo/10 to-transparent">
                  <p className="text-base font-bold text-dark-900 dark:text-white">{user?.full_name}</p>
                  <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">{user?.email}</p>
                </div>
                <div className="py-2">
                  <Link href="/dashboard/settings" className="flex items-center gap-3 px-5 py-3 text-sm font-medium text-dark-600 dark:text-dark-300 hover:text-dark-900 dark:hover:text-white hover:bg-dark-50 dark:hover:bg-white/5 transition-colors group">
                    <User className="w-[18px] h-[18px] text-dark-400 group-hover:text-brand-indigo dark:group-hover:text-brand-cyan transition-colors" /> Profile settings
                  </Link>
                  <Link href="/dashboard/settings?tab=security" className="flex items-center gap-3 px-5 py-3 text-sm font-medium text-dark-600 dark:text-dark-300 hover:text-dark-900 dark:hover:text-white hover:bg-dark-50 dark:hover:bg-white/5 transition-colors group">
                    <Settings className="w-[18px] h-[18px] text-dark-400 group-hover:text-brand-indigo dark:group-hover:text-brand-cyan transition-colors" /> Account security
                  </Link>
                </div>
                <div className="border-t border-dark-100 dark:border-white/5 p-2">
                  <button
                    onClick={logout}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-brand-red hover:text-white hover:bg-brand-red/10 dark:hover:bg-brand-red/20 rounded-2xl w-full text-left transition-all duration-300 group"
                  >
                    <LogOut className="w-[18px] h-[18px] group-hover:text-white transition-colors" /> Sign out
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
