'use client';

import { useState, useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsAPI } from '@/services/api';
import Link from 'next/link';
import {
  Search,
  Bell,
  Sun,
  Moon,
  ChevronDown,
  Settings,
  LogOut,
  Menu,
  Check,
  CheckCheck,
  X,
} from 'lucide-react';

// ─── TopNav ───────────────────────────────────────────────────────────────────
export default function TopNav({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  const [mounted, setMounted] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Hydration guard
  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // '/' shortcut → focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        searchRef.current?.blur();
        setSearchQuery('');
        setShowProfile(false);
        setShowNotifications(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node))
        setShowProfile(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setShowNotifications(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Unread count (poll every 30s)
  const { data: unreadData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => notificationsAPI.unreadCount(),
    refetchInterval: 30_000,
    enabled: !!user,
  });
  const unreadCount: number = unreadData?.data?.count ?? 0;

  // Recent notifications (only fetch when dropdown is open)
  const { data: recentData } = useQuery({
    queryKey: ['recent-notifications'],
    queryFn: () => notificationsAPI.list({ limit: 5, page: 1 }),
    enabled: !!user && showNotifications,
    staleTime: 10_000,
  });
  const notifList: any[] = recentData?.data?.items ?? recentData?.data ?? [];

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationsAPI.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['recent-notifications'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsAPI.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['recent-notifications'] });
    },
  });

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '??';

  const timeStr = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = currentTime.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <header className="sticky top-0 z-30 h-16 flex items-center justify-between gap-4 px-6 bg-white border-b border-slate-200 dark:bg-[#0F172A] dark:border-slate-800">

      {/* ── Left ── */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {/* Mobile menu */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-white/5 dark:hover:text-white transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Search */}
        <div className="relative hidden sm:block w-full max-w-xs group">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="w-4 h-4 text-slate-400 group-focus-within:text-[#2563EB] transition-colors" />
          </div>
          <input
            ref={searchRef}
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-10 py-2 text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all duration-200"
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-slate-400 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-700">
                /
              </kbd>
            </div>
          )}
        </div>
      </div>

      {/* ── Right ── */}
      <div className="flex items-center gap-2 flex-shrink-0">

        {/* Date & Time */}
        <div className="hidden xl:flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 font-medium tabular-nums select-none">
          <span>{dateStr}</span>
          <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
          <span>{timeStr}</span>
        </div>

        {/* Theme toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5 transition-all duration-200"
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        )}

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5 transition-all duration-200"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <>
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-ping opacity-75" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-[#0F172A]" />
              </>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      Notifications
                    </span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-100">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllMutation.mutate()}
                      className="flex items-center gap-1 text-[11px] font-semibold text-[#2563EB] hover:opacity-70 transition-opacity"
                    >
                      <CheckCheck className="w-3 h-3" />
                      Mark all read
                    </button>
                  )}
                </div>

                {/* List */}
                <div className="max-h-72 overflow-y-auto scrollbar-hide">
                  {notifList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
                      <Bell className="w-8 h-8 opacity-30" />
                      <p className="text-sm font-medium">All caught up!</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50 dark:divide-slate-800">
                      {notifList.slice(0, 5).map((n: any) => (
                        <div
                          key={n.id}
                          className={`flex gap-3 px-4 py-3 group transition-colors ${
                            !n.is_read
                              ? 'bg-blue-50/50 dark:bg-blue-950/20'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="mt-1.5 flex-shrink-0">
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${
                                !n.is_read ? 'bg-[#2563EB]' : 'bg-slate-300 dark:bg-slate-600'
                              }`}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-semibold leading-tight truncate ${
                                !n.is_read
                                  ? 'text-slate-900 dark:text-white'
                                  : 'text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {n.title}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                              {n.message}
                            </p>
                            {n.created_at && (
                              <p className="text-[10px] text-slate-400 mt-1">
                                {new Date(n.created_at).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            )}
                          </div>
                          {!n.is_read && (
                            <button
                              onClick={() => markReadMutation.mutate(n.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-[#2563EB] transition-all flex-shrink-0 mt-0.5"
                              title="Mark read"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <Link
                  href="/dashboard/notifications"
                  onClick={() => setShowNotifications(false)}
                  className="block text-center text-xs font-semibold text-[#2563EB] py-3 border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  View all notifications
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 transition-all duration-200"
          >
            {/* Avatar */}
            <div className="w-7 h-7 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-xs font-bold overflow-hidden flex-shrink-0">
              {(user as any)?.face_image_url ? (
                <img
                  src={(user as any).face_image_url}
                  alt={user?.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <span className="hidden md:block text-sm font-semibold text-slate-700 dark:text-slate-200">
              {user?.full_name?.split(' ')[0] || 'User'}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 hidden md:block transition-transform duration-200 ${
                showProfile ? 'rotate-180' : ''
              }`}
            />
          </button>

          <AnimatePresence>
            {showProfile && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50"
              >
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {user?.full_name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {user?.email || user?.ic_number}
                  </p>
                </div>

                <div className="py-1.5">
                  <Link
                    href="/dashboard/settings"
                    onClick={() => setShowProfile(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    Settings
                  </Link>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 py-1.5">
                  <button
                    onClick={logout}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors w-full text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
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
