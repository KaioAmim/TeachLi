/**
 * Interpretação de expressões faciais gramaticais da Libras a partir dos
 * blendshapes do MediaPipe Face Landmarker e da pose da cabeça.
 *
 * São heurísticas com limiares fixos, ainda não calibradas com dados de
 * sinalizantes — servem como apoio e podem ser ajustadas nas constantes abaixo.
 */

export type FacialExpression = "pergunta" | "duvida" | "surpresa" | "negacao" | "certeza";

export interface FaceObservation {
  blendshapes: Record<string, number>;
  /** Matriz 4x4 (column-major) da pose da cabeça, quando disponível. */
  matrix: number[] | null;
}

export const EXPRESSION_LABELS: Record<FacialExpression, string> = {
  pergunta: "Pergunta",
  duvida: "Dúvida",
  surpresa: "Surpresa / ênfase",
  negacao: "Negação",
  certeza: "Certeza",
};

/** Como cada expressão aparece na mensagem enviada ao professor. */
export const EXPRESSION_MARKS: Record<FacialExpression, string> = {
  pergunta: "?",
  duvida: "(dúvida)",
  surpresa: "!",
  negacao: "(negação)",
  certeza: "(certeza)",
};

const avg = (shapes: Record<string, number>, a: string, b: string) =>
  ((shapes[a] ?? 0) + (shapes[b] ?? 0)) / 2;

export interface ExpressionReading {
  /** Expressão predominante neste quadro (só pelo rosto parado). */
  expression: FacialExpression | null;
  /** 0..1 — intensidade do traço que decidiu a expressão. */
  intensity: number;
}

/**
 * - Sobrancelhas erguidas → pergunta (sim/não); com olhos arregalados ou boca
 *   aberta → surpresa/ênfase.
 * - Sobrancelhas franzidas → dúvida (perguntas com "o quê/quem"); com cantos da
 *   boca para baixo → negação.
 */
export function readExpression(shapes: Record<string, number>): ExpressionReading {
  const browUp = Math.max(shapes.browInnerUp ?? 0, avg(shapes, "browOuterUpLeft", "browOuterUpRight"));
  const browDown = avg(shapes, "browDownLeft", "browDownRight");
  const eyeWide = avg(shapes, "eyeWideLeft", "eyeWideRight");
  const frown = avg(shapes, "mouthFrownLeft", "mouthFrownRight");
  const jawOpen = shapes.jawOpen ?? 0;

  if (browUp > 0.5 && (eyeWide > 0.3 || jawOpen > 0.35)) return { expression: "surpresa", intensity: browUp };
  if (browUp > 0.45) return { expression: "pergunta", intensity: browUp };
  if (browDown > 0.3 && frown > 0.3) return { expression: "negacao", intensity: browDown };
  if (browDown > 0.35) return { expression: "duvida", intensity: browDown };
  return { expression: null, intensity: 0 };
}

const toDegrees = 180 / Math.PI;

/** Ângulos (graus) de inclinação e giro da cabeça a partir da matriz 4x4 column-major. */
export function headAngles(matrix: number[]): { pitch: number; yaw: number } {
  const pitch = Math.atan2(-matrix[9], matrix[10]) * toDegrees;
  const yaw = Math.asin(Math.max(-1, Math.min(1, matrix[8]))) * toDegrees;
  return { pitch, yaw };
}

/** Conta inversões de direção com amplitude mínima (histerese) numa série de ângulos. */
function countReversals(series: number[], minSwing: number): number {
  if (series.length < 3) return 0;
  let direction = 0;
  let extreme = series[0];
  let reversals = 0;
  for (const value of series) {
    if (direction >= 0 && value > extreme) extreme = value;
    if (direction <= 0 && value < extreme) extreme = value;
    if (direction >= 0 && extreme - value >= minSwing) {
      if (direction === 1) reversals += 1;
      direction = -1;
      extreme = value;
    } else if (direction <= 0 && value - extreme >= minSwing) {
      if (direction === -1) reversals += 1;
      direction = 1;
      extreme = value;
    }
  }
  return reversals;
}

/**
 * Detecta aceno vertical (sim → "certeza") e giro lateral (não → "negação")
 * numa janela deslizante de quadros recentes.
 */
export class HeadMotionDetector {
  private pitch: number[] = [];
  private yaw: number[] = [];

  constructor(
    private readonly windowSize = 20,
    private readonly minSwingDegrees = 5,
    private readonly minReversals = 2,
  ) {}

  push(matrix: number[]): "nod" | "shake" | null {
    const angles = headAngles(matrix);
    this.pitch.push(angles.pitch);
    this.yaw.push(angles.yaw);
    if (this.pitch.length > this.windowSize) {
      this.pitch.shift();
      this.yaw.shift();
    }
    if (this.pitch.length < this.windowSize / 2) return null;

    const nods = countReversals(this.pitch, this.minSwingDegrees);
    const shakes = countReversals(this.yaw, this.minSwingDegrees);
    if (nods >= this.minReversals && nods > shakes) return this.fire("nod");
    if (shakes >= this.minReversals && shakes > nods) return this.fire("shake");
    return null;
  }

  reset() {
    this.pitch = [];
    this.yaw = [];
  }

  private fire(kind: "nod" | "shake") {
    this.reset();
    return kind;
  }
}

/** Aplica uma expressão ao rascunho: pontuação grudada na palavra, ou marca entre parênteses. */
export function applyExpressionToText(text: string, expression: FacialExpression): string {
  const mark = EXPRESSION_MARKS[expression];
  const trimmed = text.replace(/\s+$/, "");
  if (!trimmed || trimmed.endsWith(mark)) return text;
  return mark.length === 1 ? `${trimmed}${mark} ` : `${trimmed} ${mark} `;
}
