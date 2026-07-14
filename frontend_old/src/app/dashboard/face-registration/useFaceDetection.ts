import { useState, useEffect, useRef, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';

export type PoseType = 'straight' | 'left' | 'right' | 'up' | 'down';

export interface FaceState {
  isDetecting: boolean;
  hasFace: boolean;
  isCentered: boolean;
  isGoodSize: boolean;
  isStable: boolean;
  currentPose: PoseType | null;
  guidanceText: string;
  guidanceColor: 'slate' | 'indigo' | 'emerald' | 'amber' | 'red';
  stabilityProgress: number; // 0 to 1
  warning?: string;
}

const STABILITY_DURATION_MS = 2000; // Require 2 seconds of stable pose
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export function useFaceDetection(
  videoRef: React.RefObject<HTMLVideoElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  targetPose: PoseType | null,
  onPoseStable: (imageDataUrl: string) => void
) {
  const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker | null>(null);
  const [faceState, setFaceState] = useState<FaceState>({
    isDetecting: false,
    hasFace: false,
    isCentered: false,
    isGoodSize: false,
    isStable: false,
    currentPose: null,
    guidanceText: 'Initializing AI model...',
    guidanceColor: 'slate',
    stabilityProgress: 0,
  });

  const requestRef = useRef<number>();
  const lastVideoTimeRef = useRef<number>(-1);
  const stabilityStartTimeRef = useRef<number | null>(null);
  const stablePoseRef = useRef<PoseType | null>(null);

  // Initialize MediaPipe Face Landmarker
  useEffect(() => {
    let isMounted = true;
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
        
        if (isMounted) {
          setFaceLandmarker(landmarker);
          setFaceState(prev => ({ ...prev, guidanceText: 'Ready. Position your face in the oval.', guidanceColor: 'slate' }));
        }
      } catch (err) {
        console.error("Failed to load FaceLandmarker", err);
        if (isMounted) {
          setFaceState(prev => ({ ...prev, guidanceText: 'Failed to load AI model.', guidanceColor: 'red' }));
        }
      }
    };
    initModel();
    return () => {
      isMounted = false;
      if (faceLandmarker) faceLandmarker.close();
    };
  }, []);

  // Main detection loop
  const detectFace = useCallback(() => {
    if (!faceLandmarker || !videoRef.current || !canvasRef.current || !targetPose) {
      requestRef.current = requestAnimationFrame(detectFace);
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

      // Draw debug points if needed (we'll keep it hidden for UX, but good for logic)
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        canvasRef.current.width = video.videoWidth;
        canvasRef.current.height = video.videoHeight;
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        
        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          // Analyze face
          const landmarks = results.faceLandmarks[0];
          
          // Calculate Pose (Yaw and Pitch)
          // Simplified pose estimation based on nose tip and ear/eye positions
          const nose = landmarks[1];
          const leftEar = landmarks[234];
          const rightEar = landmarks[454];
          const topFace = landmarks[10];
          const bottomFace = landmarks[152];

          // Normalized coordinates (0 to 1)
          const yaw = (nose.x - leftEar.x) / (rightEar.x - leftEar.x); 
          // yaw approx 0.5 is straight. < 0.4 is turning right (from user perspective, looking left), > 0.6 is turning left.
          
          const pitch = (nose.y - topFace.y) / (bottomFace.y - topFace.y);
          // pitch approx 0.5 is straight. < 0.4 is looking up, > 0.6 is looking down.

          // Face Size check (rough bounding box)
          const width = rightEar.x - leftEar.x;
          const height = bottomFace.y - topFace.y;
          const isGoodSize = width > 0.3 && height > 0.3; // Face occupies at least 30% of frame

          // Centered check
          const isCentered = nose.x > 0.3 && nose.x < 0.7 && nose.y > 0.3 && nose.y < 0.7;

          // Determine current pose
          let detectedPose: PoseType = 'straight';
          if (yaw > 0.65) detectedPose = 'right'; // User turned head right
          else if (yaw < 0.35) detectedPose = 'left'; // User turned head left
          else if (pitch < 0.40) detectedPose = 'up'; // User tilted head up
          else if (pitch > 0.60) detectedPose = 'down'; // User tilted head down

          // Quality checks
          let warning = '';
          if (!isCentered) warning = 'Center your face in the oval';
          else if (!isGoodSize) warning = 'Move closer to the camera';
          else if (results.faceLandmarks.length > 1) warning = 'Only one person allowed';

          // Check if we are matching the target pose and quality is good
          const isMatchingPose = detectedPose === targetPose;
          const isReadyToCapture = isCentered && isGoodSize && isMatchingPose && !warning;

          if (isReadyToCapture) {
            if (!stabilityStartTimeRef.current || stablePoseRef.current !== detectedPose) {
              stabilityStartTimeRef.current = performance.now();
              stablePoseRef.current = detectedPose;
            } else {
              const elapsed = performance.now() - stabilityStartTimeRef.current;
              const progress = Math.min(elapsed / STABILITY_DURATION_MS, 1.0);
              
              if (progress >= 1.0) {
                // CAPTURE!
                stabilityStartTimeRef.current = null;
                stablePoseRef.current = null;
                
                // Capture from video directly to get high-res image
                const captureCanvas = document.createElement('canvas');
                captureCanvas.width = video.videoWidth;
                captureCanvas.height = video.videoHeight;
                const captureCtx = captureCanvas.getContext('2d');
                if (captureCtx) {
                  // Mirror image to match user view
                  captureCtx.translate(captureCanvas.width, 0);
                  captureCtx.scale(-1, 1);
                  captureCtx.drawImage(video, 0, 0);
                  const dataUrl = captureCanvas.toDataURL('image/jpeg', 0.9);
                  onPoseStable(dataUrl);
                }
              }
              
              setFaceState({
                isDetecting: true,
                hasFace: true,
                isCentered,
                isGoodSize,
                isStable: true,
                currentPose: detectedPose,
                guidanceText: 'Hold still...',
                guidanceColor: 'emerald',
                stabilityProgress: progress,
                warning: ''
              });
              requestRef.current = requestAnimationFrame(detectFace);
              return;
            }
          } else {
            // Reset stability if pose is lost or bad quality
            stabilityStartTimeRef.current = null;
            stablePoseRef.current = null;
          }

          // Update state with current info (not stable enough yet or wrong pose)
          let text = warning || `Please ${getPoseInstruction(targetPose)}`;
          let color: FaceState['guidanceColor'] = warning ? 'amber' : 'indigo';

          setFaceState({
            isDetecting: true,
            hasFace: true,
            isCentered,
            isGoodSize,
            isStable: false,
            currentPose: detectedPose,
            guidanceText: text,
            guidanceColor: color,
            stabilityProgress: 0,
            warning
          });

        } else {
          // No face detected
          stabilityStartTimeRef.current = null;
          stablePoseRef.current = null;
          setFaceState({
            isDetecting: true,
            hasFace: false,
            isCentered: false,
            isGoodSize: false,
            isStable: false,
            currentPose: null,
            guidanceText: 'Position your face in the frame',
            guidanceColor: 'slate',
            stabilityProgress: 0,
            warning: 'No face detected'
          });
        }
      }
    }

    requestRef.current = requestAnimationFrame(detectFace);
  }, [faceLandmarker, targetPose, onPoseStable]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(detectFace);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [detectFace]);

  return faceState;
}

function getPoseInstruction(pose: PoseType): string {
  switch (pose) {
    case 'straight': return 'Look straight at the camera';
    case 'left': return 'Turn your head to the LEFT';
    case 'right': return 'Turn your head to the RIGHT';
    case 'up': return 'Tilt your head UP';
    case 'down': return 'Tilt your head DOWN';
    default: return 'Follow the on-screen instructions';
  }
}
