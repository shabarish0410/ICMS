'use client';
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import CreateSessionForm from './CreateSessionForm';
import ActiveSessionCard from './ActiveSessionCard';
import { tokenStorage } from '@/services/api';
import { createClient } from '@/utils/supabase/client';

export default function AdminAttendance() {
  const [session, setSession] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [closing, setClosing] = useState(false);

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  
  const getHeaders = () => ({
    'Authorization': `Bearer ${tokenStorage.getToken()}`,
    'Content-Type': 'application/json',
  });

  // Supabase realtime subscription
  useEffect(() => {
    if (!session) return;
    
    // Fetch initial records for this session securely via Edge Function
    const fetchRecords = async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/get-attendance-records?session_id=${session.id}`, {
          headers: getHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          setRecords(data);
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
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-session`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create session');
      }

      const newSession = await res.json();
      setSession(newSession);
      setRecords([]);
      toast.success('Session created successfully');
    } catch (err: any) {
      toast.error(err.message);
      throw err;
    }
  };

  const handleCloseSession = async () => {
    if (!session) return;
    setClosing(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/close-session`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ session_id: session.id }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to close session');
      }

      toast.success('Session closed');
      setSession(null);
      setRecords([]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      {!session ? (
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
