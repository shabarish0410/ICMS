'use client';
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

// Use Next.js API proxy to avoid Windows Firewall blocking port 8000 on mobile
function getBackendBase(): string {
  // Return empty string so fetch hits the same host and port (the Next.js server on port 3000)
  return '';
}

function ScanAttendanceContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');

  const [icNumber, setIcNumber] = useState('');
  const [step, setStep] = useState<'input' | 'processing' | 'success' | 'error'>('input');
  const [statusMessage, setStatusMessage] = useState('');
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!sessionId || fetchedRef.current) return;
    fetchedRef.current = true;

    const base = getBackendBase();
    fetch(`${base}/api/attendance/session/${sessionId}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Session not found');
        }
        return res.json();
      })
      .then((data) => {
        setSessionInfo(data);
        if (!data.is_active) {
          setSessionError('This attendance session has been closed.');
        }
      })
      .catch((err) => {
        setSessionError(err.message || 'Failed to load session. Please try again.');
      })
      .finally(() => {
        setSessionLoading(false);
      });
  }, [sessionId]);

  const getBrowserLocation = async (): Promise<{ lat: number; lng: number } | null> => {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
        })
      );
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch (err: any) {
      if (err.code === 1 || err.message?.includes('User denied')) {
        throw new Error('Please enable location access to mark attendance.');
      }
      return null;
    }
  };

  const handleMarkAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !icNumber.trim()) return;

    setStep('processing');
    setStatusMessage('Verifying session...');

    try {
      // If sessionInfo is loaded and already closed, reject early
      if (sessionInfo && !sessionInfo.is_active) {
        throw new Error('This attendance session has been closed.');
      }

      let coords: { lat: number; lng: number } | null = null;
      if (sessionInfo?.gps_radius) {
        setStatusMessage('Requesting GPS permission...');
        coords = await getBrowserLocation();
      }

      setStatusMessage('Marking attendance...');

      const base = getBackendBase();
      const markRes = await fetch(`${base}/api/attendance/mark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          ic_number: icNumber.trim().toUpperCase(),
          latitude: coords?.lat,
          longitude: coords?.lng,
          device_id: navigator.userAgent,
        }),
      });

      const markData = await markRes.json();
      if (!markRes.ok) {
        throw new Error(markData.detail || 'Failed to mark attendance.');
      }

      setStep('success');
    } catch (err: any) {
      console.error(err);
      setStatusMessage(err.message || 'An error occurred. Please try again.');
      setStep('error');
    }
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="text-center text-gray-500">Invalid session link. Please scan a valid QR code.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">

        {/* Header */}
        <div className="p-6 text-center border-b border-gray-200 dark:border-gray-700 bg-blue-600">
          <h2 className="text-2xl font-bold text-white">Smart QR Attendance</h2>
          {sessionLoading && (
            <p className="text-blue-100 text-sm mt-1 animate-pulse">Loading session...</p>
          )}
          {!sessionLoading && sessionInfo && (
            <div className="mt-2 text-sm text-blue-100">
              <p className="font-semibold text-white">{sessionInfo.subject_name}</p>
              {sessionInfo.section && <p>Section: {sessionInfo.section}</p>}
              <p className="text-xs mt-1 opacity-80">
                Expires: {new Date(sessionInfo.expires_at).toLocaleTimeString()}
              </p>
            </div>
          )}
          {!sessionLoading && sessionError && !sessionInfo && (
            <p className="text-red-200 text-sm mt-2">{sessionError}</p>
          )}
        </div>

        <div className="p-6">
          {step === 'input' && (
            <>
              {sessionError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  ⚠️ {sessionError}
                </div>
              )}
              <form onSubmit={handleMarkAttendance} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Innovation Center ID (ICID) or Name
                  </label>
                  <input
                    type="text"
                    required
                    value={icNumber}
                    onChange={(e) => setIcNumber(e.target.value)}
                    placeholder="e.g. IC2024001 or John Doe"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-lg font-mono tracking-wider"
                  />
                  <p className="text-xs text-gray-400 mt-1">Enter your IC ID or full Name exactly as registered (e.g. IC2024004)</p>
                </div>
                <button
                  type="submit"
                  disabled={!icNumber.trim() || (sessionInfo !== null && !sessionInfo?.is_active)}
                  className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                >
                  {sessionLoading ? 'Loading Session...' : 'Mark My Attendance ✓'}
                </button>
              </form>
            </>
          )}

          {step === 'processing' && (
            <div className="text-center py-8 space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
              <p className="text-gray-600 dark:text-gray-400 animate-pulse font-medium">{statusMessage}</p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8 space-y-4">
              <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100 dark:bg-green-900">
                <svg className="h-10 w-10 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance Marked!</h3>
                <p className="text-green-600 dark:text-green-400 font-medium mt-1">You are marked Present ✓</p>
                <p className="text-gray-500 text-sm mt-2">You may close this window.</p>
              </div>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center py-8 space-y-4">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-900">
                <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Failed</h3>
                <p className="text-red-600 dark:text-red-400 font-medium mt-1">{statusMessage}</p>
              </div>
              <button
                onClick={() => { setStep('input'); setStatusMessage(''); }}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ScanAttendancePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading scanner...</p>
        </div>
      </div>
    }>
      <ScanAttendanceContent />
    </Suspense>
  );
}
