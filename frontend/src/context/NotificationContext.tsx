'use client';

import React, { createContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { createClient } from '@/utils/supabase/client';
import toast from 'react-hot-toast';

const NotificationContext = createContext<undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const channel = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notif = payload.new;
          toast(notif.message, {
            icon: '🔔',
            duration: 5000,
            style: {
              background: '#333',
              color: '#fff',
            }
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isAuthenticated, supabase]);

  return (
    <NotificationContext.Provider value={undefined}>
      {children}
    </NotificationContext.Provider>
  );
}
