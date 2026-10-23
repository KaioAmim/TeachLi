import type { RawLandmark } from "./handFeatures";

export interface HandDetectionResult {
  /** Um array de 21 landmarks por mão detectada, em coordenadas normalizadas. */
  landmarks: RawLandmark[][];
  /** "Left" / "Right" por mão, na mesma ordem de `landmarks`. */
  handedness: string[];
}

/**
 * Rótulos A–Z do modelo experimental de poses. H/J/K/X/Z são avaliados pela
 * pose, sem validar o movimento completo. Ç não possui amostras nessa base.
 * Ver docs/TREINAMENTO_ALFABETO.md.
 */
export const ALPHABET_LABELS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
] as const;
