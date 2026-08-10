'use client';
import React, { useState, useEffect } from 'react';
import { dashboardAPI } from '@/services/api';
import AttendanceQRCode from './AttendanceQRCode';
import StudentHistorySection from './StudentHistorySection';

interface AttendanceSession {
  id: string;
  subject_name: string;
  section?: string;
  gps_radius?: number;
}

export default function StudentAttendance() {
  const [activeSessions, setActiveSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await dashboardAPI.activeAttendanceSessions();
        if (res.data) {
          setActiveSessions(res.data as AttendanceSession[]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();

    // Poll for changes since realtime RLS is restricted for students
    const intervalId = setInterval(() => {
      dashboardAPI
        .activeAttendanceSessions()
        .then((res) => {
          if (res.data) setActiveSessions(res.data as AttendanceSession[]);
        })
        .catch(console.error);
    }, 10000);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-10">
      {/* ── Section 1: Active Sessions ─────────────────────────────────────── */}
      <section>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-2xl">📡</span>
            Active Attendance Sessions
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
            Scan the QR code with your mobile camera to mark attendance.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : activeSessions.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 text-center">
            <div className="text-4xl mb-3">🕐</div>
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">No active sessions right now</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
              Wait for your faculty to start a session.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {activeSessions.map((session) => (
              <div
                key={session.id}
                className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 flex flex-col items-center"
              >
                <div className="w-full mb-3">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white text-center">
                    {session.subject_name}
                  </h3>
                  {session.section && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-0.5">
                      Section: {session.section}
                    </p>
                  )}
                </div>

                <div className="my-3">
                  <AttendanceQRCode sessionId={session.id} />
                </div>

                {session.gps_radius && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center mt-2">
                    <svg className="w-3.5 h-3.5 mr-1 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    GPS: {session.gps_radius}m radius
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Divider ────────────────────────────────────────────────────────── */}
      <div className="border-t border-gray-200 dark:border-gray-700" />

      {/* ── Section 2: Attendance History ──────────────────────────────────── */}
      <section>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-2xl">📊</span>
            My Attendance History
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
            View your attendance record, percentage, and subject-wise breakdown.
            Percentage is based only on sessions your section was expected to attend.
          </p>
        </div>
        <StudentHistorySection />
      </section>
    </div>
  );
}
