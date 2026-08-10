'use client';
import React, { useState, useEffect } from 'react';
import { dashboardAPI } from '@/services/api';
import AttendanceQRCode from './AttendanceQRCode';

export default function StudentAttendance() {
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await dashboardAPI.activeAttendanceSessions();
        if (res.data) {
          setActiveSessions(res.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();

    // Poll for changes since realtime RLS is restricted
    const intervalId = setInterval(() => {
      dashboardAPI.activeAttendanceSessions()
        .then(res => {
          if (res.data) setActiveSessions(res.data);
        })
        .catch(console.error);
    }, 10000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Active Attendance Sessions</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Scan the QR code with your mobile phone's camera to mark your attendance.
        </p>
      </div>

      {activeSessions.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 text-center">
          <h3 className="text-xl font-medium text-gray-700 dark:text-gray-300">No active sessions right now</h3>
          <p className="text-gray-500 mt-2">Wait for your faculty to start a session.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeSessions.map((session) => (
            <div key={session.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 flex flex-col items-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{session.subject_name}</h3>
              {session.section && <p className="text-sm text-gray-500 mb-4">Section: {session.section}</p>}
              
              <div className="my-4">
                <AttendanceQRCode sessionId={session.id} />
              </div>
              
              {session.gps_radius && (
                <p className="text-xs text-gray-500 flex items-center mt-2">
                  <svg className="w-4 h-4 mr-1 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  GPS Radius: {session.gps_radius}m
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
