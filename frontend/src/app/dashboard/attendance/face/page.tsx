'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { faceAttendanceAPI, faceAPI } from '@/services/api';
import {
  Camera, CheckCircle, XCircle, AlertCircle, Shield,
  Eye, Clock, RefreshCw, ArrowLeft, Loader2, Smile, ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Liveness Prompt Steps ──────────────────────────────────────────────────────
const LIVENESS_STEPS = [
  { id: 'blink', label: 'Blink your eyes', icon: '👁️', duration: 3000 },
  { id: 'left', label: 'Turn head LEFT slightly', icon: '⬅️', duration: 2500 },
  { id: 'right', label: 'Turn head RIGHT slightly', icon: '➡️', duration: 2500 },
  { id: 'center', label: 'Look straight ahead', icon: '👀', duration: 2000 },
];

type AttendanceState =
  | 'checking_registration'
  | 'not_registered'
  | 'ready'
  | 'opening_camera'
  | 'liveness'
  | 'capturing'
  | 'processing'
  | 'success'
  | 'error';

interface ValidationStep {
  step: string;
  label: string;
  status: 'pending' | 'running' | 'pass' | 'fail';
  message?: string;
}

const VALIDATION_LABELS: Record<string, string> = {
  face_registered_check: 'Face Registration',
  image_decode: 'Image Processing',
  face_detect: 'Face Detection',
  liveness_check: 'Liveness Verification',
  embedding_generate: 'Analyzing Face',
  embedding_load: 'Loading Profile',
  face_match: 'Face Match',
  dress_code: 'Dress Code Check',
  time_window: 'Time Window',
  duplicate_check: 'Duplicate Check',
  attendance_saved: 'Saving Attendance',
};

export default function FaceAttendancePage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const framesRef = useRef<string[]>([]);

  const [state, setState] = useState<AttendanceState>('checking_registration');
  const [livenessStep, setLivenessStep] = useState(0);
  const [livenessFrames, setLivenessFrames] = useState<string[]>([]);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [validationSteps, setValidationSteps] = useState<ValidationStep[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flashEffect, setFlashEffect] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Check registration status ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await faceAPI.myStatus();
        if (!res.data.face_registered) {
          setState('not_registered');
        } else {
          setState('ready');
        }
      } catch {
        setState('ready'); // Allow attempt even if status check fails
      }
    })();
  }, []);

  // ── Camera ─────────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setState('opening_camera');
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState('liveness');
      setLivenessStep(0);
      setLivenessFrames([]);
      framesRef.current = [];
    } catch (err: any) {
      setError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access and try again.'
          : 'Could not open camera. Please check your device.'
      );
      setState('ready');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // ── Capture single frame ───────────────────────────────────────────────────
  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // Mirror
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.85);
  }, []);

  // ── Liveness flow: auto-advance through steps, collect frames ─────────────
  useEffect(() => {
    if (state !== 'liveness') return;

    const step = LIVENESS_STEPS[livenessStep];
    if (!step) return;

    // Collect frames during each step
    const frameInterval = setInterval(() => {
      const frame = captureFrame();
      if (frame) {
        framesRef.current = [...framesRef.current, frame];
        setLivenessFrames([...framesRef.current]);
      }
    }, 300);

    // Advance to next step after duration
    const advanceTimer = setTimeout(() => {
      clearInterval(frameInterval);
      if (livenessStep < LIVENESS_STEPS.length - 1) {
        setLivenessStep((s) => s + 1);
      } else {
        // All liveness steps done — do final capture
        setState('capturing');
        clearInterval(frameInterval);
      }
    }, step.duration);

    return () => {
      clearInterval(frameInterval);
      clearTimeout(advanceTimer);
    };
  }, [state, livenessStep, captureFrame]);

  // ── Final capture after liveness ───────────────────────────────────────────
  useEffect(() => {
    if (state !== 'capturing') return;

    let cd = 3;
    setCountdown(cd);

    const cdInterval = setInterval(() => {
      cd -= 1;
      if (cd > 0) {
        setCountdown(cd);
      } else {
        clearInterval(cdInterval);
        setCountdown(null);

        const frame = captureFrame();
        if (!frame) {
          setError('Could not capture image. Please try again.');
          setState('error');
          return;
        }
        setFlashEffect(true);
        setTimeout(() => setFlashEffect(false), 300);
        setCapturedImage(frame);
        setState('processing');

        // Submit to backend
        submitAttendance(frame, framesRef.current);
      }
    }, 1000);

    return () => clearInterval(cdInterval);
  }, [state]); // eslint-disable-line

  // ── Submit to backend ──────────────────────────────────────────────────────
  const submitAttendance = useCallback(async (mainImage: string, frames: string[]) => {
    // Show validation steps UI
    const steps: ValidationStep[] = Object.keys(VALIDATION_LABELS).map((k) => ({
      step: k,
      label: VALIDATION_LABELS[k],
      status: 'pending',
    }));
    setValidationSteps(steps);

    try {
      const res = await faceAttendanceAPI.mark({
        image_base64: mainImage,
        liveness_frames: frames.slice(0, 20), // Send up to 20 liveness frames
      });

      // Mark all as pass on success
      setValidationSteps((prev) => prev.map((s) => ({ ...s, status: 'pass' })));
      setResult(res.data);
      setState('success');
      stopCamera();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Attendance marking failed. Please try again.';
      setError(detail);

      // Try to show failed step from error message
      setValidationSteps((prev) =>
        prev.map((s, i) => {
          if (i < prev.findIndex((x) => x.status === 'pending') || prev.every((x) => x.status === 'pending')) {
            return { ...s, status: 'pass' };
          }
          if (s.status === 'pending' && i === prev.findIndex((x) => x.status === 'pending')) {
            return { ...s, status: 'fail', message: detail };
          }
          return s;
        })
      );

      setState('error');
      stopCamera();
    }
  }, [stopCamera]);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => () => stopCamera(), [stopCamera]);

  // ── Time info ─────────────────────────────────────────────────────────────
  const timeStr = currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const istHour = currentTime.getHours();
  const istMin = currentTime.getMinutes();
  const totalMins = istHour * 60 + istMin;
  const windowOpen = totalMins >= 14 * 60 + 30;
  const windowClosed = totalMins > 15 * 60;
  const isLate = totalMins >= 14 * 60 + 46;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-violet-500/20 rounded-2xl border border-violet-500/30">
              <Shield className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Face Attendance</h1>
              <p className="text-slate-400 text-sm">Secure biometric attendance verification</p>
            </div>
          </div>
        </div>

        {/* Time Status Bar */}
        <div className={`rounded-2xl p-4 border flex items-center justify-between ${
          windowClosed ? 'bg-red-900/30 border-red-500/30' :
          !windowOpen ? 'bg-amber-900/30 border-amber-500/30' :
          isLate ? 'bg-orange-900/30 border-orange-500/30' :
          'bg-emerald-900/30 border-emerald-500/30'
        }`}>
          <div className="flex items-center gap-2">
            <Clock className={`w-4 h-4 ${windowClosed ? 'text-red-400' : !windowOpen ? 'text-amber-400' : isLate ? 'text-orange-400' : 'text-emerald-400'}`} />
            <span className="text-white font-mono font-bold">{timeStr}</span>
          </div>
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
            windowClosed ? 'bg-red-500/20 text-red-300' :
            !windowOpen ? 'bg-amber-500/20 text-amber-300' :
            isLate ? 'bg-orange-500/20 text-orange-300' :
            'bg-emerald-500/20 text-emerald-300'
          }`}>
            {windowClosed ? '❌ Window Closed' : !windowOpen ? '⏳ Opens at 2:30 PM' : isLate ? '⚠️ LATE' : '✅ PRESENT'}
          </span>
        </div>

        {/* Not Registered State */}
        {state === 'not_registered' && (
          <div className="bg-amber-900/30 border border-amber-500/30 rounded-3xl p-8 text-center">
            <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h2 className="text-white font-bold text-xl mb-2">Face Not Registered</h2>
            <p className="text-amber-300/80 text-sm mb-6">
              You need to register your face before using Face Attendance.
            </p>
            <button
              onClick={() => router.push('/dashboard/face-registration')}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all flex items-center gap-2 mx-auto"
            >
              Register Face <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Checking State */}
        {state === 'checking_registration' && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-3xl p-8 text-center">
            <Loader2 className="w-10 h-10 text-violet-400 animate-spin mx-auto mb-3" />
            <p className="text-slate-300">Checking face registration...</p>
          </div>
        )}

        {/* Ready State */}
        {state === 'ready' && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-3xl p-8 text-center space-y-4">
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { icon: Eye, label: 'Liveness Check', desc: 'Anti-spoofing active', color: 'violet' },
                { icon: Shield, label: 'Face Match', desc: 'ArcFace AI model', color: 'indigo' },
                { icon: Smile, label: 'Dress Code', desc: 'Gemini Vision AI', color: 'cyan' },
              ].map(({ icon: Icon, label, desc, color }) => (
                <div key={label} className={`bg-${color}-500/10 border border-${color}-500/20 rounded-2xl p-3 text-center`}>
                  <Icon className={`w-5 h-5 text-${color}-400 mx-auto mb-1`} />
                  <p className={`text-${color}-300 text-xs font-semibold`}>{label}</p>
                  <p className="text-slate-400 text-xs">{desc}</p>
                </div>
              ))}
            </div>
            <p className="text-slate-400 text-sm">
              Follow the on-screen prompts. The system will ask you to blink and turn your head to verify you're live.
            </p>
            <button
              onClick={startCamera}
              disabled={windowClosed || !windowOpen}
              className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl font-semibold text-lg transition-all shadow-lg shadow-violet-500/25 flex items-center justify-center gap-3"
            >
              <Camera className="w-6 h-6" />
              Start Face Attendance
            </button>
          </div>
        )}

        {/* Camera + Liveness View */}
        {(state === 'liveness' || state === 'capturing' || state === 'opening_camera') && (
          <div className="space-y-4">
            {/* Liveness step indicators */}
            <div className="flex gap-2 justify-center">
              {LIVENESS_STEPS.map((step, i) => (
                <div
                  key={step.id}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    i < livenessStep
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : i === livenessStep && state === 'liveness'
                      ? 'bg-violet-500/30 text-violet-300 border border-violet-500/50 animate-pulse'
                      : 'bg-slate-700/50 text-slate-500 border border-slate-700'
                  }`}
                >
                  <span>{step.icon}</span>
                  <span className="hidden sm:inline">{step.label}</span>
                </div>
              ))}
            </div>

            {/* Camera */}
            <div className="relative rounded-3xl overflow-hidden bg-black aspect-video border-2 border-violet-500/30">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />

              {/* Face guide oval */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className={`border-4 rounded-full transition-all ${
                    state === 'liveness' ? 'border-violet-400/80' : 'border-emerald-400/80'
                  }`}
                  style={{ width: '45%', height: '80%', boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)' }}
                />
              </div>

              {/* Flash */}
              {flashEffect && (
                <div className="absolute inset-0 bg-white opacity-80 pointer-events-none" />
              )}

              {/* Countdown */}
              {countdown !== null && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-24 h-24 rounded-full bg-violet-700/90 flex items-center justify-center border-4 border-violet-400">
                    <span className="text-5xl font-black text-white">{countdown}</span>
                  </div>
                </div>
              )}

              {/* Liveness prompt */}
              {state === 'liveness' && livenessStep < LIVENESS_STEPS.length && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                  <div className="bg-slate-900/80 backdrop-blur px-6 py-3 rounded-full border border-violet-500/40">
                    <span className="text-2xl mr-2">{LIVENESS_STEPS[livenessStep].icon}</span>
                    <span className="text-white text-sm font-medium">{LIVENESS_STEPS[livenessStep].label}</span>
                  </div>
                </div>
              )}

              {/* Frames counter */}
              {livenessFrames.length > 0 && (
                <div className="absolute top-3 right-3 bg-violet-900/70 backdrop-blur px-3 py-1 rounded-full">
                  <span className="text-violet-300 text-xs font-mono">{livenessFrames.length} frames</span>
                </div>
              )}
            </div>

            <canvas ref={canvasRef} className="hidden" />

            <p className="text-center text-slate-400 text-sm">
              {state === 'liveness' ? 'Follow the prompts — the system is verifying you are live' : 'Final capture in progress...'}
            </p>
          </div>
        )}

        {/* Processing State */}
        {state === 'processing' && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-3xl p-6 space-y-3">
            <div className="flex items-center gap-3 mb-4">
              <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
              <p className="text-white font-semibold">Verifying identity...</p>
            </div>

            {/* Captured image preview */}
            {capturedImage && (
              <img
                src={capturedImage}
                alt="Captured"
                className="w-24 h-24 rounded-2xl object-cover border-2 border-violet-500/40 mx-auto mb-4"
              />
            )}

            <div className="space-y-2">
              {validationSteps.slice(0, 8).map((s) => (
                <div key={s.step} className="flex items-center gap-3 text-sm">
                  <div className="w-5 h-5 flex-shrink-0">
                    {s.status === 'pass' ? (
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    ) : s.status === 'fail' ? (
                      <XCircle className="w-5 h-5 text-red-400" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-slate-600 mx-auto mt-0.5" />
                    )}
                  </div>
                  <span className={s.status === 'pass' ? 'text-emerald-300' : s.status === 'fail' ? 'text-red-300' : 'text-slate-500'}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Success State */}
        {state === 'success' && result && (
          <div className="bg-gradient-to-br from-emerald-900/40 to-teal-900/40 border border-emerald-500/30 rounded-3xl p-8 text-center space-y-4">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
              <CheckCircle className="w-12 h-12 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-emerald-300">Attendance Marked!</h2>
            <div className={`inline-block px-6 py-2 rounded-full text-sm font-bold ${
              result.status === 'PRESENT'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
            }`}>
              Status: {result.status}
            </div>
            <p className="text-slate-400 text-sm">
              {new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })} •{' '}
              {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </p>

            {/* Verification badges */}
            <div className="flex gap-3 justify-center flex-wrap mt-4">
              <span className="flex items-center gap-1 px-3 py-1 bg-emerald-500/10 rounded-full text-emerald-300 text-xs border border-emerald-500/20">
                <CheckCircle className="w-3 h-3" /> Face Verified
              </span>
              <span className="flex items-center gap-1 px-3 py-1 bg-violet-500/10 rounded-full text-violet-300 text-xs border border-violet-500/20">
                <Eye className="w-3 h-3" /> Liveness Passed
              </span>
              <span className="flex items-center gap-1 px-3 py-1 bg-cyan-500/10 rounded-full text-cyan-300 text-xs border border-cyan-500/20">
                <Shield className="w-3 h-3" /> Dress Code OK
              </span>
            </div>

            <button
              onClick={() => router.push('/dashboard')}
              className="mt-4 px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-semibold transition-all"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {/* Error State */}
        {state === 'error' && (
          <div className="bg-red-900/30 border border-red-500/30 rounded-3xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <XCircle className="w-6 h-6 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-red-300 font-bold mb-1">Verification Failed</h3>
                <p className="text-red-400/80 text-sm">{error}</p>
              </div>
            </div>

            {capturedImage && (
              <img src={capturedImage} alt="Captured" className="w-24 h-24 rounded-xl object-cover border border-red-500/30 mx-auto" />
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setState('ready');
                  setCapturedImage(null);
                  setError(null);
                  setValidationSteps([]);
                  framesRef.current = [];
                  setLivenessFrames([]);
                  setLivenessStep(0);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
              >
                <RefreshCw className="w-4 h-4" /> Try Again
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="flex-1 py-3 bg-red-800/50 hover:bg-red-700/50 text-red-300 rounded-xl transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
