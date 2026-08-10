'use client';
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import CreateSessionForm from './CreateSessionForm';
import ActiveSessionCard from './ActiveSessionCard';
import AttendanceHistoryTab from './AttendanceHistoryTab';
import MonthlyReportTab from './MonthlyReportTab';
import { tokenStorage, dashboardAPI, attendanceAPI } from '@/services/api';
import { createClient } from '@/utils/supabase/client';

type Tab = 'live' | 'history' | 'monthly';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'live', label: 'Live Session', icon: '📡' },
  { id: 'history', label: 'Daily History', icon: '📋' },
  { id: 'monthly', label: 'Monthly Report', icon: '📊' },
];

export default function AdminAttendance() {
  const [activeTab, setActiveTab] = useState<Tab>('live');
  const [session, setSession] = useState<Record<string, unknown> | null>(null);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [closing, setClosing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch active session on mount and poll
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await dashboardAPI.myActiveAttendanceSession();
        setSession((res.data as Record<string, unknown>) || null);
      } catch (err) {
        console.error('Failed to fetch active session', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSession();

    const intervalId = setInterval(fetchSession, 10000);
    return () => clearInterval(intervalId);
  }, []);

  // Supabase realtime subscription for active session
  useEffect(() => {
    if (!session) return;

    // Fetch initial records for this session securely via Backend
    const fetchRecords = async () => {
      try {
        const sessionId = session.id as string;
        const res = await attendanceAPI.getRecords(sessionId);
        if (res.data) {
          setRecords(res.data as Record<string, unknown>[]);
        }
      } catch (err) {
        console.error('Failed to fetch initial records', err);
      }
    };

    fetchRecords();

    // Subscribe to realtime inserts
    const supabase = createClient();
    const sessionId = session.id as string;
    const channel = supabase
      .channel(`attendance_records_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance_records',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const newRecord = payload.new as Record<string, unknown>;
          setRecords((prev) => [newRecord, ...prev]);
          toast.success(`${newRecord.student_name} marked attendance!`);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  const handleCreateSession = async (data: {
    subject_name: string;
    section: string;
    duration_minutes: number;
    gps_latitude?: number;
    gps_longitude?: number;
    gps_radius?: number;
  }) => {
    try {
      const res = await attendanceAPI.createSession(data);
      if (res.data && (res.data as { success?: boolean }).success) {
        setSession((res.data as { session: Record<string, unknown> }).session);
        setRecords([]);
        toast.success('Session created successfully');
      } else {
        throw new Error('Failed to create session');
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      toast.error(e.response?.data?.detail || e.message || 'Failed to create session');
      throw err;
    }
  };

  const handleCloseSession = async () => {
    if (!session) return;
    setClosing(true);
    try {
      await attendanceAPI.closeSession(session.id as string);
      toast.success('Session closed');
      setSession(null);
      setRecords([]);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      toast.error(e.response?.data?.detail || e.message || 'Failed to close session');
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.id === 'live' && session && (
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'live' && (
        <div>
          {loading ? (
            <div className="flex justify-center items-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : !session ? (
            <CreateSessionForm onCreate={handleCreateSession} />
          ) : (
            <ActiveSessionCard
              session={session}
              records={records}
              onCloseSession={handleCloseSession}
              closing={closing}
            />
          )}
        </div>
      )}

      {activeTab === 'history' && <AttendanceHistoryTab />}

      {activeTab === 'monthly' && <MonthlyReportTab />}
    </div>
  );
}
