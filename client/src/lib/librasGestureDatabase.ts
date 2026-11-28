import type { RawLandmark } from "./handFeatures";

export interface HandDetectionResult {
  /** Um array de 21 landmarks por mão detectada, em coordenadas normalizadas. */
  landmarks: RawLandmark[][];
  /** "Left" / "Right" por mão, na mesma ordem de `landmarks`. */
  handedness: string[];
}
