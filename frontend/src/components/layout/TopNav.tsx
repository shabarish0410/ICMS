'use client';

import { useState, useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsAPI } from '@/services/api';
import Link from 'next/link';
import {
  Search, Bell, Sun, Moon, ChevronDown, User, Settings, LogOut,
  Menu, Sparkles, Clock, Calendar, X, Check, CheckCheck
} from 'lucide-react';

// ─── AI Assistant Slide-over ─────────────────────────────────────────────────
function AIPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 240 }}
            className="fixed right-0 top-0 h-full w-80 z-50 bg-dark-950/95 backdrop-blur-3xl border-l border-white/10 shadow-2xl flex flex-col"
          >
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-brand-indigo/10 to-brand-purple/10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-brand-indigo/20 border border-brand-indigo/30">
                  <Sparkles className="w-5 h-5 text-brand-indigo" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">AI Assistant</h2>
                  <p className="text-[10px] text-dark-400 uppercase tracking-wider">Spark Intelligence</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-dark-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-indigo/20 to-brand-purple/20 border border-white/10 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-brand-indigo opacity-70" />
              </div>
              <p className="text-sm text-dark-400 leading-relaxed">
                AI Assistant is coming soon. Get smart insights about student progress, project analytics, and attendance patterns.
              </p>
              <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-brand-amber/10 text-brand-amber border border-brand-amber/20">
                Coming Soon
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── TopNav ──────────────────────────────────────────────────────────────────
export default function TopNav({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  const [mounted, setMounted] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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

  // Wire '/' keyboard shortcut to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        searchRef.current?.blur();
        setSearchQuery('');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const { data: unreadData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => notificationsAPI.unreadCount(),
    refetchInterval: 30000,
    enabled: !!user,
  });
  const unreadCount = unreadData?.data?.count || 0;

  // Fetch top 5 recent notifications for dropdown
  const { data: recentNotifs } = useQuery({
    queryKey: ['recent-notifications'],
    queryFn: () => notificationsAPI.list({ limit: 5, page: 1 }),
    enabled: !!user && showNotifications,
    staleTime: 10000,
  });
  const notifList: any[] = recentNotifs?.data?.items || recentNotifs?.data || [];

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationsAPI.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['recent-notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsAPI.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['recent-notifications'] });
    },
  });

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '??';

  const timeString = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateString = currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <>
      <AIPanel open={showAI} onClose={() => setShowAI(false)} />

      <header className={`sticky top-0 z-30 h-[72px] flex items-center justify-between gap-4 px-6 transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 dark:bg-dark-950/90 backdrop-blur-xl shadow-sm border-b border-dark-200/80 dark:border-white/10'
          : 'bg-transparent border-b border-transparent'
      }`}>

        {/* ── Left: Mobile menu + Search ── */}
        <div className="flex items-center gap-4 flex-1">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 text-dark-500 hover:text-dark-900 dark:text-dark-400 dark:hover:text-white hover:bg-dark-50 dark:hover:bg-white/5 rounded-xl transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Search */}
          <div className="relative w-full max-w-md hidden sm:block group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-dark-400 group-focus-within:text-brand-indigo transition-colors" />
            </div>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search students, projects, events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-12 py-2.5 text-sm bg-dark-50 dark:bg-white/5 backdrop-blur-md border border-dark-200 dark:border-white/10 rounded-2xl text-dark-900 dark:text-white placeholder-dark-400 focus:outline-none focus:ring-1 focus:ring-brand-indigo/50 focus:border-brand-indigo/50 focus:bg-white dark:focus:bg-white/10 transition-all duration-300 shadow-sm"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              {searchQuery ? (
                <button
                  className="pointer-events-auto"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="w-3.5 h-3.5 text-dark-400 hover:text-dark-700 dark:hover:text-white transition-colors" />
                </button>
              ) : (
                <kbd className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-white dark:bg-white/10 text-dark-400 border border-dark-200 dark:border-white/5 shadow-sm">
                  /
                </kbd>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: Actions ── */}
        <div className="flex items-center gap-2.5">

          {/* Date & Time */}
          <div className="hidden xl:flex items-center gap-3 px-3.5 py-2 bg-white dark:bg-white/5 border border-dark-100 dark:border-white/5 rounded-2xl shadow-sm">
            <div className="flex items-center gap-1.5 text-xs text-dark-500 dark:text-dark-300 font-medium border-r border-dark-200 dark:border-white/10 pr-3">
              <Calendar className="w-3.5 h-3.5 text-brand-cyan" />
              {dateString}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-dark-500 dark:text-dark-300 font-medium tabular-nums">
              <Clock className="w-3.5 h-3.5 text-brand-indigo" />
              {timeString}
            </div>
          </div>

          {/* AI Assistant */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowAI(true)}
            className="hidden md:flex items-center justify-center p-2.5 rounded-xl bg-brand-indigo/10 hover:bg-brand-indigo/20 border border-brand-indigo/20 shadow-sm transition-all group"
            title="AI Assistant"
          >
            <Sparkles className="w-5 h-5 text-brand-indigo group-hover:drop-shadow-[0_0_8px_rgba(99,102,241,0.7)] transition-all" />
          </motion.button>

          {/* Theme toggle */}
          {mounted && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="hidden sm:flex items-center justify-center p-2.5 rounded-xl bg-white dark:bg-white/5 hover:bg-dark-50 dark:hover:bg-white/10 border border-dark-100 dark:border-white/5 shadow-sm transition-all text-dark-500 dark:text-dark-400 hover:text-dark-900 dark:hover:text-white"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <motion.div
                animate={{ rotate: theme === 'dark' ? 0 : 180 }}
                transition={{ duration: 0.4 }}
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </motion.div>
            </motion.button>
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
                <>
                  {/* Ping ring */}
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand-red/60 animate-ping" />
                  {/* Static badge */}
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-brand-red to-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md border-2 border-white dark:border-dark-950">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                </>
              )}
            </motion.button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="absolute right-0 mt-3 w-[340px] bg-white dark:bg-dark-950/98 backdrop-blur-3xl shadow-2xl overflow-hidden rounded-3xl border border-dark-100 dark:border-white/10 origin-top-right z-50"
                >
                  {/* Header */}
                  <div className="p-4 border-b border-dark-100 dark:border-white/5 flex justify-between items-center bg-dark-50 dark:bg-white/5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-dark-900 dark:text-white">Notifications</h3>
                      {unreadCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-brand-red/10 text-brand-red text-[10px] font-bold border border-brand-red/20">
                          {unreadCount} New
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllReadMutation.mutate()}
                        className="flex items-center gap-1 text-[10px] font-semibold text-brand-indigo dark:text-brand-cyan hover:opacity-80 transition-opacity"
                        title="Mark all as read"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        All read
                      </button>
                    )}
                  </div>

                  {/* Notification List */}
                  <div className="max-h-72 overflow-y-auto scrollbar-hide">
                    {notifList.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-dark-400 gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-dark-50 dark:bg-white/5 flex items-center justify-center border border-dark-100 dark:border-white/5">
                          <Bell className="w-6 h-6 opacity-30" />
                        </div>
                        <p className="text-sm font-medium">All caught up!</p>
                        <p className="text-xs text-dark-400">No new notifications</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-dark-50 dark:divide-white/5">
                        {notifList.slice(0, 5).map((n: any) => (
                          <div
                            key={n.id}
                            className={`flex gap-3 p-4 transition-colors group ${
                              !n.is_read
                                ? 'bg-brand-indigo/5 dark:bg-brand-indigo/8'
                                : 'hover:bg-dark-50 dark:hover:bg-white/5'
                            }`}
                          >
                            {/* Unread dot */}
                            <div className="mt-1.5 flex-shrink-0">
                              {!n.is_read ? (
                                <div className="w-2 h-2 rounded-full bg-brand-indigo dark:bg-brand-cyan shadow-[0_0_6px_rgba(99,102,241,0.6)]" />
                              ) : (
                                <div className="w-2 h-2 rounded-full bg-dark-200 dark:bg-white/10" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold leading-tight truncate ${
                                !n.is_read ? 'text-dark-900 dark:text-white' : 'text-dark-600 dark:text-dark-300'
                              }`}>
                                {n.title}
                              </p>
                              <p className="text-xs text-dark-500 dark:text-dark-400 mt-1 leading-relaxed line-clamp-2">
                                {n.message}
                              </p>
                              {n.created_at && (
                                <p className="text-[10px] text-dark-400 mt-1.5 font-medium">
                                  {new Date(n.created_at).toLocaleDateString([], {
                                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                  })}
                                </p>
                              )}
                            </div>
                            {!n.is_read && (
                              <button
                                onClick={() => markReadMutation.mutate(n.id)}
                                title="Mark as read"
                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-brand-indigo/10 text-brand-indigo dark:text-brand-cyan transition-all flex-shrink-0"
                              >
                                <Check className="w-3.5 h-3.5" />
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
                    className="block text-center text-xs font-semibold text-brand-indigo dark:text-brand-cyan py-4 border-t border-dark-100 dark:border-white/5 hover:bg-dark-50 dark:hover:bg-white/5 transition-colors"
                  >
                    View All Notifications →
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Profile dropdown */}
          <div ref={profileRef} className="relative ml-1">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowProfile(!showProfile)}
              className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-full bg-white dark:bg-white/5 hover:bg-dark-50 dark:hover:bg-white/10 border border-dark-100 dark:border-white/5 shadow-sm transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-indigo to-brand-cyan flex items-center justify-center text-white text-sm font-bold shadow-inner border border-white/20 overflow-hidden">
                {(user as any)?.face_image_url ? (
                  <img src={(user as any).face_image_url} alt={user?.full_name} className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-semibold text-dark-900 dark:text-white leading-tight">
                  {user?.full_name?.split(' ')[0] || 'User'}
                </p>
                <p className="text-[10px] text-brand-indigo dark:text-brand-cyan font-semibold uppercase tracking-wider">
                  {user?.role?.name?.replace('_', ' ') || '—'}
                </p>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-dark-400 hidden md:block transition-transform duration-200 ${showProfile ? 'rotate-180' : ''}`} />
            </motion.button>

            <AnimatePresence>
              {showProfile && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="absolute right-0 mt-3 w-64 bg-white dark:bg-dark-950/98 backdrop-blur-3xl shadow-2xl rounded-3xl border border-dark-100 dark:border-white/10 origin-top-right overflow-hidden z-50"
                >
                  <div className="px-5 py-4 border-b border-dark-100 dark:border-white/5 bg-gradient-to-br from-brand-indigo/5 dark:from-brand-indigo/10 to-transparent">
                    <p className="text-base font-bold text-dark-900 dark:text-white">{user?.full_name}</p>
                    <p className="text-xs text-dark-500 dark:text-dark-400 mt-0.5">{user?.email || user?.ic_number}</p>
                  </div>
                  <div className="py-2">
                    <Link
                      href="/dashboard/settings"
                      onClick={() => setShowProfile(false)}
                      className="flex items-center gap-3 px-5 py-3 text-sm font-medium text-dark-600 dark:text-dark-300 hover:text-dark-900 dark:hover:text-white hover:bg-dark-50 dark:hover:bg-white/5 transition-colors group"
                    >
                      <User className="w-[18px] h-[18px] text-dark-400 group-hover:text-brand-indigo dark:group-hover:text-brand-cyan transition-colors" />
                      Profile settings
                    </Link>
                    <Link
                      href="/dashboard/settings?tab=security"
                      onClick={() => setShowProfile(false)}
                      className="flex items-center gap-3 px-5 py-3 text-sm font-medium text-dark-600 dark:text-dark-300 hover:text-dark-900 dark:hover:text-white hover:bg-dark-50 dark:hover:bg-white/5 transition-colors group"
                    >
                      <Settings className="w-[18px] h-[18px] text-dark-400 group-hover:text-brand-indigo dark:group-hover:text-brand-cyan transition-colors" />
                      Account security
                    </Link>
                  </div>
                  <div className="border-t border-dark-100 dark:border-white/5 p-2">
                    <button
                      onClick={logout}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-brand-red hover:text-white hover:bg-brand-red rounded-2xl w-full text-left transition-all duration-300 group"
                    >
                      <LogOut className="w-[18px] h-[18px]" />
                      Sign out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>
    </>
  );
}
