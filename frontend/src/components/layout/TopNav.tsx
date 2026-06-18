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
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

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
    <header className="sticky top-0 z-30 h-16 flex items-center justify-between gap-4 px-6 bg-white/80 dark:bg-dark-900/80 backdrop-blur-xl border-b border-dark-200 dark:border-dark-800">
      {/* Left: Mobile menu + Search */}
      <div className="flex items-center gap-3 flex-1">
        <button onClick={onMenuToggle} className="lg:hidden btn-ghost p-2">
          <Menu className="w-5 h-5" />
        </button>
        <div className="relative w-full max-w-md hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
          <input
            type="text"
            placeholder="Search students, projects, events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10 py-2 text-sm bg-dark-50 dark:bg-dark-800 border-transparent focus:bg-white dark:focus:bg-dark-700"
            id="global-search"
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        {mounted && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="btn-ghost p-2.5 rounded-xl"
            id="theme-toggle"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-dark-500" />}
          </motion.button>
        )}

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowNotifications(!showNotifications)}
            className="btn-ghost p-2.5 rounded-xl relative"
            id="notification-bell"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </motion.button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-80 glass-card p-4 shadow-xl"
              >
                <h3 className="text-sm font-semibold mb-3">Notifications</h3>
                {unreadCount === 0 ? (
                  <p className="text-sm text-dark-400 py-4 text-center">No new notifications</p>
                ) : (
                  <p className="text-sm text-dark-400 py-4 text-center">
                    You have {unreadCount} unread notifications
                  </p>
                )}
                <a href="/dashboard/notifications" className="block text-center text-sm text-primary-600 dark:text-primary-400 font-medium mt-2 hover:underline">
                  View all
                </a>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile dropdown */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl hover:bg-dark-100 dark:hover:bg-dark-800 transition-colors"
            id="profile-dropdown"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-bold">
              {initials}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-dark-900 dark:text-white leading-tight">
                {user?.full_name || 'User'}
              </p>
              <p className="text-[10px] text-dark-400 capitalize">
                {user?.role?.name?.replace('_', ' ') || 'Loading...'}
              </p>
            </div>
            <ChevronDown className="w-4 h-4 text-dark-400 hidden md:block" />
          </button>

          <AnimatePresence>
            {showProfile && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-56 glass-card py-2 shadow-xl"
              >
                <div className="px-4 py-2 border-b border-dark-200 dark:border-dark-700">
                  <p className="text-sm font-medium">{user?.full_name}</p>
                  <p className="text-xs text-dark-400">{user?.email}</p>
                </div>
                <a href="/dashboard/settings" className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-dark-50 dark:hover:bg-dark-800 transition-colors">
                  <User className="w-4 h-4" /> Profile
                </a>
                <a href="/dashboard/settings" className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-dark-50 dark:hover:bg-dark-800 transition-colors">
                  <Settings className="w-4 h-4" /> Settings
                </a>
                <div className="border-t border-dark-200 dark:border-dark-700 mt-1 pt-1">
                  <button
                    onClick={logout}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 w-full text-left transition-colors"
                  >
                    <LogOut className="w-4 h-4" /> Logout
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
