import { useEffect, useRef, useState, useCallback } from 'react';

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface HandDetection {
  landmarks: Landmark[];
  worldLandmarks: Landmark[];
  handedness: string;
  confidence: number;
}

export interface DetectionResult {
  hands: HandDetection[];
  timestamp: number;
}

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

export function useMediaPipeHands() {
  const [handLandmarker, setHandLandmarker] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const wasmRef = useRef<any>(null);

  useEffect(() => {
    const initializeHandLandmarker = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log('Inicializando MediaPipe Hands...');

        // Carregar dinamicamente
        const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');

        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        console.log('FilesetResolver carregado');

        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        console.log('✅ MediaPipe Hands carregado com sucesso');
        setHandLandmarker(landmarker);
        setIsInitialized(true);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao inicializar MediaPipe';
        console.error('Erro ao inicializar MediaPipe Hands:', err);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    initializeHandLandmarker();

    return () => {
      if (handLandmarker) {
        try {
          handLandmarker.close();
        } catch (err) {
          console.warn('Erro ao fechar HandLandmarker:', err);
        }
      }
    };
  }, []);

  const detectHands = useCallback(
    (video: HTMLVideoElement, timestamp: number): DetectionResult | null => {
      if (!handLandmarker || !video.videoWidth || !video.videoHeight) {
        return null;
      }

      try {
        const result = handLandmarker.detectForVideo(video, timestamp);

        if (!result.landmarks || result.landmarks.length === 0) {
          return {
            hands: [],
            timestamp,
          };
        }

        const hands: HandDetection[] = result.landmarks.map((landmarks: any, index: number) => {
          const handedness = result.handedness[index];
          const worldLandmarks = result.worldLandmarks[index];

          const confidences = landmarks.map((l: any) => l.visibility || 0.5);
          const confidence = confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length;

          return {
            landmarks: landmarks as Landmark[],
            worldLandmarks: worldLandmarks as Landmark[],
            handedness: (handedness as any).categoryName || 'Unknown',
            confidence,
          };
        });

        return {
          hands,
          timestamp,
        };
      } catch (err) {
        console.error('Erro ao detectar mãos:', err);
        return null;
      }
    },
    [handLandmarker]
  );

  const drawLandmarks = useCallback(
    (canvas: HTMLCanvasElement, detectionResult: DetectionResult, videoWidth: number, videoHeight: number) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = videoWidth;
      canvas.height = videoHeight;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      detectionResult.hands.forEach((hand) => {
        const color = hand.handedness === 'Right' ? '#FF6B6B' : '#4ECDC4';

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;

        HAND_CONNECTIONS.forEach(([start, end]) => {
          const startLandmark = hand.landmarks[start];
          const endLandmark = hand.landmarks[end];

          if (startLandmark && endLandmark) {
            ctx.beginPath();
            ctx.moveTo(startLandmark.x * canvas.width, startLandmark.y * canvas.height);
            ctx.lineTo(endLandmark.x * canvas.width, endLandmark.y * canvas.height);
            ctx.stroke();
          }
        });

        ctx.globalAlpha = 1;
        hand.landmarks.forEach((landmark, idx) => {
          const x = landmark.x * canvas.width;
          const y = landmark.y * canvas.height;
          const radius = idx === 0 ? 6 : 4;

          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, 2 * Math.PI);
          ctx.fill();

          ctx.strokeStyle = 'white';
          ctx.lineWidth = 1;
          ctx.stroke();
        });

        ctx.fillStyle = color;
        ctx.font = 'bold 16px Arial';
        ctx.globalAlpha = 0.8;
        const label = `${hand.handedness} (${Math.round(hand.confidence * 100)}%)`;
        const textX = hand.landmarks[0].x * canvas.width;
        const textY = hand.landmarks[0].y * canvas.height - 20;
        ctx.fillText(label, textX, textY);
      });

      ctx.globalAlpha = 1;
    },
    []
  );

  return {
    handLandmarker,
    isLoading,
    error,
    isInitialized,
    detectHands,
    drawLandmarks,
  };
}
