'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { notificationsAPI } from '@/services/api';
import { Notification } from '@/types';
import { Bell, Check, CheckCheck, Calendar, FolderKanban, Award, Megaphone, Info, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const typeConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  event_reminder: { icon: Calendar, color: 'text-brand-cyan', bg: 'bg-brand-cyan/10', label: 'Event' },
  project_deadline: { icon: FolderKanban, color: 'text-brand-indigo', bg: 'bg-brand-indigo/10', label: 'Project' },
  certificate: { icon: Award, color: 'text-brand-amber', bg: 'bg-brand-amber/10', label: 'Certificate' },
  announcement: { icon: Megaphone, color: 'text-brand-purple', bg: 'bg-brand-purple/10', label: 'Announcement' },
  attendance: { icon: Check, color: 'text-brand-emerald', bg: 'bg-brand-emerald/10', label: 'Attendance' },
  alert: { icon: AlertCircle, color: 'text-brand-red', bg: 'bg-brand-red/10', label: 'Alert' },
};

const defaultType = { icon: Bell, color: 'text-dark-400', bg: 'bg-dark-100 dark:bg-white/5', label: 'Notification' };

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications-page'],
    queryFn: () => notificationsAPI.list({ size: 50 }),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationsAPI.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-page'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsAPI.markAllRead(),
    onSuccess: () => {
      toast.success('All notifications marked as read');
      queryClient.invalidateQueries({ queryKey: ['notifications-page'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  const notifications: Notification[] = data?.data?.items || [];
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Group by date
  const grouped = notifications.reduce<Record<string, Notification[]>>((acc, n) => {
    const key = n.created_at
      ? new Date(n.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      : 'Unknown date';
    if (!acc[key]) acc[key] = [];
    acc[key].push(n);
    return acc;
  }, {});

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6 max-w-3xl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-dark-900 dark:text-white">Notifications</h1>
          <p className="text-dark-500 dark:text-dark-400 mt-1 text-sm">
            {unreadCount > 0 ? (
              <span className="text-brand-indigo dark:text-brand-cyan font-semibold">{unreadCount} unread</span>
            ) : 'All caught up'} · {notifications.length} total
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all read
          </button>
        )}
      </div>

      {/* ── Content ── */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card p-5 flex items-center gap-4 animate-pulse">
              <div className="w-11 h-11 rounded-xl skeleton flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-1/3 rounded" />
                <div className="skeleton h-3 w-2/3 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="glass-card p-16 flex flex-col items-center justify-center text-center gap-5">
          <div className="w-20 h-20 rounded-3xl bg-dark-50 dark:bg-white/5 border border-dark-100 dark:border-white/10 flex items-center justify-center">
            <Bell className="w-10 h-10 text-dark-300 dark:text-dark-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-dark-900 dark:text-white">You're all caught up!</p>
            <p className="text-sm text-dark-500 dark:text-dark-400 mt-1">No notifications to show right now.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              {/* Date group label */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-bold text-dark-400 dark:text-dark-500 uppercase tracking-wider">
                  {date}
                </span>
                <div className="flex-1 h-px bg-dark-100 dark:bg-white/5" />
              </div>

              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {items.map((notif) => {
                    const cfg = typeConfig[notif.notification_type] || defaultType;
                    const Icon = cfg.icon;
                    return (
                      <motion.div
                        key={notif.id}
                        layout
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        whileHover={{ x: 3 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => !notif.is_read && markReadMutation.mutate(notif.id)}
                        className={`group relative flex items-start gap-4 p-5 rounded-2xl border transition-all duration-200 cursor-pointer ${
                          !notif.is_read
                            ? 'bg-brand-indigo/5 dark:bg-brand-indigo/8 border-brand-indigo/20 hover:bg-brand-indigo/8 dark:hover:bg-brand-indigo/12'
                            : 'bg-white dark:bg-white/[0.03] border-dark-100 dark:border-white/5 hover:bg-dark-50/80 dark:hover:bg-white/5 opacity-75 hover:opacity-100'
                        }`}
                      >
                        {/* Left accent bar for unread */}
                        {!notif.is_read && (
                          <div className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full bg-gradient-to-b from-brand-indigo to-brand-cyan" />
                        )}

                        {/* Type icon */}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                          <Icon className={`w-5 h-5 ${cfg.color}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm font-semibold leading-tight ${
                              !notif.is_read
                                ? 'text-dark-900 dark:text-white'
                                : 'text-dark-600 dark:text-dark-300'
                            }`}>
                              {notif.title}
                            </p>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                !notif.is_read
                                  ? 'bg-brand-indigo/10 text-brand-indigo dark:text-brand-cyan'
                                  : 'bg-dark-50 dark:bg-white/5 text-dark-400'
                              }`}>
                                {cfg.label}
                              </span>
                              {!notif.is_read && (
                                <div className="w-2 h-2 rounded-full bg-brand-indigo dark:bg-brand-cyan shadow-[0_0_6px_rgba(99,102,241,0.7)]" />
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-dark-500 dark:text-dark-400 mt-1.5 leading-relaxed line-clamp-2">
                            {notif.message}
                          </p>
                          {notif.created_at && (
                            <p className="text-[10px] text-dark-400 dark:text-dark-500 mt-2 font-medium">
                              {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {!notif.is_read && (
                                <span className="ml-2 text-brand-indigo dark:text-brand-cyan">
                                  · Click to mark as read
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
