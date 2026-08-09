'use client';
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { tokenStorage } from '@/services/api';

// ─── Supabase Edge Function caller ───────────────────────────────────────────
// Calls a Supabase Edge Function directly (not through FastAPI proxy).
// Auth token from ICMS JWT is passed as Bearer header.
async function callEdgeFunction(name: string, body: object): Promise<any> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const token = tokenStorage.getToken(); // ICMS custom JWT

  const res = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': anonKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Edge function error: ${res.status}`);
  return data;
}

// ─── WebAuthn helpers ─────────────────────────────────────────────────────────

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const padded = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const binary = atob(padded + '='.repeat(padLen));
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

function bufferToBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Perform WebAuthn registration (first-time biometric setup).
 * Returns the registration response object ready to send to register-verify.
 */
async function registerBiometric(options: any): Promise<PublicKeyCredential> {
  const createOptions: PublicKeyCredentialCreationOptions = {
    ...options,
    challenge: base64urlToBuffer(options.challenge),
    user: {
      ...options.user,
      id: base64urlToBuffer(options.user.id),
    },
    excludeCredentials: (options.excludeCredentials || []).map((c: any) => ({
      ...c,
      id: base64urlToBuffer(c.id),
    })),
  };

  const credential = await navigator.credentials.create({ publicKey: createOptions }) as PublicKeyCredential;
  if (!credential) throw new Error('Biometric registration cancelled.');
  return credential;
}

/**
 * Perform WebAuthn authentication (returning student).
 * Returns the assertion response object ready to send to auth-verify.
 */
async function authenticateBiometric(options: any): Promise<PublicKeyCredential> {
  const getOptions: PublicKeyCredentialRequestOptions = {
    ...options,
    challenge: base64urlToBuffer(options.challenge),
    allowCredentials: (options.allowCredentials || []).map((c: any) => ({
      ...c,
      id: base64urlToBuffer(c.id),
    })),
  };

  const credential = await navigator.credentials.get({ publicKey: getOptions }) as PublicKeyCredential;
  if (!credential) throw new Error('Biometric authentication cancelled.');
  return credential;
}

/** Serialize a PublicKeyCredential into a plain JSON-safe object. */
function serializeCredential(cred: PublicKeyCredential, type: 'create' | 'get') {
  const response = cred.response as any;
  const base: any = {
    id: cred.id,
    rawId: bufferToBase64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
    },
  };

  if (type === 'create') {
    base.response.attestationObject = bufferToBase64url(response.attestationObject);
  } else {
    base.response.authenticatorData = bufferToBase64url(response.authenticatorData);
    base.response.signature = bufferToBase64url(response.signature);
    if (response.userHandle) base.response.userHandle = bufferToBase64url(response.userHandle);
  }

  return base;
}

// ─── Scan Page ────────────────────────────────────────────────────────────────

type Step = 'input' | 'biometric' | 'processing' | 'success' | 'error';

function ScanAttendanceContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');

  const [icNumber, setIcNumber] = useState('');
  const [step, setStep] = useState<Step>('input');
  const [statusMessage, setStatusMessage] = useState('');
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const fetchedRef = useRef(false);

  // Load session info on mount
  useEffect(() => {
    if (!sessionId || fetchedRef.current) return;
    fetchedRef.current = true;

    fetch(`/api/attendance/session/${sessionId}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Session not found');
        }
        return res.json();
      })
      .then((data) => {
        setSessionInfo(data);
        if (!data.is_active) setSessionError('This attendance session has been closed.');
      })
      .catch((err) => setSessionError(err.message || 'Failed to load session. Please try again.'))
      .finally(() => setSessionLoading(false));
  }, [sessionId]);

  const getBrowserLocation = async (): Promise<{ lat: number; lng: number } | null> => {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 })
      );
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch (err: any) {
      if (err.code === 1) throw new Error('Please enable location access to mark attendance.');
      return null;
    }
  };

  // Step 1: Student submits IC number → move to biometric step
  const handleSubmitId = (e: React.FormEvent) => {
    e.preventDefault();
    if (!icNumber.trim() || !sessionId) return;
    if (sessionInfo && !sessionInfo.is_active) {
      setStatusMessage('This attendance session has been closed.');
      setStep('error');
      return;
    }
    setStep('biometric');
  };

  // Step 2: Trigger WebAuthn biometric prompt, then mark attendance
  const handleBiometric = async () => {
    if (!sessionId) return;
    setStep('processing');

    try {
      let coords: { lat: number; lng: number } | null = null;
      if (sessionInfo?.gps_radius) {
        setStatusMessage('Requesting GPS location...');
        coords = await getBrowserLocation();
      }

      setStatusMessage('Checking your registered biometrics...');

      // Try authentication first (returning student)
      let authOptions: any;
      let isFirstTime = false;

      try {
        authOptions = await callEdgeFunction('webauthn-auth-options', { session_id: sessionId });
      } catch (err: any) {
        if (err.message.includes('No biometric') || err.message.includes('NO_CREDENTIALS')) {
          isFirstTime = true;
        } else {
          throw err;
        }
      }

      let credentialSerialized: any;

      if (isFirstTime) {
        // First-time registration
        setStatusMessage('Setting up your device security for the first time...');
        const regOptions = await callEdgeFunction('webauthn-register-options', { session_id: sessionId });
        setStatusMessage('Follow the device prompt to register (fingerprint, Face ID, or PIN)...');

        const regCred = await registerBiometric(regOptions);
        credentialSerialized = serializeCredential(regCred, 'create');

        setStatusMessage('Saving your biometric credential...');
        await callEdgeFunction('webauthn-register-verify', {
          challenge: regOptions.challenge,
          credential: credentialSerialized,
          device_label: navigator.platform || 'Mobile Device',
        });

        // Now run auth flow immediately after registration
        setStatusMessage('Verifying biometric to mark attendance...');
        authOptions = await callEdgeFunction('webauthn-auth-options', { session_id: sessionId });
        const authCred = await authenticateBiometric(authOptions);
        credentialSerialized = serializeCredential(authCred, 'get');
      } else {
        // Returning student — just authenticate
        setStatusMessage('Follow the device prompt to verify your identity...');
        const authCred = await authenticateBiometric(authOptions);
        credentialSerialized = serializeCredential(authCred, 'get');
      }

      setStatusMessage('Marking your attendance...');
      await callEdgeFunction('webauthn-auth-verify', {
        challenge: authOptions.challenge,
        session_id: sessionId,
        credential: credentialSerialized,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
      });

      setStep('success');
    } catch (err: any) {
      console.error(err);
      const msg = err.name === 'NotAllowedError'
        ? 'Biometric authentication was cancelled or timed out. Please try again.'
        : err.name === 'SecurityError'
        ? 'Biometric authentication requires HTTPS. Please use the secure site URL.'
        : err.message || 'An error occurred. Please try again.';
      setStatusMessage(msg);
      setStep('error');
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

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
          {sessionLoading && <p className="text-blue-100 text-sm mt-1 animate-pulse">Loading session...</p>}
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
          {/* Step: Enter ID */}
          {step === 'input' && (
            <>
              {sessionError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  ⚠️ {sessionError}
                </div>
              )}
              <form onSubmit={handleSubmitId} className="space-y-4">
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
                  <p className="text-xs text-gray-400 mt-1">Enter your IC ID or full name as registered</p>
                </div>
                <button
                  type="submit"
                  disabled={!icNumber.trim() || sessionLoading || (sessionInfo !== null && !sessionInfo?.is_active)}
                  className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                >
                  {sessionLoading ? 'Loading Session...' : 'Continue →'}
                </button>
              </form>
            </>
          )}

          {/* Step: Biometric prompt */}
          {step === 'biometric' && (
            <div className="text-center py-4 space-y-6">
              {/* Fingerprint icon */}
              <div className="flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-blue-100 dark:bg-blue-900/40 animate-ping opacity-40"></div>
                  <div className="relative h-28 w-28 rounded-full bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 flex items-center justify-center">
                    <svg className="h-16 w-16 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C9 2 6.5 4.2 6.5 7c0 1.8.9 3.4 2.3 4.4" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.5 7c0-2.8-2.5-5-5.5-5" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9c-1.7 0-3 1.3-3 3v1" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12c0-1.7-1.3-3-3-3" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v4" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12c0 1.7 1.3 3 3 3s3-1.3 3-3" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 10.5c-.3.8-.5 1.6-.5 2.5 0 3.3 2.7 6 6 6" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.5 10.5c.3.8.5 1.6.5 2.5 0 1.5-.5 2.9-1.3 4" />
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Identity Verification</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
                  Your device will prompt you to verify your identity (fingerprint, Face ID, or device PIN).
                </p>
                <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                  Marking attendance as: <span className="font-semibold text-gray-700 dark:text-gray-300">{icNumber}</span>
                </p>
              </div>

              <button
                onClick={handleBiometric}
                className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 transition text-lg flex items-center justify-center gap-2"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C9 2 6.5 4.2 6.5 7c0 1.8.9 3.4 2.3 4.4" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.5 7c0-2.8-2.5-5-5.5-5" />
                </svg>
                Verify with Device Security
              </button>

              <button
                onClick={() => setStep('input')}
                className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
              >
                ← Back
              </button>
            </div>
          )}

          {/* Step: Processing */}
          {step === 'processing' && (
            <div className="text-center py-8 space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
              <p className="text-gray-600 dark:text-gray-400 animate-pulse font-medium">{statusMessage}</p>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <div className="text-center py-8 space-y-4">
              <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100 dark:bg-green-900">
                <svg className="h-10 w-10 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance Marked!</h3>
                <p className="text-green-600 dark:text-green-400 font-medium mt-1">Identity verified — You are marked Present ✓</p>
                <p className="text-gray-500 text-sm mt-2">You may close this window.</p>
              </div>
            </div>
          )}

          {/* Step: Error */}
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
