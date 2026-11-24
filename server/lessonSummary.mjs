import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const MAX_CAPTIONS = 500;
const MAX_TOTAL_CHARS = 40000;
const DEFAULT_MODEL = 'qwen2.5:7b';
const PYTHON_SCRIPT = fileURLToPath(new URL('./summarize_lesson.py', import.meta.url));

export class LessonSummaryError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function validateCaptions(captions) {
  if (!Array.isArray(captions) || captions.length > MAX_CAPTIONS ||
      captions.some(caption => typeof caption !== 'string') ||
      captions.reduce((total, caption) => total + (typeof caption === 'string' ? caption.length : 0), 0) > MAX_TOTAL_CHARS) {
    throw new LessonSummaryError('As legendas da aula são inválidas ou excedem o limite permitido.', 400);
  }
  const clean = captions.map(caption => caption.trim()).filter(Boolean);
  if (!clean.length) throw new LessonSummaryError('Não há legendas disponíveis para resumir.', 422);
  return clean;
}

function validateSummary(value) {
  if (!value || typeof value !== 'object' ||
      typeof value.topic !== 'string' || typeof value.summary !== 'string' ||
      !Array.isArray(value.topics) || !value.topics.every(point => typeof point === 'string') ||
      !Array.isArray(value.keyPoints) || !value.keyPoints.every(point => typeof point === 'string') ||
      !Array.isArray(value.examples) || !value.examples.every(example => typeof example === 'string') ||
      !Array.isArray(value.reviewQuestions) || !value.reviewQuestions.every(question => typeof question === 'string')) {
    throw new LessonSummaryError('O modelo não conseguiu montar um material de estudo válido. Tente novamente.', 502);
  }

  const topic = value.topic.trim().slice(0, 160);
  const summary = value.summary.trim().slice(0, 2500);
  if (!topic || !summary) throw new LessonSummaryError('As legendas não foram suficientes para criar uma síntese.', 422);
  return {
    topic,
    summary,
    topics: value.topics.map(point => point.trim()).filter(Boolean).slice(0, 10),
    keyPoints: value.keyPoints.map(point => point.trim()).filter(Boolean).slice(0, 6),
    examples: value.examples.map(example => example.trim()).filter(Boolean).slice(0, 4),
    reviewQuestions: value.reviewQuestions.map(question => question.trim()).filter(Boolean).slice(0, 3),
  };
}

function runPython(captions, { model, ollamaBaseUrl, keepAlive, pythonBin, timeoutSeconds, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin, [PYTHON_SCRIPT], {
      env: {
        ...process.env,
        OLLAMA_MODEL: model,
        OLLAMA_BASE_URL: ollamaBaseUrl,
        OLLAMA_KEEP_ALIVE: keepAlive,
        OLLAMA_TIMEOUT_SECONDS: String(timeoutSeconds),
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(reject, new LessonSummaryError('O serviço de resumo demorou demais para responder. Tente novamente.', 504));
    }, timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      stdout += chunk;
      if (stdout.length > 128_000) {
        child.kill('SIGKILL');
        finish(reject, new LessonSummaryError('A resposta do serviço de resumo excedeu o limite permitido.', 502));
      }
    });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
    child.on('error', error => {
      const message = error.code === 'ENOENT'
        ? 'Python 3 não está disponível neste servidor. Instale o Python 3 ou configure PYTHON_BIN.'
        : 'Não foi possível iniciar o serviço de resumo.';
      finish(reject, new LessonSummaryError(message, 503));
    });
    child.on('close', code => {
      if (settled) return;
      let result;
      try { result = JSON.parse(stdout); }
      catch {
        finish(reject, new LessonSummaryError(stderr.trim() || 'O serviço Python retornou uma resposta inválida.', 502));
        return;
      }
      if (code !== 0 || !result?.ok) {
        finish(reject, new LessonSummaryError(
          typeof result?.error === 'string' ? result.error : 'Não foi possível gerar a síntese. Tente novamente.',
          Number.isInteger(result?.status) ? result.status : 502,
        ));
        return;
      }
      finish(resolve, result.summary);
    });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify({ captions }));
  });
}

export async function generateLessonSummary(captions, {
  model = process.env.OLLAMA_MODEL || DEFAULT_MODEL,
  ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
  keepAlive = process.env.OLLAMA_KEEP_ALIVE || '2m',
  timeoutSeconds = Number(process.env.OLLAMA_TIMEOUT_SECONDS || 600),
  pythonBin = process.env.PYTHON_BIN || 'python3',
} = {}) {
  const clean = validateCaptions(captions);
  const normalizedTimeout = Number.isFinite(timeoutSeconds) ? Math.max(20, Math.min(timeoutSeconds, 600)) : 600;
  const result = await runPython(clean, {
    model,
    ollamaBaseUrl,
    keepAlive,
    pythonBin,
    timeoutSeconds: normalizedTimeout,
    timeoutMs: (normalizedTimeout + 5) * 1000,
  });
  return validateSummary(result);
}
