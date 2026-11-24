import type { RoomMessage } from "@/contexts/ClassroomContext";

const STOP_WORDS = new Set(
  "a as o os um uma uns umas de do da dos das em no na nos nas para por com sem ao aos a as e ou mas se que como mais menos muito muita muitos muitas ja tambem ainda entao porque quando onde qual quais este esta isso sobre entre ate depois antes aula hoje aqui gente coisa coisas fazer ser ter estar foi sao era foram tem tinha vai vao pode podem deve devem ele ela eles elas nosso nossa seu sua pelo pela pelos pelas".split(" "),
);
const MAX_SUMMARY_SENTENCES = 5;

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function splitSentences(captions: RoomMessage[]) {
  const seen = new Set<string>();
  const sentences: string[] = [];
  for (const caption of captions) {
    const parts = caption.text.match(/[^.!?]+[.!?]?/g) ?? [];
    for (const part of parts) {
      const sentence = part.replace(/\s+/g, " ").trim();
      const key = normalize(sentence).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      sentences.push(sentence);
    }
  }
  return sentences;
}

/** Picks representative sentences from the class captions without adding claims. */
export function summarizeLesson(captions: RoomMessage[]): string[] {
  const sentences = splitSentences(captions);
  if (sentences.length === 0) return [];
  const termsBySentence = sentences.map(sentence =>
    normalize(sentence).match(/[\p{L}\p{N}]{3,}/gu)?.filter(term => !STOP_WORDS.has(term)) ?? [],
  );
  const frequency = new Map<string, number>();
  for (const terms of termsBySentence) {
    for (const term of new Set(terms)) frequency.set(term, (frequency.get(term) ?? 0) + 1);
  }
  const ranked = sentences.map((sentence, index) => {
    const terms = termsBySentence[index];
    const lexicalScore = terms.reduce((score, term) => score + Math.log1p(frequency.get(term) ?? 0), 0);
    const lengthPenalty = Math.sqrt(Math.max(terms.length, 1));
    const positionBonus = index === 0 ? 0.25 : 0;
    return { sentence, index, score: lexicalScore / lengthPenalty + positionBonus };
  });
  const selected = [...ranked]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SUMMARY_SENTENCES)
    .sort((a, b) => a.index - b.index);
  return selected.map(item => item.sentence);
}
