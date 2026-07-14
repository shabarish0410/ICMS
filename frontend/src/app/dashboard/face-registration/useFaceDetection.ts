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
}

const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

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
  const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker | null>(null);
  const [faceState, setFaceState] = useState<FaceState>({
    isDetecting: false,
    hasFace: false,
    isCentered: false,
    isGoodSize: false,
    hasBlinked: false,
    readyForBurst: false,
    guidanceText: 'Initializing AI model...',
    guidanceColor: 'slate',
  });

  const requestRef = useRef<number>();
  const lastVideoTimeRef = useRef<number>(-1);
  const hasBlinkedRef = useRef(false);
  const burstRequestedRef = useRef(false);
  const isMountedRef = useRef(true);

  // Initialize MediaPipe Face Landmarker
  useEffect(() => {
    isMountedRef.current = true;
    const initModel = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'GPU'
          },
          outputFaceBlendshapes: true,
          runningMode: 'VIDEO',
          numFaces: 1
        });
        
        if (isMountedRef.current) {
          setFaceLandmarker(landmarker);
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
      if (faceLandmarker) faceLandmarker.close();
    };
  }, []);

  // Main detection loop
  const detectFace = useCallback(() => {
    if (!faceLandmarker || !videoRef.current || !canvasRef.current || burstRequestedRef.current) {
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

    // Process only if new frame is available
    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      
      const startTimeMs = performance.now();
      const results = faceLandmarker.detectForVideo(video, startTimeMs);

      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        const landmarks = results.faceLandmarks[0];
        
        // Face Size & Center check
        const nose = landmarks[1];
        const leftEar = landmarks[234];
        const rightEar = landmarks[454];
        const topFace = landmarks[10];
        const bottomFace = landmarks[152];

        const width = rightEar.x - leftEar.x;
        const height = bottomFace.y - topFace.y;
        const isGoodSize = width > 0.3 && height > 0.3;
        const isCentered = nose.x > 0.3 && nose.x < 0.7 && nose.y > 0.3 && nose.y < 0.7;

        // Blink detection
        const LEFT_EYE = [362, 385, 387, 263, 373, 380].map(i => landmarks[i]);
        const RIGHT_EYE = [33, 160, 158, 133, 153, 144].map(i => landmarks[i]);
        const leftEAR = getEAR(LEFT_EYE);
        const rightEAR = getEAR(RIGHT_EYE);
        
        if (leftEAR < 0.2 && rightEAR < 0.2) {
          hasBlinkedRef.current = true;
        }

        let warning = '';
        if (results.faceLandmarks.length > 1) warning = 'Only one person allowed';
        else if (!isCentered) warning = 'Center your face in the oval';
        else if (!isGoodSize) warning = 'Move closer to the camera';

        const hasBlinked = hasBlinkedRef.current;
        let guidanceText = 'Position your face in the oval';
        let guidanceColor: FaceState['guidanceColor'] = 'slate';

        if (warning) {
          guidanceText = warning;
          guidanceColor = 'amber';
        } else if (!hasBlinked) {
          guidanceText = 'Blink once naturally';
          guidanceColor = 'indigo';
        } else {
          guidanceText = 'Hold still... capturing!';
          guidanceColor = 'emerald';
          
          if (!burstRequestedRef.current) {
            burstRequestedRef.current = true;
            if (onBurstCaptureRequest) {
              onBurstCaptureRequest();
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
          warning
        });

      } else {
        // No face detected
        setFaceState({
          isDetecting: true,
          hasFace: false,
          isCentered: false,
          isGoodSize: false,
          hasBlinked: hasBlinkedRef.current,
          readyForBurst: false,
          guidanceText: 'Position your face in the frame',
          guidanceColor: 'slate',
          warning: 'No face detected'
        });
      }
    }

    if (!burstRequestedRef.current) {
      requestRef.current = requestAnimationFrame(detectFace);
    }
  }, [faceLandmarker, onBurstCaptureRequest]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(detectFace);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [detectFace]);

  return faceState;
}
