'use client';
import React, { useState } from 'react';
import AttendanceScanner from './AttendanceScanner';
import { tokenStorage } from '@/services/api';
import toast from 'react-hot-toast';

type Step = 'scan' | 'processing' | 'success' | 'error';

export default function StudentAttendance() {
  const [step, setStep] = useState<Step>('scan');
  const [statusMessage, setStatusMessage] = useState('');
  const [markedRecord, setMarkedRecord] = useState<any>(null);

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const getHeaders = () => ({
    'Authorization': `Bearer ${tokenStorage.getToken()}`,
    'Content-Type': 'application/json',
  });

  const getBrowserLocation = async (): Promise<{ lat: number, lng: number } | null> => {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch (err: any) {
      if (err.code === 1 || err.message?.includes('User denied')) {
        throw new Error('Please enable location access to mark attendance.');
      }
      // Non-fatal error for non-GPS required sessions handled by Edge function
      return null; 
    }
  };

  const handleScan = async (sessionId: string) => {
    setStep('processing');
    try {
      // 1. Verify session
      const sessionRes = await fetch(`${SUPABASE_URL}/functions/v1/get-session?session_id=${sessionId}`, {
        headers: getHeaders()
      });

      if (!sessionRes.ok) {
        const errorData = await sessionRes.json();
        throw new Error(errorData.error || 'Failed to verify session.');
      }

      const session = await sessionRes.json();
      
      if (!session.is_active) {
        throw new Error('This attendance session has been closed.');
      }

      // 2. Request GPS if needed
      let coords: { lat: number, lng: number } | null = null;
      if (session.gps_radius) {
        setStatusMessage('Requesting GPS permission...');
        coords = await getBrowserLocation();
      }

      // 3. Mark Attendance
      setStatusMessage('Marking attendance securely...');
      const markRes = await fetch(`${SUPABASE_URL}/functions/v1/mark-attendance`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          session_id: sessionId,
          latitude: coords?.lat,
          longitude: coords?.lng,
          device_id: navigator.userAgent
        })
      });

      if (!markRes.ok) {
        const errorData = await markRes.json();
        throw new Error(errorData.error || 'Failed to mark attendance.');
      }

      const record = await markRes.json();
      setMarkedRecord({ ...record, session });
      setStep('success');

    } catch (err: any) {
      console.error(err);
      setStatusMessage(err.message);
      setStep('error');
    }
  };

  const resetScanner = () => {
    setStep('scan');
    setStatusMessage('');
    setMarkedRecord(null);
  };

  return (
    <div className="max-w-lg mx-auto p-4 space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md border text-center">
        <h2 className="text-2xl font-bold mb-2">Mark Attendance</h2>
        
        {step === 'scan' || step === 'processing' ? (
          <>
            <p className="text-gray-600 mb-6">Scan the QR code displayed by your faculty.</p>
            <AttendanceScanner onScan={handleScan} isProcessing={step === 'processing'} />
            {statusMessage && <p className="mt-4 text-sm text-blue-600">{statusMessage}</p>}
          </>
        ) : step === 'success' ? (
          <div className="space-y-4 py-8">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-green-700">Attendance Marked!</h3>
            {markedRecord?.session && (
              <div className="text-gray-600">
                <p className="font-semibold text-gray-800">{markedRecord.session.subject_name}</p>
                {markedRecord.session.section && <p>{markedRecord.session.section}</p>}
                <p className="text-sm mt-2">Marked at {new Date(markedRecord.marked_at).toLocaleTimeString()}</p>
              </div>
            )}
            <button onClick={resetScanner} className="mt-4 px-4 py-2 border rounded hover:bg-gray-50 transition">
              Scan Another Session
            </button>
          </div>
        ) : (
          <div className="space-y-4 py-8">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-red-700">Failed to Mark Attendance</h3>
            <p className="text-gray-700 max-w-sm mx-auto">{statusMessage}</p>
            <button onClick={resetScanner} className="mt-4 px-4 py-2 border rounded hover:bg-gray-50 transition">
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
