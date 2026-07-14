'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { notificationsAPI } from '@/services/api';
import { Notification } from '@/types';
import { Bell, Check, CheckCheck, Calendar, FolderKanban, Award, Megaphone } from 'lucide-react';
import toast from 'react-hot-toast';

const typeIcons: Record<string, any> = {
  event_reminder: Calendar,
  project_deadline: FolderKanban,
  certificate: Award,
  announcement: Megaphone,
  attendance: Check,
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsAPI.list({ size: 50 }),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationsAPI.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsAPI.markAllRead(),
    onSuccess: () => {
      toast.success('All notifications marked as read');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  const notifications = data?.data?.items || [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Notifications</h1>
          <p className="text-dark-500 dark:text-dark-400 mt-1">Stay updated with latest activities</p>
        </div>
        <button onClick={() => markAllMutation.mutate()} className="btn-secondary text-sm">
          <CheckCheck className="w-4 h-4" /> Mark all as read
        </button>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass-card p-4 flex items-center gap-4">
              <div className="skeleton w-10 h-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-1/3" />
                <div className="skeleton h-3 w-2/3" />
              </div>
            </div>
          ))
        ) : notifications.length > 0 ? (
          notifications.map((notif: Notification) => {
            const Icon = typeIcons[notif.notification_type] || Bell;
            return (
              <motion.div
                key={notif.id}
                whileHover={{ x: 2 }}
                onClick={() => !notif.is_read && markReadMutation.mutate(notif.id)}
                className={`glass-card p-4 flex items-center gap-4 cursor-pointer transition-all ${!notif.is_read ? 'border-l-4 border-l-primary-500' : 'opacity-70'}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${!notif.is_read ? 'bg-primary-100 dark:bg-primary-500/10' : 'bg-dark-100 dark:bg-dark-800'}`}>
                  <Icon className={`w-5 h-5 ${!notif.is_read ? 'text-primary-600 dark:text-primary-400' : 'text-dark-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${!notif.is_read ? 'text-dark-900 dark:text-white' : 'text-dark-500'}`}>
                    {notif.title}
                  </p>
                  <p className="text-xs text-dark-400 truncate">{notif.message}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-dark-400">
                    {notif.created_at ? new Date(notif.created_at).toLocaleDateString() : ''}
                  </p>
                  {!notif.is_read && <div className="w-2 h-2 rounded-full bg-primary-500 ml-auto mt-1" />}
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="text-center py-16">
            <Bell className="w-12 h-12 text-dark-300 mx-auto mb-3" />
            <p className="text-dark-400">No notifications yet</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
