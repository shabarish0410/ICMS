'use client';
import React from 'react';
import AttendanceQRCode from './AttendanceQRCode';
import AttendanceLiveTable from './AttendanceLiveTable';

interface ActiveSessionCardProps {
  session: any;
  records: any[];
  onCloseSession: () => void;
  closing: boolean;
}

export default function ActiveSessionCard({ session, records, onCloseSession, closing }: ActiveSessionCardProps) {
  if (!session) return null;

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">{session.subject_name}</h2>
          {session.section && <p className="text-gray-600">Section: {session.section}</p>}
        </div>
        <div className="text-right">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Active Session
          </span>
          <p className="text-sm text-gray-500 mt-1">
            Expires: {new Date(session.expires_at).toLocaleTimeString()}
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <div className="md:w-1/3 flex flex-col items-center">
          <AttendanceQRCode sessionId={session.id} />
          {session.gps_radius && (
            <p className="text-sm text-gray-500 mt-2 text-center">
              📍 GPS Restricted: {session.gps_radius}m radius
            </p>
          )}
        </div>
        
        <div className="md:w-2/3 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Live Attendance ({records.length})</h3>
            <button
              onClick={onCloseSession}
              disabled={closing}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {closing ? 'Closing...' : 'Close Session'}
            </button>
          </div>
          <AttendanceLiveTable records={records} />
        </div>
      </div>
    </div>
  );
}
