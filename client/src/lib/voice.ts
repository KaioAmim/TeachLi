import { classroomAudio } from "@/lib/classroomApi";
import { loadMicrosoftSession } from "@/lib/microsoftAuth";

/**
 * Voz da leitura em voz alta. Escolhe a voz pt-BR mais natural disponível (vozes "Natural"/"Neural"/"Online"
 * do Edge e do Windows, Google, Apple) e respeita a preferência masculina/feminina do aluno.
 */

export type VoiceGender = "feminina" | "masculina";

const STORAGE_KEY = "teachli.voiceGender";
const EVENT = "teachli:voice-gender";

const FEMALE = /francisca|thalita|maria|luciana|vit[oó]ria|camila|fernanda|raquel|joana|let[ií]cia|isabela|giovanna|yara|brenda|elza|manuela|leila|google portugu[eê]s|female|feminina/i;
const MALE = /antonio|ant[oô]nio|daniel|felipe|donato|jorge|ricardo|humberto|j[uú]lio|nicolau|f[aá]bio|val[eé]rio|cristiano|thiago|male|masculina/i;

export function getVoiceGender(): VoiceGender {
  try {
    return localStorage.getItem(STORAGE_KEY) === "masculina" ? "masculina" : "feminina";
  } catch {
    return "feminina";
  }
}

export function setVoiceGender(gender: VoiceGender) {
  try {
    localStorage.setItem(STORAGE_KEY, gender);
  } catch {
    // sem armazenamento: vale só até recarregar a página
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Avisa quando a preferência muda (nesta aba ou em outra). */
export function onVoiceGenderChange(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEY) listener(); };
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => { window.removeEventListener(EVENT, listener); window.removeEventListener("storage", onStorage); };
}

const supported = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** As vozes carregam de forma assíncrona em alguns navegadores. */
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!supported()) return Promise.resolve([]);
  const now = window.speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise(resolve => {
    const done = () => resolve(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1500);
  });
}

function genderOf(voice: SpeechSynthesisVoice): VoiceGender | null {
  if (MALE.test(voice.name)) return "masculina";
  if (FEMALE.test(voice.name)) return "feminina";
  return null;
}

/** Quanto mais alto, mais natural: pt-BR e vozes neurais primeiro. */
function quality(voice: SpeechSynthesisVoice): number {
  const lang = voice.lang.replace("_", "-").toLowerCase();
  let score = 0;
  if (lang === "pt-br") score += 100;
  else if (lang.startsWith("pt")) score += 20; // pt-PT soa estranho ao aluno brasileiro
  if (/natural|neural|online/i.test(voice.name)) score += 60;
  if (/google/i.test(voice.name)) score += 25;
  if (/microsoft/i.test(voice.name)) score += 10;
  return score;
}

export interface ChosenVoice {
  voice: SpeechSynthesisVoice | null;
  /** Verdadeiro quando o navegador tem uma voz do gênero escolhido; senão o tom é ajustado. */
  exact: boolean;
}

export async function chooseVoice(gender: VoiceGender): Promise<ChosenVoice> {
  const portuguese = (await loadVoices()).filter(voice => voice.lang.toLowerCase().startsWith("pt"));
  if (!portuguese.length) return { voice: null, exact: false };
  const ranked = [...portuguese].sort((a, b) => quality(b) - quality(a));
  const match = ranked.find(voice => genderOf(voice) === gender);
  if (match) return { voice: match, exact: true };
  // Sem voz do gênero pedido: usa a melhor sem gênero conhecido (ou a melhor de todas) e ajusta o tom.
  return { voice: ranked.find(voice => genderOf(voice) === null) ?? ranked[0], exact: false };
}

/** Agrupa frases em trechos de até `max` caracteres: falas longas ficam naturais e cada trecho vira um pedido de áudio. */
function toChunks(text: string, max = 600): string[] {
  const sentences = text.replace(/\s+/g, " ").trim().match(/[^.!?;:]+[.!?;:]*/g) ?? [];
  const chunks: string[] = [];
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    const last = chunks.length - 1;
    if (last >= 0 && chunks[last].length + sentence.length + 1 <= max) chunks[last] += ` ${sentence}`;
    else chunks.push(sentence.slice(0, 780));
  }
  return chunks;
}

/* ---------------------------------------------------------------------------
 * Voz neural (Azure Speech, pelo servidor TeachLi): muito mais natural que a voz do navegador.
 * Se o servidor não a tiver configurada ou falhar, a leitura cai na voz do navegador.
 * ------------------------------------------------------------------------- */

const audioCache = new Map<string, string>(); // "gênero|texto" -> URL do áudio
const MAX_CACHED_AUDIOS = 40;
const NEURAL_RETRY_MS = 60_000;
let neuralDownUntil = 0;
let generation = 0;
let currentAudio: HTMLAudioElement | null = null;
let currentDone: (() => void) | null = null;
let tail: Promise<void> = Promise.resolve();

async function neuralAudio(text: string, gender: VoiceGender): Promise<string> {
  const key = `${gender}|${text}`;
  const cached = audioCache.get(key);
  if (cached) return cached;
  const session = loadMicrosoftSession("aluno") || loadMicrosoftSession("professor");
  if (!session?.token) throw new Error("sem sessão");
  const blob = await classroomAudio("/tts", session.token, { text, gender });
  const url = URL.createObjectURL(blob);
  audioCache.set(key, url);
  if (audioCache.size > MAX_CACHED_AUDIOS) {
    const oldest = audioCache.keys().next().value as string;
    URL.revokeObjectURL(audioCache.get(oldest)!);
    audioCache.delete(oldest);
  }
  return url;
}

function playUrl(url: string, myGeneration: number): Promise<void> {
  return new Promise(resolve => {
    if (myGeneration !== generation) return resolve();
    const audio = new Audio(url);
    currentAudio = audio;
    const done = () => {
      if (currentAudio === audio) { currentAudio = null; currentDone = null; }
      resolve();
    };
    currentDone = done;
    audio.onended = done;
    audio.onerror = done;
    audio.play().catch(done);
  });
}

function stopAll() {
  generation += 1;
  if (currentAudio) { currentAudio.pause(); currentDone?.(); }
  tail = Promise.resolve();
  if (supported()) window.speechSynthesis.cancel();
}

export interface SpeakOptions {
  gender?: VoiceGender;
  onEnd?: () => void;
  /** Falso para entrar na fila em vez de interromper a leitura em andamento (leitura automática). */
  interrupt?: boolean;
}

export type SpeakEngine = "neural" | "navegador" | null;

function speakWithBrowser(text: string, gender: VoiceGender, onEnd?: () => void): Promise<boolean> {
  return chooseVoice(gender).then(({ voice, exact }) => {
    const synth = window.speechSynthesis;
    const chunks = toChunks(text, 200);
    chunks.forEach((chunk, index) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = "pt-BR";
      if (voice) utterance.voice = voice;
      utterance.rate = 0.95;
      utterance.pitch = exact ? 1 : gender === "masculina" ? 0.75 : 1.12;
      if (index === chunks.length - 1 && onEnd) utterance.onend = onEnd;
      synth.speak(utterance);
    });
    return chunks.length > 0;
  });
}

/** Lê o texto em voz alta com voz neural (se disponível) ou com a voz do navegador. */
export async function speak(text: string, { gender = getVoiceGender(), onEnd, interrupt = true }: SpeakOptions = {}): Promise<SpeakEngine> {
  if (!text.trim()) return null;
  if (interrupt) stopAll();
  const myGeneration = generation;
  const chunks = toChunks(text);

  if (Date.now() >= neuralDownUntil) {
    try {
      const urls = await Promise.all(chunks.map(chunk => neuralAudio(chunk, gender)));
      if (myGeneration !== generation) return "neural"; // outra leitura passou na frente
      const run = tail.then(async () => {
        for (const url of urls) await playUrl(url, myGeneration);
        if (myGeneration === generation) onEnd?.();
      });
      tail = run;
      void run;
      return "neural";
    } catch {
      neuralDownUntil = Date.now() + NEURAL_RETRY_MS;
      if (myGeneration !== generation) return null;
    }
  }

  if (!supported()) return null;
  return (await speakWithBrowser(text, gender, onEnd)) ? "navegador" : null;
}

export function stopSpeaking() {
  stopAll();
}
