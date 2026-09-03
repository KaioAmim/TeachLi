import { useEffect, useRef, useState, useCallback } from "react";
import { loadClassifier, type LoadedClassifier } from "@/lib/gestureClassifier";
import { landmarksToFeatures, type RawLandmark } from "@/lib/handFeatures";

export interface GesturePrediction {
  label: string;
  confidence: number;
}

/**
 * Carrega o classificador de gestos ativo — o modelo treinado pelo usuário
 * (IndexedDB) ou, na ausência dele, o modelo base servido em /models — e
 * expõe uma função de predição em tempo real a partir dos landmarks.
 */
export function useGestureClassifier() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasModel, setHasModel] = useState(false);
  const [labels, setLabels] = useState<string[]>([]);
  const [source, setSource] = useState<LoadedClassifier["source"] | null>(null);
  const classifierRef = useRef<LoadedClassifier | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadClassifier()
      .then(classifier => {
        if (cancelled) {
          classifier?.dispose();
          return;
        }
        classifierRef.current = classifier;
        setHasModel(classifier !== null);
        setLabels(classifier?.labels ?? []);
        setSource(classifier?.source ?? null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      classifierRef.current?.dispose();
      classifierRef.current = null;
    };
  }, []);

  const predict = useCallback((landmarks: RawLandmark[]): GesturePrediction | null => {
    const classifier = classifierRef.current;
    if (!classifier) return null;

    const features = landmarksToFeatures(landmarks);
    const { label, confidence } = classifier.predict(features);
    return { label, confidence };
  }, []);

  return { isLoading, hasModel, labels, source, predict };
}
