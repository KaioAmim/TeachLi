import { useEffect, useRef, useState, useCallback } from "react";
import {
  loadDynamicClassifier,
  type DynamicPrediction,
  type DynamicSource,
  type LoadedDynamicClassifier,
} from "@/lib/dynamicGestureClassifier";

export type DynamicGesturePrediction = DynamicPrediction;

/**
 * Carrega o classificador de sinais dinâmicos (sequência de quadros) salvo
 * pelo usuário no IndexedDB, análogo a useGestureClassifier mas operando
 * sobre um clipe inteiro em vez de um quadro isolado. Carrega junto o modelo
 * base pré-treinado: um modelo pessoal não desliga os sinais do base.
 */
export function useDynamicGestureClassifier() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasModel, setHasModel] = useState(false);
  const [labels, setLabels] = useState<string[]>([]);
  const [sources, setSources] = useState<DynamicSource[]>([]);
  const classifierRef = useRef<LoadedDynamicClassifier | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadDynamicClassifier()
      .then(classifier => {
        if (cancelled) {
          classifier?.dispose();
          return;
        }
        classifierRef.current = classifier;
        setHasModel(classifier !== null);
        setLabels(classifier?.labels ?? []);
        setSources(classifier?.sources ?? []);
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

  const predict = useCallback((frames: Float32Array[]): DynamicGesturePrediction | null => {
    const classifier = classifierRef.current;
    if (!classifier || frames.length === 0) return null;
    return classifier.predict(frames);
  }, []);

  return { isLoading, hasModel, labels, sources, predict };
}
