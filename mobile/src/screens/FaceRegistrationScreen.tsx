/**
 * Face Registration Screen - React Native (Expo)
 * Guides the student through 5 face captures with poses.
 * Sends base64 images to /api/face/register
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ScrollView, Alert, ActivityIndicator, Dimensions
} from 'react-native';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Capture steps
const CAPTURE_STEPS = [
  { label: 'Looking Straight', instruction: 'Look directly at the camera', icon: '👀' },
  { label: 'Looking Left',     instruction: 'Slowly turn head to the LEFT', icon: '⬅️' },
  { label: 'Looking Right',    instruction: 'Slowly turn head to the RIGHT', icon: '➡️' },
  { label: 'Looking Up',       instruction: 'Tilt your head slightly upward', icon: '⬆️' },
  { label: 'Looking Down',     instruction: 'Tilt your head slightly downward', icon: '⬇️' },
];

const API_BASE = 'https://spark-innovation.onrender.com/api';

export default function FaceRegistrationScreen({ navigation }: any) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  const [step, setStep] = useState(0);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [registrationStatus, setRegistrationStatus] = useState<'unknown' | 'registered' | 'not_registered'>('unknown');
  const [registeredAt, setRegisteredAt] = useState<string | null>(null);
  const [cameraVisible, setCameraVisible] = useState(false);

  // Load status on mount
  useEffect(() => {
    checkStatus();
  }, []);

  const getAuthHeader = async () => {
    const token = await AsyncStorage.getItem('access_token');
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  const checkStatus = async () => {
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_BASE}/face/my-status`, { headers });
      const data = await res.json();
      if (data.face_registered) {
        setRegistrationStatus('registered');
        setRegisteredAt(data.registered_at);
      } else {
        setRegistrationStatus('not_registered');
      }
    } catch {
      setRegistrationStatus('not_registered');
    }
  };

  // Capture with countdown
  const doCapture = useCallback(async () => {
    if (capturing || !cameraRef.current) return;
    setCapturing(true);

    // 3-second countdown
    for (let i = 3; i >= 1; i--) {
      setCountdown(i);
      await new Promise(r => setTimeout(r, 900));
    }
    setCountdown(null);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        base64: true,
        exif: false,
      });

      const base64 = `data:image/jpeg;base64,${photo.base64}`;
      const newImages = [...capturedImages, base64];
      setCapturedImages(newImages);

      if (step < CAPTURE_STEPS.length - 1) {
        setStep(s => s + 1);
      }
    } catch (e) {
      Alert.alert('Capture Failed', 'Could not capture photo. Please try again.');
    } finally {
      setCapturing(false);
    }
  }, [capturing, capturedImages, step]);

  // Submit registration
  const submitRegistration = async () => {
    if (capturedImages.length < 5) {
      Alert.alert('Not Enough Photos', 'Please capture all 5 face poses.');
      return;
    }
    setUploading(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_BASE}/face/register`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ images_base64: capturedImages }),
      });
      const data = await res.json();

      if (res.ok) {
        Alert.alert(
          '✅ Registration Successful',
          'Your face has been registered. You can now use Face Attendance.',
          [{ text: 'OK', onPress: () => { setCameraVisible(false); checkStatus(); } }]
        );
      } else {
        Alert.alert('Registration Failed', data.detail || 'Please try again.');
      }
    } catch (e) {
      Alert.alert('Error', 'Network error. Please check your connection.');
    } finally {
      setUploading(false);
    }
  };

  if (!permission) return <View style={styles.container}><ActivityIndicator color="#6366f1" size="large" /></View>;

  if (!permission.granted) {
    return (
      <LinearGradient colors={['#0f172a', '#1e1b4b']} style={styles.container}>
        <Text style={styles.title}>Camera Permission Required</Text>
        <Text style={styles.subtitle}>Grant camera access to register your face.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  const allCaptured = capturedImages.length >= CAPTURE_STEPS.length;

  // ── Not registered view
  if (registrationStatus === 'registered' && !cameraVisible) {
    return (
      <LinearGradient colors={['#0f172a', '#1e1b4b']} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.successCard}>
            <Text style={styles.checkMark}>✅</Text>
            <Text style={styles.title}>Face Registered</Text>
            <Text style={styles.subtitle}>
              Your face is registered and ready for secure attendance.
            </Text>
            {registeredAt && (
              <Text style={styles.dateText}>
                Registered: {new Date(registeredAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
              </Text>
            )}
            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: 24 }]}
              onPress={() => { setRegistrationStatus('not_registered'); setCameraVisible(true); setCapturedImages([]); setStep(0); }}
            >
              <Text style={styles.primaryBtnText}>🔄 Update Face Registration</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>
    );
  }

  if ((registrationStatus === 'not_registered' || registrationStatus === 'unknown') && !cameraVisible) {
    return (
      <LinearGradient colors={['#0f172a', '#1e1b4b']} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>🔐 Face Registration</Text>
          <Text style={styles.subtitle}>
            Register your face to use secure Face Attendance.{'\n'}You'll capture 5 photos in different poses.
          </Text>

          <View style={styles.stepsGrid}>
            {CAPTURE_STEPS.map((s, i) => (
              <View key={i} style={styles.stepChip}>
                <Text style={styles.stepIcon}>{s.icon}</Text>
                <Text style={styles.stepLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, { marginTop: 24 }]}
            onPress={() => { setCameraVisible(true); setCapturedImages([]); setStep(0); }}
          >
            <Text style={styles.primaryBtnText}>📷 Open Camera & Register</Text>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    );
  }

  // ── Camera View
  return (
    <LinearGradient colors={['#0f172a', '#1e1b4b']} style={styles.container}>
      {/* Progress */}
      <View style={styles.progressBar}>
        {CAPTURE_STEPS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressDot,
              i < capturedImages.length ? styles.progressDotDone :
              i === capturedImages.length ? styles.progressDotActive :
              styles.progressDotPending,
            ]}
          />
        ))}
        <Text style={styles.progressText}>
          {Math.min(capturedImages.length + 1, CAPTURE_STEPS.length)} / {CAPTURE_STEPS.length}
        </Text>
      </View>

      {/* Camera */}
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
        >
          {/* Face oval guide */}
          <View style={styles.ovalGuide} />

          {/* Countdown overlay */}
          {countdown !== null && (
            <View style={styles.countdownOverlay}>
              <Text style={styles.countdownText}>{countdown}</Text>
            </View>
          )}

          {/* Success overlay */}
          {allCaptured && (
            <View style={styles.successOverlay}>
              <Text style={styles.successOverlayText}>✅ All photos captured!</Text>
            </View>
          )}
        </CameraView>
      </View>

      {/* Current instruction */}
      {!allCaptured && (
        <View style={styles.instructionBox}>
          <Text style={styles.instructionIcon}>{CAPTURE_STEPS[step]?.icon}</Text>
          <Text style={styles.instructionText}>{CAPTURE_STEPS[step]?.instruction}</Text>
        </View>
      )}

      {/* Thumbnails */}
      {capturedImages.length > 0 && (
        <View style={styles.thumbnailRow}>
          {capturedImages.map((img, i) => (
            <Image key={i} source={{ uri: img }} style={styles.thumbnail} />
          ))}
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actionRow}>
        {!allCaptured ? (
          <TouchableOpacity
            style={[styles.primaryBtn, { flex: 1 }, (capturing || !!countdown) && styles.btnDisabled]}
            onPress={doCapture}
            disabled={capturing || !!countdown}
          >
            {capturing ? (
              <ActivityIndicator color="white" />
            ) : countdown ? (
              <Text style={styles.primaryBtnText}>Capturing in {countdown}...</Text>
            ) : (
              <Text style={styles.primaryBtnText}>📷 Capture Photo {capturedImages.length + 1}</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.successBtn, { flex: 1 }, uploading && styles.btnDisabled]}
            onPress={submitRegistration}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.primaryBtnText}>⬆️ Submit Registration</Text>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.resetBtn}
          onPress={() => { setCapturedImages([]); setStep(0); }}
        >
          <Text style={styles.resetBtnText}>🔄</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => setCameraVisible(false)} style={styles.cancelBtn}>
        <Text style={styles.cancelBtnText}>Cancel</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, alignItems: 'center' },
  title: { color: 'white', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: '#94a3b8', fontSize: 14, textAlign: 'center', marginBottom: 16, lineHeight: 22 },
  dateText: { color: '#64748b', fontSize: 12, textAlign: 'center', marginTop: 8 },
  checkMark: { fontSize: 48, textAlign: 'center', marginBottom: 16 },
  successCard: { padding: 24, backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', alignItems: 'center', width: '100%' },
  stepsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 16 },
  stepChip: { alignItems: 'center', padding: 12, backgroundColor: 'rgba(99,102,241,0.15)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)', width: (SCREEN_W - 80) / 3 },
  stepIcon: { fontSize: 24, marginBottom: 4 },
  stepLabel: { color: '#c7d2fe', fontSize: 10, textAlign: 'center', fontWeight: '600' },
  progressBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 56, paddingBottom: 8, gap: 8 },
  progressDot: { height: 8, borderRadius: 4 },
  progressDotDone: { width: 24, backgroundColor: '#10b981' },
  progressDotActive: { width: 24, backgroundColor: '#6366f1' },
  progressDotPending: { width: 8, backgroundColor: '#334155' },
  progressText: { color: '#94a3b8', fontSize: 12, marginLeft: 8 },
  cameraContainer: { flex: 1, margin: 16, borderRadius: 24, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(99,102,241,0.4)' },
  camera: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  ovalGuide: { width: '50%', height: '70%', borderRadius: 999, borderWidth: 3, borderColor: 'rgba(99,102,241,0.8)', borderStyle: 'solid' },
  countdownOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  countdownText: { color: 'white', fontSize: 72, fontWeight: 'black' },
  successOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(16,185,129,0.5)', justifyContent: 'center', alignItems: 'center' },
  successOverlayText: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  instructionBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, padding: 12, backgroundColor: 'rgba(15,23,42,0.8)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)', gap: 8 },
  instructionIcon: { fontSize: 24 },
  instructionText: { color: 'white', fontSize: 14, fontWeight: '600', flex: 1 },
  thumbnailRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, justifyContent: 'center', marginTop: 8 },
  thumbnail: { width: 52, height: 52, borderRadius: 12, borderWidth: 2, borderColor: '#10b981' },
  actionRow: { flexDirection: 'row', gap: 12, margin: 16 },
  primaryBtn: { padding: 16, backgroundColor: '#6366f1', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  successBtn: { padding: 16, backgroundColor: '#10b981', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
  btnDisabled: { opacity: 0.5 },
  resetBtn: { padding: 16, backgroundColor: '#1e293b', borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#334155' },
  resetBtnText: { fontSize: 20 },
  cancelBtn: { alignItems: 'center', paddingBottom: 24 },
  cancelBtnText: { color: '#64748b', fontSize: 14 },
});
