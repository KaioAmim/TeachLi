import { useCallback, useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import type { FaceObservation } from "@/lib/facialExpression";

/** Mesmo runtime wasm e mesma origem de modelos do useHandLandmarker. */
const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

/** Singleton por sessão — ver a justificativa em useHandLandmarker. */
let landmarkerPromise: Promise<FaceLandmarker> | null = null;
let lastTimestamp = -1;

async function createLandmarker(): Promise<FaceLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
  const options = {
    baseOptions: { modelAssetPath: MODEL_PATH },
    runningMode: "VIDEO" as const,
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  };

  try {
    return await FaceLandmarker.createFromOptions(vision, {
      ...options,
      baseOptions: { ...options.baseOptions, delegate: "GPU" },
    });
  } catch {
    return FaceLandmarker.createFromOptions(vision, {
      ...options,
      baseOptions: { ...options.baseOptions, delegate: "CPU" },
    });
  }
}

function warmUp(landmarker: FaceLandmarker) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    lastTimestamp = Math.max(lastTimestamp, performance.now());
    landmarker.detectForVideo(canvas, lastTimestamp);
  } catch {
    // aquecimento é só otimização
  }
}

function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = createLandmarker().then(landmarker => {
      warmUp(landmarker);
      return landmarker;
    }).catch(err => {
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

/**
 * Carrega o FaceLandmarker (blendshapes + pose da cabeça). Só carrega quando
 * `enabled` é verdadeiro, para não pesar quem desliga as expressões. Uma
 * falha aqui nunca afeta o reconhecimento das mãos.
 */
export function useFaceLandmarker(enabled: boolean) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setIsLoading(true);
    // Adia a carga do rosto: assim ela não disputa a CPU com o modelo das mãos e os
    // classificadores, que são o que a tela precisa primeiro.
    const timer = setTimeout(() => {
      getLandmarker()
        .then(landmarker => {
          if (cancelled) return;
          landmarkerRef.current = landmarker;
          setIsReady(true);
        })
        .catch(err => {
          if (!cancelled) setError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled]);

  const detectFace = useCallback((video: HTMLVideoElement, timestamp: number): FaceObservation | null => {
    const landmarker = landmarkerRef.current;
    if (!landmarker) return null;
    if (timestamp <= lastTimestamp) return null;
    lastTimestamp = timestamp;

    const result = landmarker.detectForVideo(video, timestamp);
    const categories = result.faceBlendshapes?.[0]?.categories;
    if (!categories) return null;

    const blendshapes: Record<string, number> = {};
    for (const category of categories) blendshapes[category.categoryName] = category.score;
    const matrix = result.facialTransformationMatrixes?.[0]?.data;
    return { blendshapes, matrix: matrix ? Array.from(matrix) : null };
  }, []);

  return { isReady, isLoading, error, detectFace };
}
