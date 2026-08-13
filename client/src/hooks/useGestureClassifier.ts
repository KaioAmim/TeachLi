import { useEffect, useRef, useState, useCallback } from "react";
import { loadClassifier, type LoadedClassifier } from "@/lib/gestureClassifier";
import { landmarksToFeatures, type RawLandmark } from "@/lib/handFeatures";

export interface GesturePrediction {
  label: string;
  confidence: number;
}

/**
 * Carrega o classificador de gestos treinado (TensorFlow.js, salvo no
 * IndexedDB pelo fluxo de treinamento) e expõe uma função de predição em
 * tempo real a partir dos landmarks de uma mão.
 */
export function useGestureClassifier() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasModel, setHasModel] = useState(false);
  const classifierRef = useRef<LoadedClassifier | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadClassifier()
      .then(classifier => {
        if (cancelled) return;
        classifierRef.current = classifier;
        setHasModel(classifier !== null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      classifierRef.current?.dispose();
    };
  }, []);

  const predict = useCallback((landmarks: RawLandmark[]): GesturePrediction | null => {
    const classifier = classifierRef.current;
    if (!classifier) return null;

    const features = landmarksToFeatures(landmarks);
    const { label, confidence } = classifier.predict(features);
    return { label, confidence };
  }, []);

  return { isLoading, hasModel, predict };
}
