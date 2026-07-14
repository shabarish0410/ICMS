import { useState, useEffect, useRef, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export interface FaceState {
  isDetecting: boolean;
  hasFace: boolean;
  isCentered: boolean;
  isGoodSize: boolean;
  hasBlinked: boolean;
  readyForBurst: boolean;
  guidanceText: string;
  guidanceColor: 'slate' | 'indigo' | 'emerald' | 'amber' | 'red';
  warning?: string;
  hasTimeout?: boolean;
}

const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// Singleton to reuse the model across mounts
let globalFaceLandmarker: FaceLandmarker | null = null;
let modelInitPromise: Promise<FaceLandmarker> | null = null;

function getEAR(eyeLandmarks: {x:number, y:number}[]) {
  if (eyeLandmarks.length < 6) return 0.3;
  const dist = (p1: any, p2: any) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  const v1 = dist(eyeLandmarks[1], eyeLandmarks[5]);
  const v2 = dist(eyeLandmarks[2], eyeLandmarks[4]);
  const h = dist(eyeLandmarks[0], eyeLandmarks[3]);
  if (h === 0) return 0.3;
  return (v1 + v2) / (2.0 * h);
}

export function useFaceDetection(
  videoRef: React.RefObject<HTMLVideoElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  onBurstCaptureRequest?: () => void
) {
  const [faceState, setFaceState] = useState<FaceState>({
    isDetecting: false,
    hasFace: false,
    isCentered: false,
    isGoodSize: false,
    hasBlinked: true, // Legacy compatibility
    readyForBurst: false,
    guidanceText: 'Initializing AI model...',
    guidanceColor: 'slate',
  });

  const requestRef = useRef<number>();
  const lastVideoTimeRef = useRef<number>(-1);
  const lastProcessTimeMs = useRef<number>(0);
  const detectionStartTimeMs = useRef<number>(0);
  
  const hasBlinkedRef = useRef(true); // Hardcode true
  const burstRequestedRef = useRef(false);
  const isMountedRef = useRef(true);
  
  // Debounce tracking
  const consecutiveWarningFrames = useRef(0);
  const lastWarningRef = useRef<string>('');
  
  // Steady face tracking
  const steadyStartTimeRef = useRef<number>(0);

  // Initialize MediaPipe Face Landmarker
  useEffect(() => {
    isMountedRef.current = true;
    
    const initModel = async () => {
      try {
        if (!globalFaceLandmarker) {
          if (!modelInitPromise) {
            modelInitPromise = (async () => {
              const vision = await FilesetResolver.forVisionTasks(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
              );
              return await FaceLandmarker.createFromOptions(vision, {
                baseOptions: {
                  modelAssetPath: MODEL_URL,
                  delegate: 'GPU'
                },
                outputFaceBlendshapes: true,
                runningMode: 'VIDEO',
                numFaces: 1
              });
            })();
          }
          globalFaceLandmarker = await modelInitPromise;
        }
        
        if (isMountedRef.current) {
          setFaceState(prev => ({ ...prev, guidanceText: 'Ready. Position your face in the oval.', guidanceColor: 'slate' }));
        }
      } catch (err) {
        console.error("Failed to load FaceLandmarker", err);
        if (isMountedRef.current) {
          setFaceState(prev => ({ ...prev, guidanceText: 'Failed to load AI model.', guidanceColor: 'red' }));
        }
      }
    };
    
    initModel();
    
    return () => {
      isMountedRef.current = false;
      // Do NOT close the faceLandmarker so it can be reused immediately.
    };
  }, []);

  // Main detection loop
  const detectFace = useCallback(() => {
    if (!globalFaceLandmarker || !videoRef.current || !canvasRef.current || burstRequestedRef.current) {
      if (!burstRequestedRef.current) {
        requestRef.current = requestAnimationFrame(detectFace);
      }
      return;
    }

    const video = videoRef.current;
    if (video.readyState < 2) {
      requestRef.current = requestAnimationFrame(detectFace);
      return;
    }

    if (detectionStartTimeMs.current === 0) {
      detectionStartTimeMs.current = performance.now();
    }

    const now = performance.now();
    
    // 15 FPS Throttle (~66ms)
    if (now - lastProcessTimeMs.current < 66) {
      requestRef.current = requestAnimationFrame(detectFace);
      return;
    }
    
    // Process only if new frame is available
    if (video.currentTime !== lastVideoTimeRef.current) {
      lastProcessTimeMs.current = now;
      lastVideoTimeRef.current = video.currentTime;
      
      const results = globalFaceLandmarker.detectForVideo(video, now);

      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        const landmarks = results.faceLandmarks[0];
        
        // Reset timeout clock if we successfully see a face
        detectionStartTimeMs.current = now;

        // Face Size & Center check
        const nose = landmarks[1];
        const leftEar = landmarks[234];
        const rightEar = landmarks[454];
        const topFace = landmarks[10];
        const bottomFace = landmarks[152];

        const width = rightEar.x - leftEar.x;
        const height = bottomFace.y - topFace.y;
        
        // Slightly relaxed thresholds for speed and reliability
        const isGoodSize = width > 0.25 && height > 0.25;
        const isCentered = nose.x > 0.25 && nose.x < 0.75 && nose.y > 0.25 && nose.y < 0.75;

        // Blink detection
        const LEFT_EYE = [362, 385, 387, 263, 373, 380].map(i => landmarks[i]);
        const RIGHT_EYE = [33, 160, 158, 133, 153, 144].map(i => landmarks[i]);
        const leftEAR = getEAR(LEFT_EYE);
        const rightEAR = getEAR(RIGHT_EYE);
        
        if (leftEAR < 0.2 && rightEAR < 0.2) {
          hasBlinkedRef.current = true;
        }

        let rawWarning = '';
        if (results.faceLandmarks.length > 1) rawWarning = 'Only one person allowed';
        else if (!isCentered) rawWarning = 'Center your face in the oval';
        else if (!isGoodSize) rawWarning = 'Move closer to the camera';

        // Debounce warning (require 3 consecutive frames of the same warning to show it)
        if (rawWarning === lastWarningRef.current && rawWarning !== '') {
          consecutiveWarningFrames.current++;
        } else if (rawWarning !== '') {
          lastWarningRef.current = rawWarning;
          consecutiveWarningFrames.current = 1;
        } else {
          lastWarningRef.current = '';
          consecutiveWarningFrames.current = 0;
        }

        const warning = consecutiveWarningFrames.current >= 3 ? rawWarning : '';

        let guidanceText = 'Position your face in the oval';
        let guidanceColor: FaceState['guidanceColor'] = 'slate';

        if (warning) {
          guidanceText = warning;
          guidanceColor = 'amber';
          steadyStartTimeRef.current = 0; // Reset steady timer
        } else {
          if (steadyStartTimeRef.current === 0) {
            steadyStartTimeRef.current = now;
          }
          
          const steadyDuration = now - steadyStartTimeRef.current;
          
          if (steadyDuration < 1500) {
            guidanceText = 'Hold still...';
            guidanceColor = 'indigo';
          } else {
            guidanceText = 'Capturing!';
            guidanceColor = 'emerald';
            
            if (!burstRequestedRef.current) {
              burstRequestedRef.current = true;
              if (onBurstCaptureRequest) {
                onBurstCaptureRequest();
              }
            }
          }
        }

        setFaceState({
          isDetecting: true,
          hasFace: true,
          isCentered,
          isGoodSize,
          hasBlinked,
          readyForBurst: burstRequestedRef.current,
          guidanceText,
          guidanceColor,
          warning,
          hasTimeout: false
        });

      } else {
        // No face detected
        const hasTimeout = (now - detectionStartTimeMs.current) > 5000;
        let w = 'No face detected';
        if (hasTimeout) w = 'No face detected for 5 seconds. Please ensure good lighting.';

        setFaceState({
          isDetecting: true,
          hasFace: false,
          isCentered: false,
          isGoodSize: false,
          hasBlinked: true,
          readyForBurst: false,
          guidanceText: 'Position your face in the frame',
          guidanceColor: hasTimeout ? 'red' : 'slate',
          warning: w,
          hasTimeout
        });
      }
    }

    if (!burstRequestedRef.current) {
      requestRef.current = requestAnimationFrame(detectFace);
    }
  }, [onBurstCaptureRequest]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(detectFace);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [detectFace]);

  return faceState;
}
