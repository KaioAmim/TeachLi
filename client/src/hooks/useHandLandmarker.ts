import { useCallback, useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { HandDetectionResult } from "@/lib/librasGestureDatabase";

/** Servido de public/mediapipe/wasm, na mesma versão do pacote npm. */
const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

/**
 * O landmarker é criado uma única vez por sessão e nunca fechado.
 *
 * Instanciar o grafo do MediaPipe custa segundos e o StrictMode monta cada
 * efeito duas vezes em dev — sem este singleton, a limpeza da primeira montagem
 * podia fechar justamente o grafo que ficava no estado, e aí todo
 * detectForVideo posterior falhava sem sinal visível.
 */
let landmarkerPromise: Promise<HandLandmarker> | null = null;

/** detectForVideo exige timestamps crescentes; o relógio é global à instância. */
let lastTimestamp = -1;

async function createLandmarker(): Promise<HandLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
  const options = {
    baseOptions: { modelAssetPath: MODEL_PATH },
    runningMode: "VIDEO" as const,
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  };

  try {
    return await HandLandmarker.createFromOptions(vision, {
      ...options,
      baseOptions: { ...options.baseOptions, delegate: "GPU" },
    });
  } catch {
    // Placas/drivers sem WebGL utilizável ainda rodam bem na CPU.
    return HandLandmarker.createFromOptions(vision, {
      ...options,
      baseOptions: { ...options.baseOptions, delegate: "CPU" },
    });
  }
}

function getLandmarker(): Promise<HandLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = createLandmarker().catch(err => {
      landmarkerPromise = null; // permite nova tentativa numa próxima montagem
      throw err;
    });
  }
  return landmarkerPromise;
}

/**
 * Carrega o HandLandmarker do MediaPipe em modo VIDEO e expõe uma função de
 * detecção quadro a quadro.
 */
export function useHandLandmarker() {
  const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);

  useEffect(() => {
    let cancelled = false;

    getLandmarker()
      .then(landmarker => {
        if (cancelled) return;
        landmarkerRef.current = landmarker;
        setHandLandmarker(landmarker);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const detectHands = useCallback(
    (video: HTMLVideoElement, timestamp: number): HandDetectionResult | null => {
      const landmarker = landmarkerRef.current;
      if (!landmarker) return null;

      if (timestamp <= lastTimestamp) return null;
      lastTimestamp = timestamp;

      const result = landmarker.detectForVideo(video, timestamp);
      return {
        landmarks: result.landmarks as HandDetectionResult["landmarks"],
        handedness: result.handedness.map(categories => categories[0]?.categoryName ?? ""),
      };
    },
    []
  );

  return { handLandmarker, isLoading, error, detectHands };
}
