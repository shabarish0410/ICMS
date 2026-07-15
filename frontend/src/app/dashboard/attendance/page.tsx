'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { attendanceAPI, uploadsAPI, studentsAPI, faceAPI, exportsAPI } from '@/services/api';
import { useRouter } from 'next/navigation';
import { 
  UserCheck, Camera, CheckCircle, Clock, Calendar, 
  TrendingUp, Loader2, X, AlertTriangle, ShieldCheck, Key, RefreshCw, ScanFace, Shield, Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { resolvePhotoUrl } from '@/lib/photoUrl';

export default function AttendancePage() {
  const { isAdmin, isStudent } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isScanning, setIsScanning] = useState(false);
  const [useManualCode, setUseManualCode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [faceRegistered, setFaceRegistered] = useState<boolean | null>(null);
  
  // Camera selection and manual capture states
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAutoCapture, setIsAutoCapture] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(3);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Admin states
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminStudentId, setAdminStudentId] = useState<number | null>(null);
  const [adminDate, setAdminDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [adminStatus, setAdminStatus] = useState<string>('present');
  const [studentSearch, setStudentSearch] = useState<string>('');
  
  // Scanning phases: 'init' | 'detecting' | 'capturing' | 'success' | 'error'
  const [scanPhase, setScanPhase] = useState<'init' | 'detecting' | 'capturing' | 'success' | 'error'>('init');
  const [scanMessage, setScanMessage] = useState('Initializing camera...');
  const [cameraError, setCameraError] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check face registration status for students
  useEffect(() => {
    if (isStudent) {
      faceAPI.myStatus()
        .then((res) => setFaceRegistered(Boolean(res.data?.face_registered)))
        .catch(() => setFaceRegistered(null));
    }
  }, [isStudent]);

  // Fetch Attendance stats & history
  const { data: stats } = useQuery({ queryKey: ['attendance-stats'], queryFn: () => attendanceAPI.stats() });
  const { data: history } = useQuery({ queryKey: ['attendance-history'], queryFn: () => attendanceAPI.list({ size: 30 }) });

  // Fetch students list for admin modal
  const { data: studentsData } = useQuery({
    queryKey: ['students-list-attendance', studentSearch],
    queryFn: () => studentsAPI.list({ search: studentSearch, size: 50 }),
    enabled: isAdmin && isAdminModalOpen,
  });
  const students = studentsData?.data?.items || [];

  // Mark attendance mutation
  const markMutation = useMutation({
    mutationFn: (data: { method: string; photo_url?: string }) => attendanceAPI.mark(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-stats'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-history'] });
      toast.success('Attendance marked successfully!');
      closeScanner();
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.detail || 'Failed to mark attendance');
      if (isScanning) {
        setScanPhase('error');
        setScanMessage('Failed to save attendance. Please retry.');
      }
    },
  });

  // Admin mark attendance mutation
  const adminMarkMutation = useMutation({
    mutationFn: (data: { student_id: number; date: string; status: string; method?: string }) =>
      attendanceAPI.adminMark(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-stats'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-history'] });
      toast.success('Attendance updated successfully!');
      setIsAdminModalOpen(false);
      setAdminStudentId(null);
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.detail || 'Failed to update attendance');
    },
  });

  const handleExportAttendance = async () => {
    try {
      toast.loading('Generating export...', { id: 'export-att' });
      const res = await exportsAPI.attendance();
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Attendance_Export.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      
      toast.success('Export successful!', { id: 'export-att' });
    } catch (err) {
      toast.error('Failed to export attendance logs', { id: 'export-att' });
    }
  };

  const s = stats?.data;
  const records = history?.data?.items || [];

  // Start Scanner webcam stream
  const startCamera = async (deviceId?: string) => {
    setIsScanning(true);
    setScanPhase('init');
    setScanMessage('Initializing camera...');
    setCameraError('');
    setUseManualCode(false);
    setCapturedImage(null);

    // Stop current stream if any
    stopCamera();

    try {
      let activeDeviceId = deviceId || selectedDeviceId;

      // Try to find a preferred hardware camera first if none is specified
      if (!activeDeviceId) {
        try {
          const allDevices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
          if (videoDevices.length > 0) {
            const preferred = videoDevices.find(d => 
              /integrated|built-in|front|back|webcam|usb|hd/i.test(d.label) && 
              !/virtual|obs|smart connect/i.test(d.label)
            ) || videoDevices[0];
            activeDeviceId = preferred.deviceId;
            setSelectedDeviceId(activeDeviceId);
          }
        } catch (e) {
          console.warn('Error pre-enumerating devices:', e);
        }
      }

      const constraints: MediaStreamConstraints = {
        video: activeDeviceId 
          ? { deviceId: { exact: activeDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      // Enumerate devices once permission is granted (to get friendly labels)
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
      setDevices(videoDevices);
      
      // Synchronize dropdown selection with the active camera track
      if (videoDevices.length > 0) {
        const activeTrack = stream.getVideoTracks()[0];
        const activeTrackLabel = activeTrack?.label;
        const matchingDevice = videoDevices.find(d => d.label === activeTrackLabel);
        
        if (matchingDevice) {
          setSelectedDeviceId(matchingDevice.deviceId);
        } else if (!selectedDeviceId) {
          const preferred = videoDevices.find(d => 
            /integrated|built-in|front|back|webcam|usb|hd/i.test(d.label) && 
            !/virtual|obs|smart connect/i.test(d.label)
          ) || videoDevices[0];
          setSelectedDeviceId(preferred.deviceId);
        }
      }

      setScanPhase('detecting');
      setScanMessage('Camera active. Ready to capture!');
      
      // If auto capture is active, start countdown timer
      if (isAutoCapture) {
        startCountdownTimer();
      }

    } catch (err: any) {
      console.error('Webcam Access Error:', err);
      setScanPhase('error');
      setCameraError('Webcam access denied or unavailable. Please enable browser camera permissions.');
      setScanMessage('Camera unavailable');
    }
  };

  const startCountdownTimer = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setCountdown(3);
    setScanMessage('Detecting face... Capturing in 3s');

    let count = 3;
    countdownIntervalRef.current = setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count <= 0) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        setScanPhase('capturing');
        setScanMessage('Capturing photo... Hold still!');
        setTimeout(() => {
          capturePhotoOnly();
        }, 500);
      } else {
        setScanMessage(`Detecting face... Capturing in ${count}s`);
      }
    }, 1000);
  };

  // Stop Webcam stream tracks
  const stopCamera = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const closeScanner = () => {
    stopCamera();
    setIsScanning(false);
    setUseManualCode(false);
    setManualCode('');
    setCapturedImage(null);
  };

  // Cleanup stream on unmount
  useEffect(() => {
    return () => stopCamera();
  }, []);

  // Capture photo without submitting immediately
  const capturePhotoOnly = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw frame (mirrored)
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        setScanPhase('success');
        setScanMessage('Photo captured! Review and submit.');
        stopCamera();
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to capture photo');
    }
  };

  // Submit the captured photo
  const submitCapturedPhoto = async () => {
    if (!capturedImage) return;

    setScanPhase('capturing');
    setScanMessage('Processing capture & uploading...');

    try {
      const resBlob = await fetch(capturedImage);
      const blob = await resBlob.blob();
      const file = new File([blob], `attendance_face_${Date.now()}.jpg`, { type: 'image/jpeg' });

      const res = await uploadsAPI.upload(file);
      const photoUrl = res.data.file_url;
      setScanPhase('success');
      setScanMessage('Face Biometrics Uploaded!');
      
      // Mark attendance
      markMutation.mutate({ method: 'face', photo_url: photoUrl });
    } catch (uploadErr) {
      console.error(uploadErr);
      toast.error('Photo upload failed. Please use manual check-in.');
      setScanPhase('error');
      setScanMessage('Upload failed. Try manual entry.');
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  };

  // Manual fallback mark
  const handleManualMark = () => {
    if (!manualCode.trim()) {
      toast.error('Please enter the security check-in code');
      return;
    }
    markMutation.mutate({ method: 'manual' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Attendance Logs</h1>
          <p className="text-dark-500 mt-1">{isAdmin ? 'Monitor center attendance analytics' : 'Check-in and view your logs'}</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button onClick={handleExportAttendance} className="btn-secondary flex items-center gap-2 py-2.5 px-4 text-xs font-semibold rounded-xl border border-dark-200 dark:border-dark-700 hover:border-primary-400 hover:text-primary-600 transition-colors">
              <Download className="w-4 h-4" /> Export
            </button>
          )}
          {/* Secure Face Attendance button (students only) */}
          {isStudent && (
            <button
              onClick={() => router.push('/dashboard/attendance/face')}
              className="flex items-center gap-2 py-2.5 px-4 text-xs font-semibold rounded-xl bg-brand-indigo hover:bg-brand-indigo/90 text-white transition-colors"
            >
              <Shield className="w-4 h-4" /> Face Attendance
            </button>
          )}
          <Link
            href="/dashboard/attendance/snapshots"
            className="btn-secondary flex items-center gap-2 py-2.5 px-4 text-xs font-semibold rounded-xl border border-dark-200 dark:border-dark-700 hover:border-primary-400 hover:text-primary-600 transition-colors"
          >
            <ScanFace className="w-4 h-4" /> View Snapshots
          </Link>
          {isAdmin && (
            <button
              onClick={() => setIsAdminModalOpen(true)}
              className="btn-primary flex items-center gap-2 py-2.5 px-4 text-xs font-semibold rounded-xl"
            >
              <UserCheck className="w-4 h-4" /> Mark Student Attendance
            </button>
          )}
        </div>
      </div>

      {/* ── Face Registration Gate ─────────────────────────────────────────── */}
      {isStudent && faceRegistered === false && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-5 bg-brand-amber/10 border border-brand-amber/20 rounded-2xl flex items-center gap-4"
        >
          <div className="p-3 bg-brand-amber/10 rounded-2xl flex-shrink-0">
            <Shield className="w-6 h-6 text-brand-amber" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-brand-amber font-bold text-base">Face Not Registered</p>
            <p className="text-dark-600 dark:text-dark-400 text-sm mt-0.5">
              You must register your face before you can mark attendance.
              Face registration is a one-time setup that takes about 1 minute.
            </p>
          </div>
          <Link
            href="/dashboard/face-registration"
            className="flex-shrink-0 flex items-center gap-2 px-5 py-3 bg-brand-amber hover:bg-brand-amber/90 text-white text-sm font-bold rounded-xl transition-colors"
          >
            <Camera className="w-4 h-4" />
            Register Face
          </Link>
        </motion.div>
      )}

      {/* Premium Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {isStudent ? (
          <>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="stat-card">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-dark-500 dark:text-dark-400 uppercase tracking-widest">Total Days</span>
                <div className="p-2.5 rounded-xl bg-dark-50 dark:bg-white/5"><Calendar className="w-5 h-5 text-dark-400" /></div>
              </div>
              <p className="text-5xl font-heading font-extrabold text-dark-900 dark:text-white tracking-tight">{s?.total_days || 0}</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="stat-card border-t-[3px] border-t-brand-emerald">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-dark-500 dark:text-dark-400 uppercase tracking-widest">Present</span>
                <div className="p-2.5 rounded-xl bg-brand-emerald/10"><UserCheck className="w-5 h-5 text-brand-emerald" /></div>
              </div>
              <p className="text-5xl font-heading font-extrabold text-brand-emerald tracking-tight">{s?.present || 0}</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="stat-card border-t-[3px] border-t-brand-indigo">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-dark-400 uppercase tracking-widest">Attendance Rate</span>
              </div>
              <div className="flex items-center gap-4 mt-2">
                {/* Circular Percentage */}
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path className="text-white/10" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                    <path className="text-brand-indigo" strokeDasharray={`${s?.percentage || 0}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                  </svg>
                  <span className="absolute text-sm font-bold text-white">{s?.percentage || 0}%</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">Target: 75%</p>
                  <p className="text-xs text-dark-400">{(s?.percentage || 0) >= 75 ? 'On track' : 'Action needed'}</p>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="stat-card">
              <p className="text-xs font-bold text-dark-400 uppercase tracking-widest mb-4">Today's Status</p>
              {s?.today_marked ? (
                <div className="flex items-center gap-3 p-3 bg-brand-emerald/10 border border-brand-emerald/20 rounded-xl">
                  <CheckCircle className="w-6 h-6 text-brand-emerald" />
                  <div>
                    <p className="text-sm font-bold text-brand-emerald">Checked In</p>
                    <p className="text-[10px] text-dark-300">Face Verified</p>
                  </div>
                </div>
              ) : faceRegistered === false ? (
                <Link href="/dashboard/face-registration" className="flex items-center gap-2 p-3 bg-brand-amber/10 border border-brand-amber/20 rounded-xl hover:bg-brand-amber/20 transition-colors">
                  <Shield className="w-6 h-6 text-brand-amber" />
                  <div>
                    <p className="text-sm font-bold text-brand-amber">Registration Required</p>
                  </div>
                </Link>
              ) : (
                <button onClick={() => startCamera()} disabled={markMutation.isPending} className="w-full flex items-center justify-center gap-2 p-3 bg-brand-indigo/10 border border-brand-indigo/20 rounded-xl hover:bg-brand-indigo/20 transition-colors">
                  <Camera className="w-5 h-5 text-brand-indigo" />
                  <span className="text-sm font-bold text-brand-indigo">Start Scan</span>
                </button>
              )}
            </motion.div>
          </>
        ) : (
          <>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="stat-card">
              <p className="text-xs font-bold text-dark-500 dark:text-dark-400 uppercase tracking-widest mb-4">Total Enrolled</p>
              <p className="text-5xl font-heading font-extrabold text-dark-900 dark:text-white tracking-tight">{s?.total_students || 0}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="stat-card border-t-[3px] border-t-brand-emerald">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-bold text-dark-500 dark:text-dark-400 uppercase tracking-widest">Present Today</p>
                <div className="p-2.5 rounded-xl bg-brand-emerald/10"><UserCheck className="w-5 h-5 text-brand-emerald" /></div>
              </div>
              <p className="text-5xl font-heading font-extrabold text-brand-emerald tracking-tight">{s?.present_today || 0}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="stat-card border-t-[3px] border-t-brand-red">
              <p className="text-xs font-bold text-dark-500 dark:text-dark-400 uppercase tracking-widest mb-4">Absent Today</p>
              <p className="text-5xl font-heading font-extrabold text-brand-red tracking-tight">{s?.absent_today || 0}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="stat-card border-t-[3px] border-t-brand-indigo">
              <p className="text-xs font-bold text-dark-500 dark:text-dark-400 uppercase tracking-widest mb-4">Attendance Rate</p>
              <p className="text-5xl font-heading font-extrabold text-brand-indigo tracking-tight">{s?.attendance_percentage || 0}%</p>
            </motion.div>
          </>
        )}
      </div>

      {/* Facial Recognition scan Modal */}
      {isScanning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-dark-800 rounded-2xl p-6 w-full max-w-md border border-dark-200 dark:border-dark-700 shadow-2xl relative overflow-hidden"
          >
            {/* White flash overlay */}
            <AnimatePresence>
              {scanPhase === 'capturing' && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 0.6 }}
                  className="absolute inset-0 bg-white z-50 pointer-events-none"
                />
              )}
            </AnimatePresence>

            <div className="flex items-center justify-between mb-4 border-b border-dark-100 dark:border-dark-700 pb-3">
              <h3 className="font-bold text-dark-900 dark:text-white flex items-center gap-2">
                <Camera className="w-5 h-5 text-primary-500" /> Face Biometric Scanner
              </h3>
              <button onClick={closeScanner} className="p-1 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-750">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Camera Switcher */}
            {devices.length > 1 && !capturedImage && !useManualCode && (
              <div className="mb-3">
                <label className="text-xs font-bold text-dark-500 dark:text-dark-400 block mb-1">Select Camera</label>
                <select
                  value={selectedDeviceId}
                  onChange={(e) => {
                    setSelectedDeviceId(e.target.value);
                    startCamera(e.target.value);
                  }}
                  className="w-full bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-dark-700 text-xs rounded-lg p-2 font-medium focus:ring-1 focus:ring-primary-500 focus:outline-none text-dark-750 dark:text-dark-350"
                >
                  {devices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Camera ${device.deviceId.slice(0, 5)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Auto Capture Toggle */}
            {!capturedImage && !useManualCode && (
              <div className="flex items-center justify-between mb-3 bg-dark-50 dark:bg-dark-850 p-2 rounded-lg border border-dark-100 dark:border-dark-750">
                <span className="text-xs font-semibold text-dark-600 dark:text-dark-300">Auto Capture Countdown</span>
                <button
                  type="button"
                  onClick={() => {
                    const newVal = !isAutoCapture;
                    setIsAutoCapture(newVal);
                    if (newVal) {
                      startCountdownTimer();
                    } else {
                      if (countdownIntervalRef.current) {
                        clearInterval(countdownIntervalRef.current);
                        countdownIntervalRef.current = null;
                      }
                      setScanMessage('Camera active. Ready to capture!');
                    }
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                    isAutoCapture 
                      ? 'bg-primary-500 text-white' 
                      : 'bg-dark-200 dark:bg-dark-700 text-dark-700 dark:text-dark-300'
                  }`}
                >
                  {isAutoCapture ? 'Enabled (3s)' : 'Disabled'}
                </button>
              </div>
            )}

            {/* Video container */}
            <div className="relative aspect-video rounded-xl bg-dark-950 border border-dark-800 overflow-hidden shadow-inner flex items-center justify-center">
              {capturedImage ? (
                <img src={capturedImage} alt="Captured face preview" className="w-full h-full object-cover animate-fadeIn" />
              ) : !useManualCode && scanPhase !== 'error' ? (
                <>
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                  
                  {/* Scanning guides / Overlay lines */}
                  {scanPhase === 'detecting' && (
                    <>
                      <div className="absolute inset-0 border-[3px] border-dashed border-primary-500/50 rounded-xl m-6 animate-pulse" />
                      <div className="absolute left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-primary-500 to-transparent shadow-[0_0_10px_#3b82f6] animate-[scan_2s_ease-in-out_infinite]" />
                    </>
                  )}
                  
                  {scanPhase === 'capturing' && (
                    <div className="absolute inset-0 border-[4px] border-green-500 rounded-xl m-6" />
                  )}
                </>
              ) : null}

              {/* Manual mode or camera error fallback */}
              {(useManualCode || scanPhase === 'error') && (
                <div className="absolute inset-0 bg-dark-900 flex flex-col items-center justify-center p-6 text-center text-white space-y-4">
                  {cameraError ? (
                    <div className="space-y-2">
                      <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
                      <p className="text-xs text-dark-300 px-4">{cameraError}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Key className="w-10 h-10 text-primary-400 mx-auto animate-bounce" />
                      <p className="text-xs text-dark-300">Enter manual verification pin below</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Message & Scan Phase Indicators */}
            <div className="mt-4 p-3 rounded-xl bg-dark-50 dark:bg-dark-850 border border-dark-100 dark:border-dark-750 flex items-center gap-3">
              {scanPhase === 'init' || markMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
              ) : scanPhase === 'success' ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : scanPhase === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-red-500" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-primary-500" />
              )}
              <span className="text-xs font-semibold text-dark-700 dark:text-dark-300">{scanMessage}</span>
            </div>

            {/* Capture action when camera active */}
            {!capturedImage && !useManualCode && scanPhase !== 'error' && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={capturePhotoOnly}
                  className="bg-primary-500 hover:bg-primary-600 text-white text-xs font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 shadow-lg shadow-primary-500/20 active:scale-95 transition-transform"
                >
                  <Camera className="w-4 h-4" /> Capture Photo
                </button>
              </div>
            )}

            {/* Retake and Confirm action when photo captured */}
            {capturedImage && (
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="w-1/2 border border-dark-200 dark:border-dark-750 text-dark-700 dark:text-dark-300 font-semibold py-2.5 rounded-xl text-xs hover:bg-dark-50 dark:hover:bg-dark-850 active:scale-95 transition-transform"
                >
                  Retake
                </button>
                <button
                  type="button"
                  onClick={submitCapturedPhoto}
                  disabled={markMutation.isPending}
                  className="w-1/2 btn-primary py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20 active:scale-95 transition-transform"
                >
                  {markMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm & Submit'}
                </button>
              </div>
            )}

            {/* Manual input controls */}
            {useManualCode && (
              <div className="mt-4 space-y-3 pt-4 border-t border-dark-100 dark:border-dark-700">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Security Code (e.g. SPARK2026)"
                  className="input-field text-center text-base tracking-wider uppercase"
                />
                <button 
                  onClick={handleManualMark}
                  disabled={markMutation.isPending}
                  className="btn-primary w-full flex items-center justify-center gap-1.5 py-2.5"
                >
                  {markMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Mark Attendance'}
                </button>
              </div>
            )}

            {/* Switch mode controls */}
            <div className="mt-5 flex justify-between text-xs font-medium text-dark-400 border-t border-dark-100 dark:border-dark-700 pt-4">
              <button 
                type="button" 
                onClick={() => {
                  if (useManualCode) {
                    setUseManualCode(false);
                    startCamera();
                  } else {
                    stopCamera();
                    setUseManualCode(true);
                    setScanPhase('init');
                    setScanMessage('Enter security pin to complete check-in');
                  }
                }}
                className="text-primary-500 hover:text-primary-600 underline"
              >
                {useManualCode ? 'Back to Face Scan' : 'Use manual code entry'}
              </button>
              <button type="button" onClick={closeScanner} className="hover:text-dark-600">
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Premium History Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
          <h3 className="font-heading font-bold text-white text-lg flex items-center gap-3">
            <div className="p-2 bg-brand-cyan/20 rounded-lg"><Clock className="w-5 h-5 text-brand-cyan" /></div>
            Attendance Logs
          </h3>
          <span className="text-xs text-dark-300 font-bold uppercase tracking-widest px-3 py-1 bg-white/5 rounded-full">{records.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-black/20">
                <th className="text-left px-6 py-4 text-xs font-bold text-dark-400 uppercase tracking-widest">Date</th>
                {isAdmin && <th className="text-left px-6 py-4 text-xs font-bold text-dark-400 uppercase tracking-widest">Student</th>}
                <th className="text-left px-6 py-4 text-xs font-bold text-dark-400 uppercase tracking-widest">Status</th>
                <th className="text-left px-6 py-4 text-xs font-bold text-dark-400 uppercase tracking-widest">Check-in Time</th>
                <th className="text-left px-6 py-4 text-xs font-bold text-dark-400 uppercase tracking-widest">Method</th>
                <th className="text-left px-6 py-4 text-xs font-bold text-dark-400 uppercase tracking-widest">Snapshot</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r: any) => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4 text-sm font-semibold text-white">{new Date(r.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                  {isAdmin && <td className="px-6 py-4 text-sm font-bold text-white">{r.student?.user?.full_name || '—'}</td>}
                  <td className="px-6 py-4">
                    {isAdmin ? (
                      <select
                        value={r.status}
                        onChange={(e) => {
                          adminMarkMutation.mutate({
                            student_id: r.student_id,
                            date: r.date,
                            status: e.target.value,
                            method: r.method || 'manual',
                          });
                        }}
                        disabled={adminMarkMutation.isPending}
                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border border-transparent focus:ring-1 focus:ring-brand-cyan bg-transparent cursor-pointer focus:outline-none transition-colors ${
                          r.status === 'PRESENT' ? 'bg-brand-emerald/10 text-brand-emerald hover:bg-brand-emerald/20' :
                          r.status === 'LATE' ? 'bg-brand-amber/10 text-brand-amber hover:bg-brand-amber/20' :
                          'bg-brand-red/10 text-brand-red hover:bg-brand-red/20'
                        }`}
                      >
                        <option value="PRESENT" className="bg-dark-900 text-brand-emerald">Present</option>
                        <option value="LATE" className="bg-dark-900 text-brand-amber">Present but Late</option>
                        <option value="ABSENT" className="bg-dark-900 text-brand-red">Absent</option>
                      </select>
                    ) : (
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
                        r.status === 'PRESENT' ? 'bg-brand-emerald/10 text-brand-emerald border border-brand-emerald/20' :
                        r.status === 'LATE' ? 'bg-brand-amber/10 text-brand-amber border border-brand-amber/20' :
                        'bg-brand-red/10 text-brand-red border border-brand-red/20'
                      }`}>{r.status === 'LATE' ? 'Present but Late' : r.status}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-dark-400 font-mono">{r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString() : '—'}</td>
                  <td className="px-6 py-4 text-sm font-semibold capitalize text-dark-300 flex items-center gap-2">
                    {r.method === 'face' ? <><ScanFace className="w-4 h-4 text-brand-indigo" /> Biometric</> : <><Key className="w-4 h-4 text-dark-500" /> Manual Pin</>}
                  </td>
                  <td className="px-6 py-4">
                    {resolvePhotoUrl(r.photo_url) ? (
                      <Link
                        href="/dashboard/attendance/snapshots"
                        className="block group"
                        title="View in Snapshots"
                      >
                        <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 group-hover:border-brand-cyan transition-all shadow-lg group-hover:scale-110">
                          <img
                            src={resolvePhotoUrl(r.photo_url)!}
                            alt="Attendance snapshot"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      </Link>
                    ) : (
                      <span className="text-xs text-dark-500 italic flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> No capture</span>
                    )}
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-6 py-20 text-center text-dark-400">
                    <div className="w-16 h-16 mx-auto bg-white/5 rounded-3xl flex items-center justify-center mb-4 border border-white/10 shadow-inner">
                      <Clock className="w-8 h-8 text-dark-500" />
                    </div>
                    <p className="text-sm font-semibold text-white">No attendance records found</p>
                    <p className="text-xs text-dark-400 mt-1">There are no records for this period.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Attendance Management Modal */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-dark-800 rounded-2xl p-6 w-full max-w-md border border-dark-200 dark:border-dark-700 shadow-2xl relative"
          >
            <div className="flex items-center justify-between mb-4 border-b border-dark-100 dark:border-dark-700 pb-3">
              <h3 className="font-bold text-dark-900 dark:text-white flex items-center gap-2 text-base">
                <UserCheck className="w-5 h-5 text-primary-500" /> Mark Student Attendance
              </h3>
              <button
                onClick={() => {
                  setIsAdminModalOpen(false);
                  setAdminStudentId(null);
                }}
                className="p-1 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-750 text-dark-400 hover:text-dark-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Search Field */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-dark-500 dark:text-dark-400">Search Student (Name or IC)</label>
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Type name or IC..."
                  className="input-field py-2 text-sm text-dark-900 dark:text-white bg-white dark:bg-dark-900"
                />
              </div>

              {/* Select Student */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-dark-500 dark:text-dark-400">Select Student</label>
                <select
                  value={adminStudentId || ''}
                  onChange={(e) => setAdminStudentId(Number(e.target.value))}
                  className="input-field py-2 text-sm text-dark-900 dark:text-white bg-white dark:bg-dark-900"
                >
                  <option value="">-- Choose a Student --</option>
                  {students.map((student: any) => (
                    <option key={student.id} value={student.id}>
                      {student.user?.full_name} ({student.user?.ic_number})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-dark-500 dark:text-dark-400">Date</label>
                <input
                  type="date"
                  value={adminDate}
                  onChange={(e) => setAdminDate(e.target.value)}
                  className="input-field py-2 text-sm text-dark-900 dark:text-white bg-white dark:bg-dark-900"
                />
              </div>

              {/* Status */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-dark-500 dark:text-dark-400">Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {['PRESENT', 'LATE', 'ABSENT'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setAdminStatus(s)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold uppercase border transition-all ${
                        adminStatus === s
                          ? s === 'PRESENT'
                            ? 'bg-green-500/10 border-green-500 text-green-600 dark:text-green-400'
                            : s === 'LATE'
                            ? 'bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400'
                            : 'bg-red-500/10 border-red-500 text-red-600 dark:text-red-400'
                          : 'bg-transparent border-dark-200 dark:border-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-50 dark:hover:bg-dark-850'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdminModalOpen(false);
                    setAdminStudentId(null);
                  }}
                  className="w-1/2 border border-dark-200 dark:border-dark-750 text-dark-700 dark:text-dark-300 font-semibold py-2.5 rounded-xl text-sm hover:bg-dark-50 dark:hover:bg-dark-850"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!adminStudentId) {
                      toast.error('Please select a student');
                      return;
                    }
                    adminMarkMutation.mutate({
                      student_id: adminStudentId,
                      date: adminDate,
                      status: adminStatus,
                      method: 'manual',
                    });
                  }}
                  disabled={adminMarkMutation.isPending}
                  className="w-1/2 btn-primary py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-primary-500/20 active:scale-95 transition-transform"
                >
                  {adminMarkMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Record'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Embedded Scan Animations */}
      <style jsx global>{`
        @keyframes scan {
          0%, 100% { top: 10%; }
          50% { top: 90%; }
        }
      `}</style>
    </div>
  );
}
