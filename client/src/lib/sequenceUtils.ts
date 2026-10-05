/**
 * Utilidades para lidar com clipes de sinais dinâmicos: sequências de
 * vetores de features (um por quadro), de comprimento variável — pois um
 * sinal pode ser feito mais rápido ou mais devagar de uma gravação para
 * outra.
 */

/**
 * Reamostra uma sequência de quadros para um comprimento fixo, por
 * interpolação linear entre os quadros vizinhos no tempo normalizado
 * (0..1 do clipe inteiro).
 *
 * Por que interpolar em vez de truncar/preencher com zero: truncar corta o
 * fim do movimento, e preencher com zero criaria um "salto" artificial que
 * não corresponde a nenhum movimento real. Reamostrar preserva a forma
 * inteira da trajetória, só reamostrando sua duração — o mesmo raciocínio
 * usado no augmentation de variação de velocidade.
 */
export function resampleSequence(frames: Float32Array[], targetLength: number): Float32Array[] {
  if (frames.length === 0) return [];
  const featureSize = frames[0].length;
  const out: Float32Array[] = new Array(targetLength);
  for (let i = 0; i < targetLength; i++) {
    const t = frames.length === 1 ? 0 : (i / (targetLength - 1)) * (frames.length - 1);
    const lo = Math.floor(t);
    const hi = Math.min(lo + 1, frames.length - 1);
    const frac = t - lo;
    const frame = new Float32Array(featureSize);
    const a = frames[lo];
    const b = frames[hi];
    for (let f = 0; f < featureSize; f++) {
      frame[f] = a[f] * (1 - frac) + b[f] * frac;
    }
    out[i] = frame;
  }
  return out;
}

/** Converte uma sequência de Float32Array em number[][] simples, pronto para JSON/tensor. */
export function sequenceToArray(frames: Float32Array[]): number[][] {
  return frames.map(f => Array.from(f));
}
