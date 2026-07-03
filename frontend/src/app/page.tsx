'use client';

import { redirect } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useEffect } from 'react';

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        window.location.href = '/dashboard';
      } else {
        window.location.href = '/login';
      }
    }
  }, [isAuthenticated, isLoading]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 animate-pulse" />
        <p className="text-dark-400 text-sm">Loading Spark Innovation Center...</p>
      </div>
    </div>
  );
}
