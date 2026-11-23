export interface RawLandmark {
  x: number;
  y: number;
  z: number;
}

/** 21 landmarks × (x, y, z), para uma mão. */
export const FEATURE_SIZE = 63;

/**
 * Duas mãos concatenadas em slots fixos [ESQUERDA(66), DIREITA(66)].
 * Cada slot guarda 63 coordenadas de pose e 3 da posição do pulso no quadro.
 * Usado pelos sinais dinâmicos, onde a coordenação entre as duas mãos
 * pode fazer parte do sinal — o classificador estático de um quadro só
 * usa FEATURE_SIZE (uma mão) e continua funcionando como antes.
 */
/** 63 coordenadas normalizadas por mão + posição do pulso no quadro. */
export const HAND_SEQUENCE_FEATURE_SIZE = FEATURE_SIZE + 3;
export const TWO_HAND_FEATURE_SIZE = HAND_SEQUENCE_FEATURE_SIZE * 2;

const WRIST = 0;
const MIDDLE_FINGER_MCP = 9;

/**
 * Normaliza os landmarks de uma mão para o vetor que o classificador espera:
 * pulso na origem e escala pela distância pulso → base do dedo médio, o que
 * torna o vetor invariante à posição e ao tamanho da mão no quadro.
 *
 * Esta função é a mesma usada na extração offline do dataset — qualquer
 * mudança aqui invalida o modelo base em /models/gesture-classifier.
 */
export function landmarksToFeatures(landmarks: RawLandmark[]): Float32Array {
  const features = new Float32Array(FEATURE_SIZE);
  const wrist = landmarks[WRIST];
  const middleBase = landmarks[MIDDLE_FINGER_MCP];

  const scale =
    Math.hypot(middleBase.x - wrist.x, middleBase.y - wrist.y, middleBase.z - wrist.z) || 1;

  for (let i = 0; i < landmarks.length; i++) {
    features[i * 3] = (landmarks[i].x - wrist.x) / scale;
    features[i * 3 + 1] = (landmarks[i].y - wrist.y) / scale;
    features[i * 3 + 2] = (landmarks[i].z - wrist.z) / scale;
  }

  return features;
}

/** Forma mínima que twoHandLandmarksToFeatures precisa — compatível com
 * HandDetectionResult (librasGestureDatabase.ts) sem precisar importá-lo
 * (evitaria um ciclo de módulos). */
export interface HandsFrame {
  landmarks: RawLandmark[][];
  handedness: string[];
}

/**
 * Combina as mãos detectadas num quadro num único vetor de 126 valores, em
 * slots fixos por lateralidade. Diferente do classificador estático (que só
 * olha para uma mão isolada), sinais dinâmicos com as duas mãos precisam
 * saber qual landmark pertence a qual mão de forma consistente quadro a
 * quadro — daí os slots fixos em vez de simplesmente concatenar na ordem em
 * que o MediaPipe devolveu.
 *
 * Quando uma mão não aparece no quadro, o slot dela fica zerado: zero é um
 * estado distinto de qualquer pose real (que nunca fica exatamente na
 * origem), então o modelo consegue aprender "esta mão não está em uso aqui"
 * em vez de herdar por engano a última posição conhecida.
 */
export function twoHandLandmarksToFeatures(frame: HandsFrame): Float32Array {
  const out = new Float32Array(TWO_HAND_FEATURE_SIZE);
  frame.landmarks.forEach((lms, i) => {
    const handed = frame.handedness[i];
    const offset = handed === "Left" ? 0 : HAND_SEQUENCE_FEATURE_SIZE;
    out.set(landmarksToFeatures(lms), offset);
    // A normalização local da mão preserva a pose, mas remove deslocamentos
    // pelo espaço. Guardamos também o pulso em coordenadas do quadro para
    // que o modelo temporal possa aprender trajetórias e pontos de articulação.
    out[offset + FEATURE_SIZE] = lms[0].x * 2 - 1;
    out[offset + FEATURE_SIZE + 1] = lms[0].y * 2 - 1;
    out[offset + FEATURE_SIZE + 2] = lms[0].z;
  });
  return out;
}
