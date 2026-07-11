'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { faceAPI } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import {
  CheckCircle, Camera, RefreshCw, AlertCircle, X, Shield, ArrowRight,
  RotateCcw, Eye, Lock, Calendar, Cpu, Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useFaceDetection, PoseType } from './useFaceDetection';
import { FaceOvalOverlay } from './FaceOvalOverlay';

// ── Capture Steps ───────────────────────────────────────────────────────────────
const CAPTURE_STEPS: { pose: PoseType; label: string; icon: string }[] = [
  { pose: 'straight', label: 'Look Straight', icon: '👀' },
  { pose: 'left', label: 'Turn Left', icon: '⬅️' },
  { pose: 'right', label: 'Turn Right', icon: '➡️' },
  { pose: 'up', label: 'Look Up', icon: '⬆️' },
  { pose: 'down', label: 'Look Down', icon: '⬇️' },
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
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updatePassword, setUpdatePassword] = useState('');
  const [flashEffect, setFlashEffect] = useState(false);

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
      setCameraOpen(true);
    } catch (err: any) {
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access in your browser settings.'
          : 'Could not open camera. Please check your device.'
      );
    }
  }, []);

  // Attach stream to video element when it mounts
  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(console.error);
    }
  }, [cameraOpen]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
    setCurrentStepIndex(0);
    setCapturedImages([]);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // ── Auto-Capture Callback ───────────────────────────────────────────────────
  const handlePoseStable = useCallback((dataUrl: string) => {
    setFlashEffect(true);
    setTimeout(() => setFlashEffect(false), 300);

    setCapturedImages((prev) => {
      const newImages = [...prev, dataUrl];
      if (newImages.length === CAPTURE_STEPS.length) {
        // We have all images! Stop tracking and submit.
        setTimeout(() => submitRegistration(newImages, status === 'updating', updatePassword), 1000);
      } else {
        // Move to next pose
        setCurrentStepIndex((prevIdx) => prevIdx + 1);
      }
      return newImages;
    });
  }, [status, updatePassword]);

  // ── MediaPipe AI Hook ───────────────────────────────────────────────────────
  const currentTargetPose = currentStepIndex < CAPTURE_STEPS.length ? CAPTURE_STEPS[currentStepIndex].pose : null;
  const faceState = useFaceDetection(videoRef, canvasRef, currentTargetPose, handlePoseStable);

  // ── Submit registration ────────────────────────────────────────────────────
  const submitRegistration = async (images: string[], isUpdate = false, password = '') => {
    setUploading(true);
    try {
      if (isUpdate) {
        await faceAPI.update(images, password);
        toast.success('Face updated successfully!');
      } else {
        await faceAPI.register(images);
        toast.success('Face registered successfully! You can now use Face Attendance.');
      }
      stopCamera();
      setShowUpdateModal(false);
      setUpdatePassword('');
      await loadStatus();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Registration failed. Please try again.';
      toast.error(msg);
      // Restart process
      setCapturedImages([]);
      setCurrentStepIndex(0);
    } finally {
      setUploading(false);
    }
  };

  const allCaptured = capturedImages.length >= CAPTURE_STEPS.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-500/30">
              <Sparkles className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">AI Face Registration</h1>
              <p className="text-slate-400 text-sm">Automated, secure, 3D facial enrollment</p>
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
                    <strong className="text-amber-300"> Attendance cannot be marked without completing this step.</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Smart Experience Overview */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-3xl p-6 text-center">
              <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-500/30">
                <Sparkles className="w-8 h-8 text-indigo-400" />
              </div>
              <h3 className="text-xl text-white font-semibold mb-2">Automated Smart Enrollment</h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
                Our AI will automatically detect your face and capture photos as you follow the on-screen movements. No buttons to press.
              </p>
              
              <button
                onClick={() => { setStatus('registering'); startCamera(); }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl font-semibold text-lg transition-all shadow-lg shadow-indigo-500/25 group"
              >
                <Camera className="w-6 h-6" />
                Start Auto-Registration
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        )}

        {/* Camera View */}
        {cameraOpen && (
          <div className="space-y-4">
            
            {/* Real-time Guidance Banner */}
            <AnimatePresence mode="wait">
              <motion.div
                key={faceState.guidanceText}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className={`text-center py-3 px-6 rounded-2xl border ${
                  faceState.guidanceColor === 'emerald' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' :
                  faceState.guidanceColor === 'amber' ? 'bg-amber-500/20 border-amber-500/30 text-amber-300' :
                  faceState.guidanceColor === 'red' ? 'bg-red-500/20 border-red-500/30 text-red-300' :
                  'bg-indigo-500/20 border-indigo-500/30 text-indigo-300'
                }`}
              >
                <p className="text-lg font-semibold">{faceState.guidanceText}</p>
              </motion.div>
            </AnimatePresence>

            {/* Camera View */}
            <div className="relative rounded-3xl overflow-hidden bg-black aspect-[3/4] sm:aspect-video mx-auto border border-slate-700/50 shadow-2xl">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />

              {/* Face Guide Oval with AI overlay */}
              <FaceOvalOverlay 
                progress={faceState.stabilityProgress}
                isLocked={faceState.isStable}
                isDetecting={faceState.isDetecting && faceState.hasFace}
                color={faceState.guidanceColor}
              />

              {/* Flash Effect */}
              {flashEffect && (
                <div className="absolute inset-0 bg-white animate-ping opacity-75 pointer-events-none z-50" />
              )}

              {/* All Captured Overlay */}
              {allCaptured && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center z-50"
                >
                  <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                    {uploading ? (
                      <div className="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <CheckCircle className="w-10 h-10 text-emerald-400" />
                    )}
                  </div>
                  <p className="text-white text-2xl font-bold mb-2">Registration Complete</p>
                  <p className="text-emerald-300 text-sm">
                    {uploading ? "Generating AI embeddings securely..." : "Success!"}
                  </p>
                </motion.div>
              )}
            </div>

            <canvas ref={canvasRef} className="hidden" />

            {/* Pose Progress Checklist */}
            <div className="bg-slate-800/60 backdrop-blur rounded-3xl p-6 border border-slate-700/50">
              <h4 className="text-slate-400 text-sm font-semibold mb-4 uppercase tracking-wider text-center">Required Poses</h4>
              <div className="flex justify-center flex-wrap gap-4 sm:gap-8">
                {CAPTURE_STEPS.map((step, index) => {
                  const isCompleted = index < currentStepIndex;
                  const isActive = index === currentStepIndex;
                  return (
                    <div 
                      key={step.pose}
                      className={`flex flex-col items-center transition-all duration-300 ${
                        isCompleted ? 'opacity-100 scale-100' :
                        isActive ? 'opacity-100 scale-110' : 'opacity-40 scale-90'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 border-2 ${
                        isCompleted ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' :
                        isActive ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.5)]' :
                        'bg-slate-800 border-slate-600 text-slate-500'
                      }`}>
                        {isCompleted ? <CheckCircle className="w-6 h-6" /> : <span className="text-2xl">{step.icon}</span>}
                      </div>
                      <span className={`text-xs font-medium ${isActive ? 'text-indigo-300' : isCompleted ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cancel Button */}
            <div className="flex justify-center pt-2">
              <button
                onClick={stopCamera}
                className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl transition-all"
              >
                <X className="w-4 h-4" />
                Cancel Registration
              </button>
            </div>

            {/* Camera Error */}
            {cameraError && (
              <div className="bg-red-900/40 border border-red-500/40 rounded-2xl p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-red-300 text-sm">{cameraError}</p>
              </div>
            )}
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
