import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ScrollView, Alert, ActivityIndicator, Dimensions, Animated, Easing
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FaceDetector from 'expo-face-detector';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const API_BASE = 'https://spark-innovation.onrender.com/api';

type AppState = 'about' | 'permission' | 'environment' | 'camera' | 'processing' | 'success';

export default function FaceRegistrationScreen({ navigation }: any) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  const [appState, setAppState] = useState<AppState>('about');
  
  // Environment Check states
  const [envChecks, setEnvChecks] = useState({
    camera: false,
    lighting: false,
    internet: false,
    ready: false
  });

  // Camera capture & detection states
  const [isDetecting, setIsDetecting] = useState(false);
  const [instruction, setInstruction] = useState('Place your face inside the circle');
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  
  const steadyStartTimeRef = useRef<number>(0);

  // Trigger entering animation on state change
  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true })
    ]).start();
  }, [appState]);

  // Auth header helper
  const getAuthHeader = async () => {
    const token = await AsyncStorage.getItem('access_token');
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  // ── Environment Check Simulation ──
  useEffect(() => {
    if (appState === 'environment') {
      let step = 0;
      const interval = setInterval(() => {
        step++;
        if (step === 1) setEnvChecks((prev: any) => ({ ...prev, camera: true }));
        else if (step === 2) setEnvChecks((prev: any) => ({ ...prev, internet: true }));
        else if (step === 3) setEnvChecks((prev: any) => ({ ...prev, lighting: true }));
        else if (step === 4) {
          setEnvChecks((prev: any) => ({ ...prev, ready: true }));
          clearInterval(interval);
          setTimeout(() => setAppState('camera'), 800);
        }
      }, 600);
      return () => clearInterval(interval);
    }
  }, [appState]);

  // ── Face Detection Loop ──
  useEffect(() => {
    let active = true;
    let frameTimer: any;

    const detectLoop = async () => {
      if (appState !== 'camera' || !cameraRef.current || isDetecting) return;
      setIsDetecting(true);

      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.3,
          base64: true,
        });

        if (!active) return;

        const result = await FaceDetector.detectFacesAsync(photo.uri, {
          mode: FaceDetector.FaceDetectorMode.fast,
          detectLandmarks: FaceDetector.FaceDetectorLandmarks.none,
          runClassifications: FaceDetector.FaceDetectorClassifications.all,
        });

        if (result.faces.length === 0) {
          setInstruction('Position your face in the frame');
        } else if (result.faces.length > 1) {
          setInstruction('Only one face should be visible');
        } else {
          const face = result.faces[0];
          
          // Check bounds (face centered and large enough)
          const isCentered = face.bounds.origin.x > 0 && face.bounds.origin.y > 0;
          
          if (!isCentered) {
            setInstruction('Center your face');
            steadyStartTimeRef.current = 0;
          } else {
            // Wait for 1.5 seconds of steady centering
            if (steadyStartTimeRef.current === 0) {
              steadyStartTimeRef.current = Date.now();
            }
            
            const steadyDuration = Date.now() - steadyStartTimeRef.current;
            
            if (steadyDuration < 1500) {
              setInstruction('Hold still...');
            } else {
              setInstruction('Capturing!');
              active = false;
              
              // Capture high quality single frame
              if (cameraRef.current) {
                const hqPhoto = await cameraRef.current.takePictureAsync({
                  quality: 0.8, // high quality
                  base64: true,
                });
                setCapturedImages([`data:image/jpeg;base64,${hqPhoto.base64}`]);
              }
              
              setAppState('processing');
              return;
            } else {
              setInstruction('Blink once naturally');
            }
          }
        }
      } catch (e) {
        // silently ignore frame errors
      } finally {
        setIsDetecting(false);
        if (active) {
          frameTimer = setTimeout(detectLoop, 66); // ~15 FPS
        }
      }
    };

    if (appState === 'camera') {
      frameTimer = setTimeout(detectLoop, 1000); // give camera time to initialize
    }

    return () => {
      active = false;
      clearTimeout(frameTimer);
    };
  }, [appState]);

  // ── Registration Submit ──
  useEffect(() => {
    if (appState === 'processing' && capturedImages.length > 0) {
      submitRegistration(capturedImages);
    }
  }, [appState, capturedImages]);

  const submitRegistration = async (imagesBase64: string[]) => {
    try {
      const headers = await getAuthHeader();
      // Send single image base64
      const res = await fetch(`${API_BASE}/face/register`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ image_base64: imagesBase64[0] }),
      });
      
      const data = await res.json();
      if (res.ok) {
        setAppState('success');
      } else {
        Alert.alert('Registration Failed', data.detail || 'Could not register face.', [
          { text: 'Try Again', onPress: () => setAppState('camera') }
        ]);
      }
    } catch (e) {
      Alert.alert('Network Error', 'Please check your connection and try again.', [
        { text: 'Try Again', onPress: () => setAppState('camera') }
      ]);
    }
  };


  // ── Views ──

  const renderAbout = () => (
    <Animated.View style={[styles.screen, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerContainer}>
          <Text style={styles.largeTitle}>Face Registration</Text>
          <Text style={styles.subtitle}>Register your face securely to enable Face Attendance in ICMS.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.benefitRow}>
            <Text style={styles.benefitIcon}>🔒</Text>
            <Text style={styles.benefitText}>Secure Attendance</Text>
          </View>
          <View style={styles.benefitRow}>
            <Text style={styles.benefitIcon}>👤</Text>
            <Text style={styles.benefitText}>One Face Per Account</Text>
          </View>
          <View style={styles.benefitRow}>
            <Text style={styles.benefitIcon}>🤖</Text>
            <Text style={styles.benefitText}>AI Face Verification</Text>
          </View>
          <View style={styles.benefitRow}>
            <Text style={styles.benefitIcon}>⚡</Text>
            <Text style={styles.benefitText}>Fast Attendance</Text>
          </View>
        </View>

        <View style={styles.instructionContainer}>
          <Text style={styles.instructionTitle}>Instructions</Text>
          <Text style={styles.instructionItem}>• Remove any mask</Text>
          <Text style={styles.instructionItem}>• Ensure good lighting</Text>
          <Text style={styles.instructionItem}>• Keep your face inside the circle</Text>
          <Text style={styles.instructionItem}>• Remove sunglasses</Text>
          <Text style={styles.instructionItem}>• Hold your phone steady</Text>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => {
          if (permission?.granted) setAppState('environment');
          else setAppState('permission');
        }}>
          <Text style={styles.primaryBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderPermission = () => (
    <Animated.View style={[styles.screen, styles.center, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.iconCircle}>
        <Text style={styles.largeIcon}>📷</Text>
      </View>
      <Text style={styles.largeTitle}>Camera Permission</Text>
      <Text style={[styles.subtitle, { textAlign: 'center', marginTop: 12, paddingHorizontal: 24 }]}>
        ICMS needs access to your camera to register your face.
      </Text>
      <View style={[styles.bottomBar, { position: 'absolute', bottom: 0, left: 0, right: 0 }]}>
        <TouchableOpacity style={styles.primaryBtn} onPress={async () => {
          const res = await requestPermission();
          if (res.granted) setAppState('environment');
        }}>
          <Text style={styles.primaryBtnText}>Allow Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderEnvironmentCheck = () => (
    <Animated.View style={[styles.screen, styles.center, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Text style={[styles.largeTitle, { marginBottom: 40 }]}>Environment Check</Text>
      
      <View style={styles.checkRow}>
        <Text style={styles.checkText}>Camera Ready</Text>
        {envChecks.camera ? <Text style={styles.checkIconSuccess}>✓</Text> : <ActivityIndicator color="#6366f1" />}
      </View>
      <View style={styles.checkRow}>
        <Text style={styles.checkText}>Internet Connected</Text>
        {envChecks.internet ? <Text style={styles.checkIconSuccess}>✓</Text> : (envChecks.camera ? <ActivityIndicator color="#6366f1" /> : <Text style={styles.checkIconPending}>-</Text>)}
      </View>
      <View style={styles.checkRow}>
        <Text style={styles.checkText}>Lighting Good</Text>
        {envChecks.lighting ? <Text style={styles.checkIconSuccess}>✓</Text> : (envChecks.internet ? <ActivityIndicator color="#6366f1" /> : <Text style={styles.checkIconPending}>-</Text>)}
      </View>
      <View style={styles.checkRow}>
        <Text style={styles.checkText}>Ready</Text>
        {envChecks.ready ? <Text style={styles.checkIconSuccess}>✓</Text> : (envChecks.lighting ? <ActivityIndicator color="#6366f1" /> : <Text style={styles.checkIconPending}>-</Text>)}
      </View>
    </Animated.View>
  );

  const renderCamera = () => (
    <Animated.View style={[styles.screen, { opacity: fadeAnim }]}>
      <View style={styles.cameraHeader}>
        <Text style={styles.cameraInstruction}>{instruction}</Text>
      </View>
      
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
        >
          <View style={styles.ovalMaskContainer}>
            <View style={styles.ovalGuide} />
          </View>
        </CameraView>
      </View>
      
      <View style={styles.cameraFooter}>
        <TouchableOpacity style={styles.cancelLink} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelLinkText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderProcessing = () => (
    <Animated.View style={[styles.screen, styles.center, { opacity: fadeAnim }]}>
      <ActivityIndicator size="large" color="#6366f1" />
      <Text style={[styles.largeTitle, { marginTop: 32 }]}>Processing...</Text>
      <View style={styles.processingList}>
        <Text style={styles.processingItem}>✓ Detecting Face</Text>
        <Text style={styles.processingItem}>✓ Checking Liveness</Text>
        <Text style={styles.processingItemActive}>Generating Face Embedding...</Text>
        <Text style={styles.processingItemPending}>Uploading Securely...</Text>
      </View>
    </Animated.View>
  );

  const renderSuccess = () => (
    <Animated.View style={[styles.screen, styles.center, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.iconCircleSuccess}>
        <Text style={styles.largeIcon}>✅</Text>
      </View>
      <Text style={styles.largeTitle}>Face Registered</Text>
      <Text style={[styles.subtitle, { textAlign: 'center', marginTop: 12, paddingHorizontal: 24 }]}>
        Your face has been securely registered. You can now use Face Attendance.
      </Text>
      <View style={[styles.bottomBar, { position: 'absolute', bottom: 0, left: 0, right: 0 }]}>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.primaryBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      {appState === 'about' && renderAbout()}
      {appState === 'permission' && renderPermission()}
      {appState === 'environment' && renderEnvironmentCheck()}
      {appState === 'camera' && renderCamera()}
      {appState === 'processing' && renderProcessing()}
      {appState === 'success' && renderSuccess()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  screen: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 24, paddingTop: 60, paddingBottom: 100 },
  
  headerContainer: { marginBottom: 32 },
  largeTitle: { fontSize: 32, fontWeight: '700', color: '#111827', letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: '#6B7280', marginTop: 8, lineHeight: 24 },
  
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 32
  },
  benefitRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  benefitIcon: { fontSize: 24, marginRight: 16 },
  benefitText: { fontSize: 16, fontWeight: '600', color: '#374151' },
  
  instructionContainer: { paddingHorizontal: 8 },
  instructionTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16 },
  instructionItem: { fontSize: 15, color: '#4B5563', marginBottom: 12, lineHeight: 22 },
  
  bottomBar: {
    padding: 24,
    paddingBottom: 40,
    backgroundColor: '#FAFAFA',
  },
  primaryBtn: {
    backgroundColor: '#000000', // Samsung One UI style sleek black button
    borderRadius: 30,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  secondaryBtn: {
    marginTop: 16,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  secondaryBtnText: { color: '#6B7280', fontSize: 16, fontWeight: '600' },

  iconCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginBottom: 32 },
  iconCircleSuccess: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#D1FAE5', justifyContent: 'center', alignItems: 'center', marginBottom: 32 },
  largeIcon: { fontSize: 40 },

  checkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '80%', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  checkText: { fontSize: 18, fontWeight: '500', color: '#374151' },
  checkIconSuccess: { fontSize: 20, color: '#10B981', fontWeight: 'bold' },
  checkIconPending: { fontSize: 20, color: '#D1D5DB' },

  cameraHeader: { position: 'absolute', top: 60, left: 0, right: 0, zIndex: 10, alignItems: 'center' },
  cameraInstruction: { backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, overflow: 'hidden', fontSize: 16, fontWeight: '600' },
  
  cameraContainer: { flex: 1, backgroundColor: 'black' },
  camera: { flex: 1 },
  ovalMaskContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  ovalGuide: { width: 280, height: 400, borderRadius: 140, borderWidth: 4, borderColor: 'rgba(255,255,255,0.7)', borderStyle: 'dashed' }, 
  
  cameraFooter: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' },
  cancelLink: { padding: 16 },
  cancelLinkText: { color: 'white', fontSize: 16, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },

  processingList: { marginTop: 32, alignItems: 'flex-start' },
  processingItem: { fontSize: 16, color: '#10B981', marginBottom: 12, fontWeight: '500' },
  processingItemActive: { fontSize: 16, color: '#6366f1', marginBottom: 12, fontWeight: '600' },
  processingItemPending: { fontSize: 16, color: '#9CA3AF', marginBottom: 12 },
});
