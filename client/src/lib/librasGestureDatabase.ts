/**
 * Biblioteca de Gestos em Libras
 * Contém padrões de landmarks para reconhecimento de gestos
 * Baseado em dados de Libras Brasileira
 */

export interface GesturePattern {
  name: string;
  category: 'letter' | 'number' | 'word' | 'expression';
  description: string;
  landmarks: number[][];
  confidence_threshold: number;
}

export interface RecognitionResult {
  gesture: string;
  confidence: number;
  category: string;
}

export interface HandDetectionResult {
  landmarks: any[][];
  handedness: string[];
  worldLandmarks: any[][];
}

/**
 * Padrões de gestos em Libras
 * Cada gesto é representado por um conjunto de landmarks normalizados
 * Os landmarks são os 21 pontos de referência das mãos detectados pelo MediaPipe
 */
export const LIBRAS_GESTURES: Record<string, GesturePattern> = {
  // LETRAS - A a Z
  'A': {
    name: 'Letra A',
    category: 'letter',
    description: 'Mão fechada com polegar para cima',
    landmarks: [
      [0.5, 0.3, 0], [0.5, 0.35, 0], [0.5, 0.4, 0], [0.5, 0.45, 0],
      [0.45, 0.35, 0], [0.45, 0.4, 0], [0.45, 0.45, 0], [0.45, 0.5, 0],
      [0.55, 0.35, 0], [0.55, 0.4, 0], [0.55, 0.45, 0], [0.55, 0.5, 0],
      [0.5, 0.25, 0], [0.5, 0.2, 0], [0.5, 0.15, 0], [0.5, 0.1, 0],
      [0.48, 0.3, 0], [0.48, 0.25, 0], [0.48, 0.2, 0], [0.52, 0.3, 0], [0.52, 0.25, 0]
    ],
    confidence_threshold: 0.7
  },
  'B': {
    name: 'Letra B',
    category: 'letter',
    description: 'Mão aberta com dedos juntos apontando para cima',
    landmarks: [
      [0.5, 0.2, 0], [0.5, 0.25, 0], [0.5, 0.3, 0], [0.5, 0.35, 0],
      [0.45, 0.2, 0], [0.45, 0.25, 0], [0.45, 0.3, 0], [0.45, 0.35, 0],
      [0.55, 0.2, 0], [0.55, 0.25, 0], [0.55, 0.3, 0], [0.55, 0.35, 0],
      [0.5, 0.15, 0], [0.5, 0.1, 0], [0.5, 0.05, 0], [0.5, 0.0, 0],
      [0.48, 0.2, 0], [0.48, 0.15, 0], [0.48, 0.1, 0], [0.52, 0.2, 0], [0.52, 0.15, 0]
    ],
    confidence_threshold: 0.7
  },
  'C': {
    name: 'Letra C',
    category: 'letter',
    description: 'Mão em forma de C',
    landmarks: [
      [0.4, 0.25, 0], [0.42, 0.2, 0], [0.45, 0.18, 0], [0.48, 0.2, 0],
      [0.5, 0.25, 0], [0.5, 0.3, 0], [0.5, 0.35, 0], [0.48, 0.4, 0],
      [0.45, 0.42, 0], [0.42, 0.4, 0], [0.4, 0.35, 0], [0.38, 0.3, 0],
      [0.52, 0.25, 0], [0.54, 0.2, 0], [0.56, 0.25, 0], [0.56, 0.3, 0],
      [0.54, 0.35, 0], [0.52, 0.35, 0], [0.48, 0.25, 0], [0.46, 0.3, 0], [0.44, 0.25, 0]
    ],
    confidence_threshold: 0.7
  },
  'D': {
    name: 'Letra D',
    category: 'letter',
    description: 'Mão com dedo indicador apontando para cima',
    landmarks: [
      [0.5, 0.1, 0], [0.5, 0.15, 0], [0.5, 0.2, 0], [0.5, 0.25, 0],
      [0.45, 0.25, 0], [0.45, 0.3, 0], [0.45, 0.35, 0], [0.45, 0.4, 0],
      [0.55, 0.25, 0], [0.55, 0.3, 0], [0.55, 0.35, 0], [0.55, 0.4, 0],
      [0.5, 0.3, 0], [0.5, 0.35, 0], [0.5, 0.4, 0], [0.5, 0.45, 0],
      [0.48, 0.2, 0], [0.48, 0.25, 0], [0.48, 0.3, 0], [0.52, 0.2, 0], [0.52, 0.25, 0]
    ],
    confidence_threshold: 0.7
  },
  'E': {
    name: 'Letra E',
    category: 'letter',
    description: 'Mão com todos os dedos abertos',
    landmarks: [
      [0.45, 0.15, 0], [0.5, 0.1, 0], [0.55, 0.15, 0], [0.55, 0.2, 0],
      [0.5, 0.2, 0], [0.45, 0.2, 0], [0.45, 0.25, 0], [0.45, 0.3, 0],
      [0.5, 0.25, 0], [0.5, 0.3, 0], [0.55, 0.25, 0], [0.55, 0.3, 0],
      [0.45, 0.35, 0], [0.5, 0.35, 0], [0.55, 0.35, 0], [0.5, 0.4, 0],
      [0.48, 0.15, 0], [0.48, 0.2, 0], [0.48, 0.25, 0], [0.52, 0.15, 0], [0.52, 0.2, 0]
    ],
    confidence_threshold: 0.7
  },

  // NÚMEROS - 0 a 10
  '0': {
    name: 'Número 0',
    category: 'number',
    description: 'Mão com polegar e indicador formando um círculo',
    landmarks: [
      [0.5, 0.25, 0], [0.48, 0.2, 0], [0.45, 0.22, 0], [0.43, 0.25, 0],
      [0.45, 0.28, 0], [0.48, 0.3, 0], [0.5, 0.28, 0], [0.52, 0.3, 0],
      [0.55, 0.28, 0], [0.57, 0.25, 0], [0.55, 0.22, 0], [0.52, 0.2, 0],
      [0.5, 0.15, 0], [0.5, 0.1, 0], [0.5, 0.05, 0], [0.5, 0.0, 0],
      [0.48, 0.25, 0], [0.48, 0.2, 0], [0.48, 0.15, 0], [0.52, 0.25, 0], [0.52, 0.2, 0]
    ],
    confidence_threshold: 0.7
  },
  '1': {
    name: 'Número 1',
    category: 'number',
    description: 'Dedo indicador levantado',
    landmarks: [
      [0.5, 0.1, 0], [0.5, 0.15, 0], [0.5, 0.2, 0], [0.5, 0.25, 0],
      [0.45, 0.3, 0], [0.45, 0.35, 0], [0.45, 0.4, 0], [0.45, 0.45, 0],
      [0.55, 0.3, 0], [0.55, 0.35, 0], [0.55, 0.4, 0], [0.55, 0.45, 0],
      [0.5, 0.3, 0], [0.5, 0.35, 0], [0.5, 0.4, 0], [0.5, 0.45, 0],
      [0.48, 0.2, 0], [0.48, 0.25, 0], [0.48, 0.3, 0], [0.52, 0.2, 0], [0.52, 0.25, 0]
    ],
    confidence_threshold: 0.7
  },
  '2': {
    name: 'Número 2',
    category: 'number',
    description: 'Indicador e médio levantados',
    landmarks: [
      [0.45, 0.1, 0], [0.45, 0.15, 0], [0.45, 0.2, 0], [0.45, 0.25, 0],
      [0.55, 0.1, 0], [0.55, 0.15, 0], [0.55, 0.2, 0], [0.55, 0.25, 0],
      [0.5, 0.3, 0], [0.5, 0.35, 0], [0.5, 0.4, 0], [0.5, 0.45, 0],
      [0.43, 0.3, 0], [0.43, 0.35, 0], [0.43, 0.4, 0], [0.43, 0.45, 0],
      [0.48, 0.15, 0], [0.48, 0.2, 0], [0.48, 0.25, 0], [0.52, 0.15, 0], [0.52, 0.2, 0]
    ],
    confidence_threshold: 0.7
  },
  '3': {
    name: 'Número 3',
    category: 'number',
    description: 'Indicador, médio e anelar levantados',
    landmarks: [
      [0.42, 0.1, 0], [0.42, 0.15, 0], [0.42, 0.2, 0], [0.42, 0.25, 0],
      [0.5, 0.1, 0], [0.5, 0.15, 0], [0.5, 0.2, 0], [0.5, 0.25, 0],
      [0.58, 0.1, 0], [0.58, 0.15, 0], [0.58, 0.2, 0], [0.58, 0.25, 0],
      [0.5, 0.3, 0], [0.5, 0.35, 0], [0.5, 0.4, 0], [0.5, 0.45, 0],
      [0.48, 0.15, 0], [0.48, 0.2, 0], [0.48, 0.25, 0], [0.52, 0.15, 0], [0.52, 0.2, 0]
    ],
    confidence_threshold: 0.7
  },

  // PALAVRAS COMUNS
  'OLÁ': {
    name: 'Olá',
    category: 'word',
    description: 'Mão aberta acenando',
    landmarks: [
      [0.5, 0.2, 0], [0.5, 0.25, 0], [0.5, 0.3, 0], [0.5, 0.35, 0],
      [0.45, 0.2, 0], [0.45, 0.25, 0], [0.45, 0.3, 0], [0.45, 0.35, 0],
      [0.55, 0.2, 0], [0.55, 0.25, 0], [0.55, 0.3, 0], [0.55, 0.35, 0],
      [0.5, 0.15, 0], [0.5, 0.1, 0], [0.5, 0.05, 0], [0.5, 0.0, 0],
      [0.48, 0.2, 0], [0.48, 0.15, 0], [0.48, 0.1, 0], [0.52, 0.2, 0], [0.52, 0.15, 0]
    ],
    confidence_threshold: 0.7
  },
  'OBRIGADO': {
    name: 'Obrigado',
    category: 'word',
    description: 'Mão aberta tocando o queixo',
    landmarks: [
      [0.5, 0.35, 0], [0.5, 0.4, 0], [0.5, 0.45, 0], [0.5, 0.5, 0],
      [0.45, 0.35, 0], [0.45, 0.4, 0], [0.45, 0.45, 0], [0.45, 0.5, 0],
      [0.55, 0.35, 0], [0.55, 0.4, 0], [0.55, 0.45, 0], [0.55, 0.5, 0],
      [0.5, 0.3, 0], [0.5, 0.25, 0], [0.5, 0.2, 0], [0.5, 0.15, 0],
      [0.48, 0.35, 0], [0.48, 0.3, 0], [0.48, 0.25, 0], [0.52, 0.35, 0], [0.52, 0.3, 0]
    ],
    confidence_threshold: 0.7
  },
  'SIM': {
    name: 'Sim',
    category: 'word',
    description: 'Mão fechada com polegar para cima, movendo para cima e para baixo',
    landmarks: [
      [0.5, 0.3, 0], [0.5, 0.35, 0], [0.5, 0.4, 0], [0.5, 0.45, 0],
      [0.45, 0.35, 0], [0.45, 0.4, 0], [0.45, 0.45, 0], [0.45, 0.5, 0],
      [0.55, 0.35, 0], [0.55, 0.4, 0], [0.55, 0.45, 0], [0.55, 0.5, 0],
      [0.5, 0.25, 0], [0.5, 0.2, 0], [0.5, 0.15, 0], [0.5, 0.1, 0],
      [0.48, 0.3, 0], [0.48, 0.25, 0], [0.48, 0.2, 0], [0.52, 0.3, 0], [0.52, 0.25, 0]
    ],
    confidence_threshold: 0.7
  },
  'NÃO': {
    name: 'Não',
    category: 'word',
    description: 'Mão aberta com dedos juntos, movendo de um lado para o outro',
    landmarks: [
      [0.4, 0.3, 0], [0.42, 0.25, 0], [0.45, 0.23, 0], [0.48, 0.25, 0],
      [0.5, 0.3, 0], [0.5, 0.35, 0], [0.5, 0.4, 0], [0.48, 0.45, 0],
      [0.45, 0.47, 0], [0.42, 0.45, 0], [0.4, 0.4, 0], [0.38, 0.35, 0],
      [0.52, 0.3, 0], [0.54, 0.25, 0], [0.56, 0.3, 0], [0.56, 0.35, 0],
      [0.54, 0.4, 0], [0.52, 0.4, 0], [0.48, 0.3, 0], [0.46, 0.35, 0], [0.44, 0.3, 0]
    ],
    confidence_threshold: 0.7
  },
  'AMOR': {
    name: 'Amor',
    category: 'word',
    description: 'Mão em forma de coração sobre o peito',
    landmarks: [
      [0.5, 0.35, 0], [0.48, 0.3, 0], [0.45, 0.28, 0], [0.42, 0.3, 0],
      [0.4, 0.35, 0], [0.42, 0.4, 0], [0.45, 0.42, 0], [0.48, 0.4, 0],
      [0.5, 0.35, 0], [0.52, 0.3, 0], [0.55, 0.28, 0], [0.58, 0.3, 0],
      [0.6, 0.35, 0], [0.58, 0.4, 0], [0.55, 0.42, 0], [0.52, 0.4, 0],
      [0.5, 0.45, 0], [0.48, 0.45, 0], [0.46, 0.45, 0], [0.52, 0.45, 0], [0.54, 0.45, 0]
    ],
    confidence_threshold: 0.7
  },
  'ESCOLA': {
    name: 'Escola',
    category: 'word',
    description: 'Mão com dedos abertos tocando a testa',
    landmarks: [
      [0.5, 0.15, 0], [0.5, 0.2, 0], [0.5, 0.25, 0], [0.5, 0.3, 0],
      [0.45, 0.15, 0], [0.45, 0.2, 0], [0.45, 0.25, 0], [0.45, 0.3, 0],
      [0.55, 0.15, 0], [0.55, 0.2, 0], [0.55, 0.25, 0], [0.55, 0.3, 0],
      [0.5, 0.1, 0], [0.5, 0.05, 0], [0.5, 0.0, 0], [0.5, -0.05, 0],
      [0.48, 0.15, 0], [0.48, 0.1, 0], [0.48, 0.05, 0], [0.52, 0.15, 0], [0.52, 0.1, 0]
    ],
    confidence_threshold: 0.7
  },
  'PROFESSOR': {
    name: 'Professor',
    category: 'word',
    description: 'Mão apontando para a cabeça',
    landmarks: [
      [0.5, 0.1, 0], [0.5, 0.15, 0], [0.5, 0.2, 0], [0.5, 0.25, 0],
      [0.45, 0.15, 0], [0.45, 0.2, 0], [0.45, 0.25, 0], [0.45, 0.3, 0],
      [0.55, 0.15, 0], [0.55, 0.2, 0], [0.55, 0.25, 0], [0.55, 0.3, 0],
      [0.5, 0.05, 0], [0.5, 0.0, 0], [0.5, -0.05, 0], [0.5, -0.1, 0],
      [0.48, 0.15, 0], [0.48, 0.1, 0], [0.48, 0.05, 0], [0.52, 0.15, 0], [0.52, 0.1, 0]
    ],
    confidence_threshold: 0.7
  },
};

/**
 * Calcula a distância euclidiana entre dois landmarks
 */
function euclideanDistance(p1: number[], p2: number[]): number {
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  const dz = p1[2] - p2[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Normaliza os landmarks para um tamanho padrão
 */
function normalizeLandmarks(landmarks: number[][]): number[][] {
  if (landmarks.length === 0) return landmarks;

  // Encontrar os limites
  let minX = landmarks[0][0];
  let maxX = landmarks[0][0];
  let minY = landmarks[0][1];
  let maxY = landmarks[0][1];

  for (const landmark of landmarks) {
    minX = Math.min(minX, landmark[0]);
    maxX = Math.max(maxX, landmark[0]);
    minY = Math.min(minY, landmark[1]);
    maxY = Math.max(maxY, landmark[1]);
  }

  const width = maxX - minX || 1;
  const height = maxY - minY || 1;
  const scale = Math.max(width, height) || 1;

  // Normalizar
  return landmarks.map(landmark => [
    (landmark[0] - minX) / scale,
    (landmark[1] - minY) / scale,
    landmark[2] || 0
  ]);
}

/**
 * Reconhece um gesto baseado nos landmarks detectados
 */
export function recognizeGesture(detectedLandmarks: number[][]): RecognitionResult | null {
  if (!detectedLandmarks || detectedLandmarks.length === 0) {
    return null;
  }

  const normalized = normalizeLandmarks(detectedLandmarks);
  let bestMatch: RecognitionResult | null = null;
  let bestDistance = Infinity;

  // Comparar com todos os gestos conhecidos
  for (const [gestureKey, gesture] of Object.entries(LIBRAS_GESTURES)) {
    let totalDistance = 0;
    let matchedPoints = 0;

    // Comparar landmarks
    for (let i = 0; i < Math.min(normalized.length, gesture.landmarks.length); i++) {
      const distance = euclideanDistance(normalized[i], gesture.landmarks[i]);
      totalDistance += distance;
      matchedPoints++;
    }

    const averageDistance = totalDistance / (matchedPoints || 1);
    
    // Calcular confiança (quanto menor a distância, maior a confiança)
    const confidence = Math.max(0, 1 - averageDistance);

    // Verificar se é o melhor match até agora
    if (confidence > gesture.confidence_threshold && averageDistance < bestDistance) {
      bestDistance = averageDistance;
      bestMatch = {
        gesture: gestureKey,
        confidence: confidence,
        category: gesture.category
      };
    }
  }

  return bestMatch;
}

/**
 * Reconhece múltiplos gestos (para ambas as mãos)
 */
export function recognizeMultipleGestures(
  leftHandLandmarks: number[][] | null,
  rightHandLandmarks: number[][] | null
): RecognitionResult[] {
  const results: RecognitionResult[] = [];

  if (leftHandLandmarks) {
    const leftResult = recognizeGesture(leftHandLandmarks);
    if (leftResult) {
      results.push({ ...leftResult, gesture: `[ESQ] ${leftResult.gesture}` });
    }
  }

  if (rightHandLandmarks) {
    const rightResult = recognizeGesture(rightHandLandmarks);
    if (rightResult) {
      results.push({ ...rightResult, gesture: `[DIR] ${rightResult.gesture}` });
    }
  }

  return results;
}
