import { useEffect, useRef, useState } from 'react';

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface HandDetectionResult {
  landmarks: HandLandmark[][];
  handedness: string[];
  worldLandmarks: HandLandmark[][];
}

const MODEL_URLS = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm/hand_landmarker.task',
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.13/wasm/hand_landmarker.task', // Versão estável anterior
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm/hand_landmarker.task',
];

export function useHandLandmarker() {
  const [handLandmarker, setHandLandmarker] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadAttemptRef = useRef(0);

  useEffect(() => {
    const initializeHandLandmarker = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log('Inicializando MediaPipe Hands...');
        
        // Importar dinamicamente
        const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');

        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        console.log('FilesetResolver carregado');

        let landmarker: any = null;
        let lastError: Error | null = null;

        // Tentar cada URL em sequência
        for (const modelUrl of MODEL_URLS) {
          try {
            console.log(`Tentando carregar modelo de: ${modelUrl}`);
            
            landmarker = await HandLandmarker.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: modelUrl,
              },
              runningMode: 'VIDEO',
              numHands: 2,
              minHandDetectionConfidence: 0.5,
              minHandPresenceConfidence: 0.5,
              minTrackingConfidence: 0.5,
            });

            console.log(`✅ Modelo carregado com sucesso de: ${modelUrl}`);
            break;
          } catch (err) {
            lastError = err as Error;
            console.warn(`❌ Falha ao carregar de ${modelUrl}: ${(err as Error).message}`);
            continue;
          }
        }

        if (!landmarker) {
          throw new Error(
            `Falha ao carregar modelo MediaPipe de todas as URLs. Último erro: ${lastError?.message}`
          );
        }

        setHandLandmarker(landmarker);
        setError(null);
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

  const detectHands = (video: HTMLVideoElement, timestamp: number): HandDetectionResult | null => {
    if (!handLandmarker) return null;

    try {
      const result = handLandmarker.detectForVideo(video, timestamp);
      
      if (!result.landmarks || result.landmarks.length === 0) {
        return null;
      }

      return {
        landmarks: result.landmarks,
        handedness: result.handedness.map((h: any) => h.categoryName || 'Unknown'),
        worldLandmarks: result.worldLandmarks,
      };
    } catch (err) {
      console.error('Erro ao detectar mãos:', err);
      return null;
    }
  };

  return {
    handLandmarker,
    isLoading,
    error,
    detectHands,
  };
}
