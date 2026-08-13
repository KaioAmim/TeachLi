/**
 * Extração de features a partir dos 21 landmarks de uma mão (MediaPipe
 * HandLandmarker) para uso em classificação por ML.
 */

export interface RawLandmark {
  x: number;
  y: number;
  z: number;
}

export const NUM_LANDMARKS = 21;
export const FEATURE_SIZE = NUM_LANDMARKS * 3;

const WRIST = 0;
const MIDDLE_FINGER_MCP = 9;

/**
 * Normaliza os landmarks de uma mão para ficarem invariantes a posição e
 * escala: translada para a origem no pulso e divide pela distância
 * pulso -> base do dedo médio (uma referência estável de "tamanho da mão").
 * Retorna um vetor plano de 63 números (21 pontos x [x, y, z]).
 */
export function landmarksToFeatures(landmarks: RawLandmark[]): Float32Array {
  const features = new Float32Array(FEATURE_SIZE);
  if (!landmarks || landmarks.length < NUM_LANDMARKS) {
    return features;
  }

  const wrist = landmarks[WRIST];
  const ref = landmarks[MIDDLE_FINGER_MCP];
  const scale = Math.hypot(ref.x - wrist.x, ref.y - wrist.y, ref.z - wrist.z) || 1;

  for (let i = 0; i < NUM_LANDMARKS; i++) {
    const point = landmarks[i];
    features[i * 3] = (point.x - wrist.x) / scale;
    features[i * 3 + 1] = (point.y - wrist.y) / scale;
    features[i * 3 + 2] = (point.z - wrist.z) / scale;
  }

  return features;
}
