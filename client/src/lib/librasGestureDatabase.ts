import type { RawLandmark } from "./handFeatures";

export interface HandDetectionResult {
  /** Um array de 21 landmarks por mão detectada, em coordenadas normalizadas. */
  landmarks: RawLandmark[][];
  /** "Left" / "Right" por mão, na mesma ordem de `landmarks`. */
  handedness: string[];
}

/**
 * Letras estáticas cobertas pelo modelo base. H, J, K, X, Y e Z envolvem
 * movimento e não estão no dataset — ver docs/MODELO.md.
 */
export const ALPHABET_LABELS = [
  "A", "B", "C", "D", "E", "I", "L", "M", "N", "O", "R", "S", "U", "V", "W",
] as const;
