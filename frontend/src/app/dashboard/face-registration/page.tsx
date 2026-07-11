'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { faceAPI } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import {
  CheckCircle, Camera, RefreshCw, AlertCircle, X, Shield, ArrowRight,
  RotateCcw, Eye, Upload, Lock, Info, Calendar, Cpu, Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

// ── Capture Steps ───────────────────────────────────────────────────────────────
const CAPTURE_STEPS = [
  { label: 'Looking Straight', instruction: 'Look directly at the camera', icon: '👀', direction: 'center' },
  { label: 'Turn Left', instruction: 'Slowly turn your head to the LEFT', icon: '⬅️', direction: 'left' },
  { label: 'Turn Right', instruction: 'Slowly turn your head to the RIGHT', icon: '➡️', direction: 'right' },
  { label: 'Look Up', instruction: 'Tilt your head slightly UPWARD', icon: '⬆️', direction: 'up' },
  { label: 'Look Down', instruction: 'Tilt your head slightly DOWNWARD', icon: '⬇️', direction: 'down' },
];

type RegistrationStatus = 'checking' | 'not_registered' | 'registered' | 'registering' | 'updating';

interface FaceStatusData {
  face_registered: boolean;
  registered_at: string | null;
  model_version?: string;
  updated_at?: string;
}

export default function FaceRegistrationPage() {
  const { isAdmin } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<RegistrationStatus>('checking');
  const [faceData, setFaceData] = useState<FaceStatusData | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updatePassword, setUpdatePassword] = useState('');
  const [flashEffect, setFlashEffect] = useState(false);
  const [captureErrors, setCaptureErrors] = useState<string[]>([]);

  // ── Load face status ────────────────────────────────────────────────────────
  const loadStatus = useCallback(async () => {
    try {
      const res = await faceAPI.myStatus();
      const data = res.data;
      setFaceData(data);
      if (data.face_registered) {
        setStatus('registered');
      } else {
        setStatus('not_registered');
      }
    } catch {
      setStatus('not_registered');
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // ── Camera ─────────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCameraError(null);
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
      setCameraOpen(true);
    } catch (err: any) {
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access in your browser settings.'
          : 'Could not open camera. Please check your device.'
      );
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
    setCurrentStep(0);
    setCapturedImages([]);
    setCaptureErrors([]);
    setCountdown(null);
  }, []);

  // ── Capture image ──────────────────────────────────────────────────────────
  const captureImage = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.9);
  }, []);

  // ── Auto-capture with countdown ────────────────────────────────────────────
  const doCapture = useCallback(async () => {
    if (capturing) return;
    setCapturing(true);

    for (let i = 3; i >= 1; i--) {
      setCountdown(i);
      await new Promise((r) => setTimeout(r, 900));
    }
    setCountdown(null);

    const dataUrl = captureImage();
    if (!dataUrl) { setCapturing(false); return; }

    setFlashEffect(true);
    setTimeout(() => setFlashEffect(false), 300);

    const newImages = [...capturedImages, dataUrl];
    setCapturedImages(newImages);

    if (currentStep < CAPTURE_STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    }
    setCapturing(false);
  }, [capturing, captureImage, capturedImages, currentStep]);

  // ── Submit registration ────────────────────────────────────────────────────
  const submitRegistration = useCallback(async (isUpdate = false, password = '') => {
    if (capturedImages.length < 5) {
      toast.error('Please capture all 5 face images first.');
      return;
    }
    setUploading(true);
    try {
      if (isUpdate) {
        await faceAPI.update(capturedImages, password);
        toast.success('Face updated successfully!');
      } else {
        await faceAPI.register(capturedImages);
        toast.success('Face registered successfully! You can now use Face Attendance.');
      }
      stopCamera();
      setShowUpdateModal(false);
      setUpdatePassword('');
      await loadStatus();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Registration failed. Please try again.';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }, [capturedImages, loadStatus, stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const step = CAPTURE_STEPS[currentStep];
  const allCaptured = capturedImages.length >= CAPTURE_STEPS.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-500/30">
              <Shield className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Face Registration</h1>
              <p className="text-slate-400 text-sm">Secure AI-powered identity registration for attendance</p>
            </div>
          </div>
        </div>

        {/* Loading */}
        {status === 'checking' && (
          <div className="bg-slate-800/50 rounded-3xl border border-slate-700/50 p-8 text-center">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-300">Checking registration status...</p>
          </div>
        )}

        {/* Registered Status */}
        {status === 'registered' && !cameraOpen && (
          <div className="space-y-6">
            {/* Status Banner */}
            <div className="bg-gradient-to-r from-emerald-900/40 to-teal-900/40 border border-emerald-500/30 rounded-3xl p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-4 bg-emerald-500/20 rounded-2xl">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-emerald-300">Face Registered ✅</h2>
                  <p className="text-emerald-400/70 text-sm mt-1">
                    Your face is registered and ready for secure attendance verification.
                  </p>
                </div>
              </div>

              {/* Registration Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                {[
                  {
                    icon: Calendar,
                    label: 'Registered On',
                    value: faceData?.registered_at
                      ? new Date(faceData.registered_at).toLocaleDateString('en-IN', { dateStyle: 'long' })
                      : '—',
                    color: 'emerald',
                  },
                  {
                    icon: Cpu,
                    label: 'Model Used',
                    value: faceData?.model_version || 'ArcFace',
                    color: 'indigo',
                  },
                  {
                    icon: RefreshCw,
                    label: 'Last Updated',
                    value: faceData?.updated_at
                      ? new Date(faceData.updated_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })
                      : faceData?.registered_at
                        ? new Date(faceData.registered_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })
                        : '—',
                    color: 'cyan',
                  },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className={`bg-${color}-500/10 border border-${color}-500/20 rounded-2xl p-4`}>
                    <Icon className={`w-4 h-4 text-${color}-400 mb-2`} />
                    <p className={`text-${color}-300 font-semibold text-xs uppercase tracking-wide`}>{label}</p>
                    <p className="text-white text-sm mt-1 font-medium">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Security Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { icon: Shield, label: 'ArcFace AI', desc: 'Production-grade facial recognition model', color: 'indigo' },
                { icon: Eye, label: 'Liveness Check', desc: 'Anti-spoofing — detects real faces only', color: 'violet' },
                { icon: Lock, label: 'Privacy Safe', desc: 'Only math embeddings stored, never raw images', color: 'cyan' },
              ].map(({ icon: Icon, label, desc, color }) => (
                <div key={label} className={`bg-${color}-500/10 border border-${color}-500/20 rounded-2xl p-4`}>
                  <Icon className={`w-5 h-5 text-${color}-400 mb-2`} />
                  <p className={`text-${color}-300 font-semibold text-sm`}>{label}</p>
                  <p className="text-slate-400 text-xs mt-1">{desc}</p>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowUpdateModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-2xl transition-all border border-slate-600 text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                Update Face Registration
              </button>
              <Link
                href="/dashboard/attendance"
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl transition-all text-sm font-semibold"
              >
                <CheckCircle className="w-4 h-4" />
                Go to Attendance
              </Link>
            </div>
          </div>
        )}

        {/* Not Registered */}
        {status === 'not_registered' && !cameraOpen && (
          <div className="space-y-6">
            {/* Warning */}
            <div className="bg-amber-900/30 border border-amber-500/30 rounded-3xl p-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h2 className="font-bold text-amber-300 mb-1">Face Registration Required</h2>
                  <p className="text-amber-400/80 text-sm">
                    You must register your face before you can use Face Attendance.
                    Your face will be used to verify your identity every time you mark attendance.
                    <strong className="text-amber-300"> Attendance cannot be marked without completing this step.</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Steps Overview */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-3xl p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-400" />
                What to expect
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {CAPTURE_STEPS.map((s, i) => (
                  <div key={s.label} className="text-center p-3 bg-slate-700/50 rounded-2xl">
                    <div className="text-2xl mb-2">{s.icon}</div>
                    <p className="text-slate-300 text-xs font-medium">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-400">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span>Ensure good, even lighting on your face</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span>Remove glasses, hats, or face coverings</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span>Face the camera directly, fill the oval guide</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span>Only one person should be visible in frame</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => { setStatus('registering'); startCamera(); }}
              className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl font-semibold text-lg transition-all shadow-lg shadow-indigo-500/25 group"
            >
              <Camera className="w-6 h-6" />
              Register My Face
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

        {/* Camera View */}
        {cameraOpen && (
          <div className="space-y-4">
            {/* Progress Bar */}
            <div className="flex items-center justify-between bg-slate-800/60 backdrop-blur rounded-2xl p-4 border border-slate-700/50">
              <span className="text-slate-300 text-sm font-medium">
                Image {Math.min(capturedImages.length + 1, CAPTURE_STEPS.length)} of {CAPTURE_STEPS.length}
              </span>
              <div className="flex gap-2">
                {CAPTURE_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      i < capturedImages.length
                        ? 'w-6 bg-emerald-400'
                        : i === capturedImages.length
                        ? 'w-6 bg-indigo-400 animate-pulse'
                        : 'w-2 bg-slate-600'
                    }`}
                  />
                ))}
              </div>
              <button onClick={stopCamera} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Camera View */}
            <div className="relative rounded-3xl overflow-hidden bg-black aspect-video max-h-[60vh] mx-auto border-2 border-indigo-500/30">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />

              {/* Face Guide Oval */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className="border-4 border-indigo-400/70 rounded-full"
                  style={{ width: '45%', height: '80%', boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)' }}
                />
              </div>

              {/* Flash Effect */}
              {flashEffect && (
                <div className="absolute inset-0 bg-white animate-ping opacity-75 pointer-events-none" />
              )}

              {/* Countdown */}
              {countdown !== null && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-24 h-24 rounded-full bg-indigo-600/90 flex items-center justify-center border-4 border-indigo-400">
                    <span className="text-5xl font-black text-white">{countdown}</span>
                  </div>
                </div>
              )}

              {/* Instruction Overlay */}
              {!allCaptured && !countdown && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                  <div className="bg-slate-900/80 backdrop-blur px-6 py-3 rounded-full border border-slate-600/50">
                    <span className="text-2xl mr-2">{step?.icon}</span>
                    <span className="text-white text-sm font-medium">{step?.instruction}</span>
                  </div>
                </div>
              )}

              {/* All Captured Overlay */}
              {allCaptured && (
                <div className="absolute inset-0 bg-emerald-900/60 flex items-center justify-center">
                  <div className="text-center">
                    <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-3" />
                    <p className="text-white text-xl font-bold">All 5 photos captured!</p>
                    <p className="text-emerald-300 text-sm mt-1">Ready to register your face</p>
                  </div>
                </div>
              )}
            </div>

            <canvas ref={canvasRef} className="hidden" />

            {/* Camera Error */}
            {cameraError && (
              <div className="bg-red-900/40 border border-red-500/40 rounded-2xl p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-red-300 text-sm">{cameraError}</p>
              </div>
            )}

            {/* Capture Errors */}
            {captureErrors.length > 0 && (
              <div className="bg-orange-900/30 border border-orange-500/30 rounded-2xl p-3">
                <p className="text-orange-300 text-xs font-semibold mb-1">Validation warnings:</p>
                {captureErrors.slice(-2).map((e, i) => (
                  <p key={i} className="text-orange-400/80 text-xs">• {e}</p>
                ))}
              </div>
            )}

            {/* Thumbnails */}
            {capturedImages.length > 0 && (
              <div className="flex gap-3 justify-center">
                {capturedImages.map((img, i) => (
                  <div key={i} className="relative">
                    <img
                      src={img}
                      alt={`Capture ${i + 1}`}
                      className="w-16 h-16 rounded-xl object-cover border-2 border-emerald-500/60"
                    />
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-3 h-3 text-white" />
                    </div>
                  </div>
                ))}
                {Array.from({ length: Math.max(0, CAPTURE_STEPS.length - capturedImages.length) }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-600 flex items-center justify-center"
                  >
                    <Camera className="w-4 h-4 text-slate-600" />
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              {!allCaptured ? (
                <button
                  onClick={doCapture}
                  disabled={capturing || !!countdown}
                  className="flex-1 flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-semibold transition-all shadow-lg shadow-indigo-500/25"
                >
                  {countdown ? (
                    <span>Capturing in {countdown}...</span>
                  ) : capturing ? (
                    <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Capturing...</>
                  ) : (
                    <><Camera className="w-5 h-5" /> Capture Photo {capturedImages.length + 1}</>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => submitRegistration(status === 'updating', updatePassword)}
                  disabled={uploading}
                  className="flex-1 flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-2xl font-semibold transition-all shadow-lg shadow-emerald-500/25"
                >
                  {uploading ? (
                    <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Registering...</>
                  ) : (
                    <><Upload className="w-5 h-5" /> {status === 'updating' ? 'Submit Update' : 'Submit Registration'}</>
                  )}
                </button>
              )}

              <button
                onClick={() => { setCapturedImages([]); setCurrentStep(0); setCaptureErrors([]); }}
                className="px-5 py-4 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-2xl transition-all"
                title="Retake all"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Update Password Modal */}
        {showUpdateModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 max-w-md w-full">
              <h3 className="text-white font-bold text-lg mb-2">Update Face Registration</h3>
              <p className="text-slate-400 text-sm mb-4">
                For security, confirm your password before re-capturing your face photos.
              </p>
              <label className="block text-slate-300 text-sm mb-2">Confirm Password</label>
              <input
                type="password"
                value={updatePassword}
                onChange={(e) => setUpdatePassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 mb-4 focus:outline-none focus:border-indigo-500"
                onKeyDown={(e) => { if (e.key === 'Enter' && updatePassword) { setShowUpdateModal(false); setStatus('updating'); startCamera(); }}}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowUpdateModal(false)}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!updatePassword) { toast.error('Please enter your password.'); return; }
                    setShowUpdateModal(false);
                    setStatus('updating');
                    startCamera();
                  }}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all font-semibold"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
