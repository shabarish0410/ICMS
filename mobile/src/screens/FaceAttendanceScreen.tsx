/**
 * Face Attendance Screen - React Native (Expo)
 * Liveness detection + face capture + backend verification.
 * Sends frames to /api/attendance/face
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ScrollView, Alert, ActivityIndicator, Dimensions
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_W } = Dimensions.get('window');
const API_BASE = 'https://spark-innovation.onrender.com/api';

// ── Liveness steps
const LIVENESS_STEPS = [
  { id: 'blink', label: 'Blink your eyes slowly', icon: '👁️', duration: 3000 },
  { id: 'left',  label: 'Turn head LEFT',          icon: '⬅️', duration: 2500 },
  { id: 'right', label: 'Turn head RIGHT',          icon: '➡️', duration: 2500 },
  { id: 'center',label: 'Look straight ahead',     icon: '👀', duration: 2000 },
];

type State = 'checking' | 'not_registered' | 'ready' | 'liveness' | 'capturing' | 'processing' | 'success' | 'error';

const STATUS_COLORS = { PRESENT: '#10b981', LATE: '#f59e0b', ABSENT: '#ef4444' };

export default function FaceAttendanceScreen({ navigation }: any) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const livenessFramesRef = useRef<string[]>([]);
  const livenessTimerRef = useRef<any>(null);
  const frameIntervalRef = useRef<any>(null);

  const [appState, setAppState] = useState<State>('checking');
  const [livenessStep, setLivenessStep] = useState(0);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live clock (IST)
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const getAuthHeader = useCallback(async () => {
    const token = await AsyncStorage.getItem('access_token');
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, []);

  // ── Check face registration status ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const headers = await getAuthHeader();
        const res = await fetch(`${API_BASE}/face/my-status`, { headers });
        const data = await res.json();
        setAppState(data.face_registered ? 'ready' : 'not_registered');
      } catch {
        setAppState('ready'); // Allow attempt
      }
    })();
  }, [getAuthHeader]);

  // ── Capture a single frame ───────────────────────────────────────────────────
  const captureFrame = useCallback(async (): Promise<string | null> => {
    if (!cameraRef.current) return null;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        base64: true,
        exif: false,
      });
      return `data:image/jpeg;base64,${photo.base64}`;
    } catch {
      return null;
    }
  }, []);

  // ── Liveness flow ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (appState !== 'liveness') return;
    const step = LIVENESS_STEPS[livenessStep];
    if (!step) return;

    // Collect frames every 300ms during this step
    frameIntervalRef.current = setInterval(async () => {
      const frame = await captureFrame();
      if (frame) livenessFramesRef.current.push(frame);
    }, 400);

    // Advance to next step or final capture
    livenessTimerRef.current = setTimeout(() => {
      clearInterval(frameIntervalRef.current);
      if (livenessStep < LIVENESS_STEPS.length - 1) {
        setLivenessStep(s => s + 1);
      } else {
        setAppState('capturing');
      }
    }, step.duration);

    return () => {
      clearInterval(frameIntervalRef.current);
      clearTimeout(livenessTimerRef.current);
    };
  }, [appState, livenessStep, captureFrame]);

  // ── Final capture countdown ───────────────────────────────────────────────────
  useEffect(() => {
    if (appState !== 'capturing') return;
    let cd = 3;
    setCountdown(cd);

    const timer = setInterval(async () => {
      cd -= 1;
      if (cd > 0) {
        setCountdown(cd);
      } else {
        clearInterval(timer);
        setCountdown(null);
        const frame = await captureFrame();
        if (!frame) {
          setError('Could not capture image. Please try again.');
          setAppState('error');
          return;
        }
        setCapturedImage(frame);
        setAppState('processing');
        submitAttendance(frame, livenessFramesRef.current);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [appState]); // eslint-disable-line

  // ── Submit to backend ─────────────────────────────────────────────────────────
  const submitAttendance = useCallback(async (mainImage: string, frames: string[]) => {
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_BASE}/attendance/face`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          image_base64: mainImage,
          liveness_frames: frames.slice(0, 20),
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setResult(data);
        setAppState('success');
      } else {
        setError(data.detail || 'Attendance failed. Please try again.');
        setAppState('error');
      }
    } catch {
      setError('Network error. Please check your connection.');
      setAppState('error');
    }
  }, [getAuthHeader]);

  // ── Time window info ──────────────────────────────────────────────────────────
  const timeStr = currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const h = currentTime.getHours(), m = currentTime.getMinutes();
  const totalMins = h * 60 + m;
  const windowOpen = totalMins >= 14 * 60 + 30;
  const windowClosed = totalMins > 15 * 60;
  const isLate = totalMins >= 14 * 60 + 46;

  const resetFlow = () => {
    setCapturedImage(null);
    setError(null);
    setResult(null);
    livenessFramesRef.current = [];
    setLivenessStep(0);
    setAppState('ready');
  };

  if (!permission) return <View style={styles.center}><ActivityIndicator color="#6366f1" size="large" /></View>;

  if (!permission.granted) {
    return (
      <LinearGradient colors={['#0f172a', '#1e1b4b']} style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.title}>Camera Permission Required</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
            <Text style={styles.primaryBtnText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0f172a', '#1e1b4b']} style={styles.container}>
      {/* Time Bar */}
      <View style={[
        styles.timeBar,
        { backgroundColor: windowClosed ? 'rgba(239,68,68,0.15)' : !windowOpen ? 'rgba(245,158,11,0.15)' : isLate ? 'rgba(249,115,22,0.15)' : 'rgba(16,185,129,0.15)' }
      ]}>
        <Text style={styles.timeText}>⏱ {timeStr} IST</Text>
        <View style={[styles.statusBadge, { backgroundColor: windowClosed ? 'rgba(239,68,68,0.2)' : !windowOpen ? 'rgba(245,158,11,0.2)' : isLate ? 'rgba(249,115,22,0.2)' : 'rgba(16,185,129,0.2)' }]}>
          <Text style={[styles.statusBadgeText, { color: windowClosed ? '#fca5a5' : !windowOpen ? '#fcd34d' : isLate ? '#fdba74' : '#6ee7b7' }]}>
            {windowClosed ? 'Window Closed' : !windowOpen ? 'Opens at 2:30 PM' : isLate ? '⚠️ LATE' : '✅ PRESENT'}
          </Text>
        </View>
      </View>

      {/* Not Registered */}
      {appState === 'not_registered' && (
        <View style={styles.center}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.title}>Face Not Registered</Text>
          <Text style={styles.subtitle}>Register your face first in Profile → Face Registration.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('FaceRegistration')}>
            <Text style={styles.primaryBtnText}>Go to Face Registration →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Checking */}
      {appState === 'checking' && (
        <View style={styles.center}>
          <ActivityIndicator color="#6366f1" size="large" />
          <Text style={[styles.subtitle, { marginTop: 16 }]}>Checking registration...</Text>
        </View>
      )}

      {/* Ready */}
      {appState === 'ready' && (
        <View style={styles.center}>
          <Text style={styles.title}>🔐 Face Attendance</Text>
          <Text style={styles.subtitle}>
            Follow the on-screen prompts.{'\n'}Blink and turn your head when asked.
          </Text>

          <View style={styles.infoGrid}>
            {[
              { icon: '👁️', label: 'Liveness Check', desc: 'Anti-spoofing active' },
              { icon: '🤖', label: 'ArcFace AI', desc: 'Face matching' },
              { icon: '👔', label: 'Dress Code', desc: 'Uniform verification' },
            ].map(({ icon, label, desc }) => (
              <View key={label} style={styles.infoCard}>
                <Text style={styles.infoIcon}>{icon}</Text>
                <Text style={styles.infoLabel}>{label}</Text>
                <Text style={styles.infoDesc}>{desc}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, { marginTop: 24, width: '90%' }, (windowClosed || !windowOpen) && styles.btnDisabled]}
            disabled={windowClosed || !windowOpen}
            onPress={() => {
              livenessFramesRef.current = [];
              setLivenessStep(0);
              setAppState('liveness');
            }}
          >
            <Text style={styles.primaryBtnText}>📷 Start Face Attendance</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Camera + Liveness / Capture */}
      {(appState === 'liveness' || appState === 'capturing') && (
        <View style={styles.cameraWrapper}>
          {/* Step indicators */}
          <View style={styles.livenessSteps}>
            {LIVENESS_STEPS.map((s, i) => (
              <View key={s.id} style={[
                styles.stepChip,
                i < livenessStep ? styles.stepChipDone :
                i === livenessStep && appState === 'liveness' ? styles.stepChipActive :
                styles.stepChipPending,
              ]}>
                <Text style={styles.stepIcon}>{s.icon}</Text>
              </View>
            ))}
          </View>

          <CameraView ref={cameraRef} style={styles.camera} facing="front">
            {/* Face oval */}
            <View style={styles.ovalGuide} />

            {/* Countdown */}
            {countdown !== null && (
              <View style={styles.countdownOverlay}>
                <Text style={styles.countdownText}>{countdown}</Text>
              </View>
            )}

            {/* Liveness prompt */}
            {appState === 'liveness' && (
              <View style={styles.livenessPrompt}>
                <Text style={styles.livenessPromptIcon}>{LIVENESS_STEPS[livenessStep]?.icon}</Text>
                <Text style={styles.livenessPromptText}>{LIVENESS_STEPS[livenessStep]?.label}</Text>
              </View>
            )}
          </CameraView>

          <Text style={styles.livenessNote}>
            {appState === 'liveness' ? 'Follow the prompts — verifying you are live' : 'Final capture...'}
          </Text>
        </View>
      )}

      {/* Processing */}
      {appState === 'processing' && (
        <View style={styles.center}>
          {capturedImage && (
            <Image source={{ uri: capturedImage }} style={styles.capturedPreview} />
          )}
          <ActivityIndicator color="#6366f1" size="large" style={{ marginTop: 24 }} />
          <Text style={[styles.subtitle, { marginTop: 16 }]}>Verifying identity...</Text>
          <Text style={styles.hintText}>
            Running liveness → face match → dress code → time check
          </Text>
        </View>
      )}

      {/* Success */}
      {appState === 'success' && result && (
        <ScrollView contentContainerStyle={styles.center}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.title}>Attendance Marked!</Text>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[result.status as keyof typeof STATUS_COLORS] + '33', marginVertical: 12 }]}>
            <Text style={[styles.statusBadgeText, { color: STATUS_COLORS[result.status as keyof typeof STATUS_COLORS], fontSize: 16 }]}>
              Status: {result.status}
            </Text>
          </View>
          <Text style={styles.subtitle}>
            {new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}
          </Text>

          <View style={styles.badgesRow}>
            {[
              { icon: '✅', label: 'Face Verified' },
              { icon: '👁️', label: 'Liveness OK' },
              { icon: '👔', label: 'Dress OK' },
            ].map(({ icon, label }) => (
              <View key={label} style={styles.verifyBadge}>
                <Text>{icon}</Text>
                <Text style={styles.verifyBadgeText}>{label}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.primaryBtnText}>← Back to Dashboard</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Error */}
      {appState === 'error' && (
        <View style={styles.center}>
          <Text style={styles.errorIcon}>❌</Text>
          <Text style={styles.title}>Verification Failed</Text>
          <Text style={styles.errorText}>{error}</Text>
          {capturedImage && (
            <Image source={{ uri: capturedImage }} style={styles.capturedPreview} />
          )}
          <TouchableOpacity style={styles.primaryBtn} onPress={resetFlow}>
            <Text style={styles.primaryBtnText}>🔄 Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 12 }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: 'white', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: '#94a3b8', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  hintText: { color: '#475569', fontSize: 12, textAlign: 'center', marginTop: 8 },
  timeBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, paddingTop: 52, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  timeText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  warningIcon: { fontSize: 48, marginBottom: 16 },
  primaryBtn: { paddingVertical: 14, paddingHorizontal: 24, backgroundColor: '#6366f1', borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  primaryBtnText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
  btnDisabled: { opacity: 0.4 },
  infoGrid: { flexDirection: 'row', gap: 8, marginTop: 16 },
  infoCard: { flex: 1, alignItems: 'center', padding: 12, backgroundColor: 'rgba(99,102,241,0.1)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(99,102,241,0.25)' },
  infoIcon: { fontSize: 22, marginBottom: 4 },
  infoLabel: { color: '#c7d2fe', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  infoDesc: { color: '#64748b', fontSize: 10, textAlign: 'center', marginTop: 2 },
  cameraWrapper: { flex: 1, padding: 16 },
  livenessSteps: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 12 },
  stepChip: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  stepChipDone: { backgroundColor: 'rgba(16,185,129,0.2)', borderColor: '#10b981' },
  stepChipActive: { backgroundColor: 'rgba(99,102,241,0.3)', borderColor: '#6366f1' },
  stepChipPending: { backgroundColor: 'rgba(30,41,59,0.5)', borderColor: '#334155' },
  stepIcon: { fontSize: 20 },
  camera: { flex: 1, borderRadius: 24, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  ovalGuide: { width: '50%', height: '70%', borderRadius: 999, borderWidth: 3, borderColor: 'rgba(99,102,241,0.8)' },
  countdownOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  countdownText: { color: 'white', fontSize: 72, fontWeight: 'black' },
  livenessPrompt: { position: 'absolute', bottom: 16, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15,23,42,0.85)', padding: 12, borderRadius: 16, gap: 8, borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)' },
  livenessPromptIcon: { fontSize: 24 },
  livenessPromptText: { color: 'white', fontWeight: '600', flex: 1 },
  livenessNote: { color: '#64748b', fontSize: 12, textAlign: 'center', marginTop: 12 },
  capturedPreview: { width: 100, height: 100, borderRadius: 16, borderWidth: 2, borderColor: '#6366f1', marginBottom: 8 },
  successIcon: { fontSize: 64, marginBottom: 16 },
  errorIcon: { fontSize: 48, marginBottom: 16 },
  errorText: { color: '#fca5a5', fontSize: 13, textAlign: 'center', lineHeight: 20, marginVertical: 12, paddingHorizontal: 16 },
  badgesRow: { flexDirection: 'row', gap: 8, marginVertical: 16 },
  verifyBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' },
  verifyBadgeText: { color: '#6ee7b7', fontSize: 11, fontWeight: '600' },
  cancelText: { color: '#64748b', fontSize: 14 },
});
