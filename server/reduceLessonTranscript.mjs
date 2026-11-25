const MAX_EVIDENCE_CHARS = 6000;
const STOP_WORDS = new Set(`
a ao aos aquela aquelas aquele aqueles aquilo as até com como da das de dela delas dele deles depois do dos e ela elas ele eles em entre era essa essas esse esses esta estas este estes eu foi foram há isso isto já lhe lhes mais mas me mesmo meu meus minha minhas muito na nas nem no nos nós nossa nossas nosso nossas num numa o os ou para pela pelas pelo pelos por qual quando que quem se sem ser seu seus sua suas também te tem tendo ter teu teus tua tuas um uma umas uns você vocês é são está estão estava pelo pelos
falar falas falou dizer disse sendo fazer fez pode podem poderá aula aulas conteúdo professor professores aluno alunos texto transcrição transcricao legenda legendas turma hoje então assim sobre parte coisa coisas gente aqui agora exemplo exemplos pergunta perguntas resposta respostas
`.trim().split(/\s+/));

const WORD_PATTERN = /[\p{L}\p{N}]{3,}/gu;
const SENTENCE_PATTERN = /(?<=[.!?])\s+|\n+/u;

function wordsIn(text) {
  return [...text.toLocaleLowerCase('pt-BR').matchAll(WORD_PATTERN)]
    .map(match => match[0])
    .filter(word => !STOP_WORDS.has(word) && !/^\d+$/.test(word));
}

function splitSentences(captions) {
  const result = [];
  const seen = new Set();
  for (const caption of captions) {
    for (const part of caption.split(SENTENCE_PATTERN)) {
      const sentence = part.replace(/\s+/g, ' ').trim();
      const normalized = sentence.toLocaleLowerCase('pt-BR');
      if (sentence.length < 20 || seen.has(normalized)) continue;
      result.push(sentence);
      seen.add(normalized);
    }
  }
  return result.length ? result : captions.map(caption => caption.trim()).filter(Boolean);
}

/** Reduz a transcrição sem modelo: palavras-chave e trechos diversos com contexto. */
export function reduceLessonTranscript(captions) {
  const sentences = splitSentences(captions);
  const counts = new Map();
  const documentFrequency = new Map();
  const sentenceTerms = sentences.map(sentence => {
    const words = wordsIn(sentence);
    const unique = new Set(words);
    for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
    for (const word of unique) documentFrequency.set(word, (documentFrequency.get(word) ?? 0) + 1);
    return { words, unique };
  });

  const weights = new Map([...counts].map(([word, count]) => {
    const idf = 1 + Math.log((sentences.length + 1) / ((documentFrequency.get(word) ?? 0) + 1));
    return [word, (1 + Math.log(count)) * idf];
  }));
  const keywords = [...weights]
    .sort((a, b) => b[1] - a[1] || (counts.get(b[0]) ?? 0) - (counts.get(a[0]) ?? 0))
    .slice(0, 14)
    .map(([word]) => sentences.map(sentence => sentence.match(WORD_PATTERN)?.find(token => token.toLocaleLowerCase('pt-BR') === word)).find(Boolean) ?? word);

  const items = sentences.map((sentence, index) => {
    const terms = sentenceTerms[index];
    const termWeight = [...terms.words].reduce((sum, word) => sum + (weights.get(word) ?? 0), 0);
    const base = termWeight / Math.sqrt(Math.max(1, terms.words.length));
    return { sentence, index, terms: terms.unique, score: base };
  });

  const selected = [];
  const covered = new Set();
  let charCount = 0;
  const remaining = [...items];
  while (remaining.length && charCount < MAX_EVIDENCE_CHARS) {
    let bestIndex = 0;
    let bestScore = -1;
    for (let index = 0; index < remaining.length; index++) {
      const item = remaining[index];
      let novelty = 0;
      for (const word of item.terms) if (!covered.has(word)) novelty += weights.get(word) ?? 0;
      const score = (novelty + item.score * 0.15) / Math.sqrt(Math.max(1, item.sentence.length));
      if (score > bestScore) { bestIndex = index; bestScore = score; }
    }
    const [item] = remaining.splice(bestIndex, 1);
    if (charCount && charCount + item.sentence.length + 1 > MAX_EVIDENCE_CHARS) continue;
    selected.push(item);
    charCount += item.sentence.length + 1;
    for (const word of item.terms) covered.add(word);
  }

  const evidence = selected.sort((a, b) => a.index - b.index).map(item => item.sentence).join('\n');
  return {
    keywords,
    evidence,
    originalChars: captions.reduce((sum, caption) => sum + caption.length, 0),
    reducedChars: keywords.join(', ').length + evidence.length,
  };
}
