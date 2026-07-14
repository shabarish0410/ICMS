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
import { useFaceDetection } from './useFaceDetection';
import { FaceOvalOverlay } from './FaceOvalOverlay';

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
  const [uploading, setUploading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updatePassword, setUpdatePassword] = useState('');
  
  // Burst capture state
  const [isBursting, setIsBursting] = useState(false);
  const [burstCount, setBurstCount] = useState(0);
  const [allCaptured, setAllCaptured] = useState(false);

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
      setAllCaptured(false);
      setIsBursting(false);
      setBurstCount(0);
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
    setIsBursting(false);
    setBurstCount(0);
    setAllCaptured(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // ── Burst Capture Logic ─────────────────────────────────────────────────────
  const handleBurstCaptureRequest = useCallback(() => {
    if (isBursting || allCaptured) return;
    setIsBursting(true);
    setBurstCount(0);

    const video = videoRef.current;
    if (!video) return;

    const capturedImages: string[] = [];
    let count = 0;
    const totalFrames = 5;

    const interval = setInterval(() => {
      if (count >= totalFrames) {
        clearInterval(interval);
        setAllCaptured(true);
        setIsBursting(false);
        // Submit images
        submitRegistration(capturedImages, status === 'updating', updatePassword);
        return;
      }

      const captureCanvas = document.createElement('canvas');
      captureCanvas.width = video.videoWidth;
      captureCanvas.height = video.videoHeight;
      const captureCtx = captureCanvas.getContext('2d');
      if (captureCtx) {
        captureCtx.translate(captureCanvas.width, 0);
        captureCtx.scale(-1, 1);
        captureCtx.drawImage(video, 0, 0);
        const dataUrl = captureCanvas.toDataURL('image/jpeg', 0.9);
        capturedImages.push(dataUrl);
      }
      count++;
      setBurstCount(count);
    }, 200); // 5 frames over 1 second (200ms interval)

  }, [isBursting, allCaptured, status, updatePassword]);

  // ── MediaPipe AI Hook ───────────────────────────────────────────────────────
  const faceState = useFaceDetection(videoRef, canvasRef, handleBurstCaptureRequest);

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
      setAllCaptured(false);
      setIsBursting(false);
      setBurstCount(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="p-3 bg-brand-indigo/10 rounded-2xl border border-brand-indigo/20">
            <Sparkles className="w-6 h-6 text-brand-indigo" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-dark-900 dark:text-white">AI Face Registration</h1>
            <p className="text-dark-500 dark:text-dark-400 text-sm mt-1">Automated, secure, 3D facial enrollment</p>
          </div>
        </div>

        {/* Loading */}
        {status === 'checking' && (
          <div className="glass-card p-10 flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-4 border-brand-indigo border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-dark-600 dark:text-dark-300 font-medium">Checking registration status...</p>
          </div>
        )}

        {/* Registered Status */}
        {status === 'registered' && !cameraOpen && (
          <div className="space-y-6">
            <div className="glass-card p-8 border-t-4 border-t-brand-emerald">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-brand-emerald/10 rounded-xl">
                  <CheckCircle className="w-8 h-8 text-brand-emerald" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-dark-900 dark:text-white">Face Registered</h2>
                  <p className="text-dark-500 dark:text-dark-400 text-sm mt-1">
                    Your face is securely registered and ready for attendance verification.
                  </p>
                </div>
              </div>

              {/* Registration Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    icon: Calendar,
                    label: 'Registered On',
                    value: faceData?.registered_at
                      ? new Date(faceData.registered_at).toLocaleDateString('en-IN', { dateStyle: 'long' })
                      : '—',
                    color: 'text-brand-emerald',
                    bg: 'bg-brand-emerald/10',
                    border: 'border-brand-emerald/20',
                  },
                  {
                    icon: Cpu,
                    label: 'Model Used',
                    value: faceData?.model_version || 'ArcFace',
                    color: 'text-brand-indigo',
                    bg: 'bg-brand-indigo/10',
                    border: 'border-brand-indigo/20',
                  },
                  {
                    icon: RefreshCw,
                    label: 'Last Updated',
                    value: faceData?.updated_at
                      ? new Date(faceData.updated_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })
                      : faceData?.registered_at
                        ? new Date(faceData.registered_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })
                        : '—',
                    color: 'text-brand-cyan',
                    bg: 'bg-brand-cyan/10',
                    border: 'border-brand-cyan/20',
                  },
                ].map(({ icon: Icon, label, value, color, bg, border }) => (
                  <div key={label} className={`border ${border} rounded-2xl p-5 ${bg}`}>
                    <Icon className={`w-5 h-5 ${color} mb-3`} />
                    <p className="text-dark-600 dark:text-dark-300 font-semibold text-xs uppercase tracking-wider">{label}</p>
                    <p className="text-dark-900 dark:text-white text-sm mt-1 font-bold">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Security Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { icon: Shield, label: 'ArcFace AI', desc: 'Production-grade facial recognition' },
                { icon: Eye, label: 'Liveness Check', desc: 'Anti-spoofing detects real faces' },
                { icon: Lock, label: 'Privacy Safe', desc: 'Secure math embeddings, no raw images' },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="glass-card p-5 flex flex-col items-start text-left">
                  <div className="p-2 bg-dark-50 dark:bg-white/5 rounded-lg border border-dark-100 dark:border-white/10 mb-3">
                     <Icon className="w-5 h-5 text-brand-indigo dark:text-brand-cyan" />
                  </div>
                  <p className="text-dark-900 dark:text-white font-bold text-sm">{label}</p>
                  <p className="text-dark-500 dark:text-dark-400 text-xs mt-1 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4 pt-4">
              <button
                onClick={() => setShowUpdateModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-dark-50 hover:bg-dark-100 dark:bg-white/5 dark:hover:bg-white/10 text-dark-900 dark:text-white rounded-xl transition-all border border-dark-200 dark:border-white/10 text-sm font-semibold shadow-sm"
              >
                <RotateCcw className="w-4 h-4" />
                Update Registration
              </button>
              <Link
                href="/dashboard/attendance"
                className="flex items-center gap-2 px-6 py-3 bg-brand-indigo hover:bg-brand-indigo/90 text-white rounded-xl transition-all text-sm font-semibold shadow-sm"
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
            <div className="glass-card p-6 border-l-4 border-l-brand-amber">
              <div className="flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-brand-amber flex-shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-bold text-dark-900 dark:text-white">Registration Required</h2>
                  <p className="text-dark-600 dark:text-dark-300 text-sm mt-1 leading-relaxed">
                    You must register your face before you can use Face Attendance. 
                    <span className="font-semibold text-dark-900 dark:text-white"> Attendance cannot be marked without completing this step.</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="glass-card p-10 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-brand-indigo/10 rounded-full flex items-center justify-center mb-6">
                <Sparkles className="w-8 h-8 text-brand-indigo" />
              </div>
              <h3 className="text-xl text-dark-900 dark:text-white font-bold mb-3">Automated Smart Enrollment</h3>
              <p className="text-dark-500 dark:text-dark-400 text-sm max-w-md mb-8 leading-relaxed">
                Our AI will automatically detect your face, verify liveness, and capture photos as you look straight at the camera.
              </p>
              
              <button
                onClick={() => { setStatus('registering'); startCamera(); }}
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-brand-indigo hover:bg-brand-indigo/90 text-white rounded-xl font-bold transition-all shadow-sm group"
              >
                <Camera className="w-5 h-5" />
                Start Registration
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        )}

        {/* Camera View */}
        {cameraOpen && (
          <div className="space-y-6">
            
            <AnimatePresence mode="wait">
              <motion.div
                key={faceState.guidanceText}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className={`text-center py-4 px-6 rounded-2xl border shadow-sm ${
                  faceState.guidanceColor === 'emerald' ? 'bg-brand-emerald/10 border-brand-emerald/20 text-brand-emerald' :
                  faceState.guidanceColor === 'amber' ? 'bg-brand-amber/10 border-brand-amber/20 text-brand-amber' :
                  faceState.guidanceColor === 'red' ? 'bg-brand-red/10 border-brand-red/20 text-brand-red' :
                  'bg-brand-indigo/10 border-brand-indigo/20 text-brand-indigo'
                }`}
              >
                <p className="text-lg font-bold">{faceState.guidanceText}</p>
              </motion.div>
            </AnimatePresence>

            <div className="relative rounded-3xl overflow-hidden bg-black aspect-[3/4] sm:aspect-video mx-auto border border-dark-200 dark:border-white/10 shadow-xl">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />

              <FaceOvalOverlay 
                progress={isBursting ? burstCount / 5 : (faceState.hasBlinked ? 1 : 0)}
                isLocked={faceState.hasBlinked}
                isDetecting={faceState.isDetecting && faceState.hasFace}
                color={faceState.guidanceColor}
              />

              {isBursting && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
                  <div className="w-32 h-32 border-4 border-brand-emerald rounded-full animate-ping opacity-50" />
                </div>
              )}

              {allCaptured && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-dark-900/90 backdrop-blur-md flex flex-col items-center justify-center z-50"
                >
                  <div className="w-20 h-20 bg-brand-emerald/20 rounded-full flex items-center justify-center mb-6">
                    {uploading ? (
                      <div className="w-10 h-10 border-4 border-brand-emerald border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <CheckCircle className="w-10 h-10 text-brand-emerald" />
                    )}
                  </div>
                  <p className="text-white text-2xl font-bold mb-2">Registration Complete</p>
                  <p className="text-brand-emerald text-sm font-medium">
                    {uploading ? "Securing AI embeddings..." : "Success!"}
                  </p>
                </motion.div>
              )}
            </div>

            <canvas ref={canvasRef} className="hidden" />

            <div className="flex justify-center pt-2">
              <button
                onClick={stopCamera}
                className="flex items-center gap-2 px-6 py-3 bg-dark-50 hover:bg-dark-100 dark:bg-white/5 dark:hover:bg-white/10 text-dark-900 dark:text-white rounded-xl transition-all border border-dark-200 dark:border-white/10 font-medium shadow-sm"
              >
                <X className="w-4 h-4" />
                Cancel Registration
              </button>
            </div>

            {cameraError && (
              <div className="glass-card p-4 border-l-4 border-l-brand-red flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-brand-red flex-shrink-0" />
                <p className="text-dark-900 dark:text-white font-medium text-sm">{cameraError}</p>
              </div>
            )}
          </div>
        )}

        {/* Update Password Modal */}
        {showUpdateModal && (
          <div className="fixed inset-0 bg-dark-900/60 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-dark-900 border border-dark-200 dark:border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl">
              <h3 className="text-dark-900 dark:text-white font-bold text-xl mb-2">Update Face Registration</h3>
              <p className="text-dark-500 dark:text-dark-400 text-sm mb-6 leading-relaxed">
                For security, confirm your password before re-capturing your face photos.
              </p>
              <label className="block text-dark-900 dark:text-white font-semibold text-sm mb-2">Confirm Password</label>
              <input
                type="password"
                value={updatePassword}
                onChange={(e) => setUpdatePassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3 bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-white/10 rounded-xl text-dark-900 dark:text-white placeholder-dark-400 mb-6 focus:outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo transition-all shadow-sm"
                onKeyDown={(e) => { if (e.key === 'Enter' && updatePassword) { setShowUpdateModal(false); setStatus('updating'); startCamera(); }}}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowUpdateModal(false)}
                  className="flex-1 py-3 bg-dark-50 hover:bg-dark-100 dark:bg-white/5 dark:hover:bg-white/10 text-dark-900 dark:text-white font-semibold rounded-xl transition-all border border-dark-200 dark:border-white/10"
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
                  className="flex-1 py-3 bg-brand-indigo hover:bg-brand-indigo/90 text-white font-bold rounded-xl transition-all shadow-sm"
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
