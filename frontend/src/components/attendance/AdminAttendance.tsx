'use client';
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import CreateSessionForm from './CreateSessionForm';
import ActiveSessionCard from './ActiveSessionCard';
import { tokenStorage, dashboardAPI, attendanceAPI } from '@/services/api';
import { createClient } from '@/utils/supabase/client';

export default function AdminAttendance() {
  const [session, setSession] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [closing, setClosing] = useState(false);
  const [loading, setLoading] = useState(true);

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

  // Fetch active session on mount and poll
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await dashboardAPI.myActiveAttendanceSession();
        setSession(res.data || null);
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
  
  const getHeaders = () => ({
    'Authorization': `Bearer ${tokenStorage.getToken()}`,
    'Content-Type': 'application/json',
  });

  // Supabase realtime subscription
  useEffect(() => {
    if (!session) return;
    
    // Fetch initial records for this session securely via Backend
    const fetchRecords = async () => {
      try {
        const res = await attendanceAPI.getRecords(session.id);
        if (res.data) {
          setRecords(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch initial records", err);
      }
    };
    
    fetchRecords();

    // Subscribe to realtime inserts
    const supabase = createClient();
    const channel = supabase
      .channel(`attendance_records_${session.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance_records',
          filter: `session_id=eq.${session.id}`
        },
        (payload) => {
          setRecords((prev) => [payload.new, ...prev]);
          toast.success(`${payload.new.student_name} marked attendance!`);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  const handleCreateSession = async (data: any) => {
    try {
      const res = await attendanceAPI.createSession(data);
      if (res.data && res.data.success) {
        setSession(res.data.session);
        setRecords([]);
        toast.success('Session created successfully');
      } else {
        throw new Error('Failed to create session');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.message);
      throw err;
    }
  };

  const handleCloseSession = async () => {
    if (!session) return;
    setClosing(true);
    try {
      await attendanceAPI.closeSession(session.id);
      toast.success('Session closed');
      setSession(null);
      setRecords([]);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.message);
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      {loading ? (
        <div className="flex justify-center items-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
  );
}
