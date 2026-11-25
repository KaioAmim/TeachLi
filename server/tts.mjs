const MAX_TTS_CHARS = 800;

export class TtsError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const escapeXml = text => text.replace(/[<>&"']/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[ch]);

/**
 * Sintetiza fala com voz neural do Azure Speech (pt-BR). Retorna o áudio MP3 como Buffer.
 * Configuração: AZURE_SPEECH_KEY e AZURE_SPEECH_REGION; vozes opcionais em AZURE_SPEECH_VOICE_FEMALE / _MALE.
 */
export async function synthesizeSpeech(text, gender, { env = process.env, fetchImpl = fetch } = {}) {
  if (typeof text !== 'string' || !text.trim() || text.length > MAX_TTS_CHARS) {
    throw new TtsError(`O texto para leitura deve ter de 1 a ${MAX_TTS_CHARS} caracteres.`, 400);
  }
  if (gender !== 'feminina' && gender !== 'masculina') throw new TtsError('Voz inválida.', 400);
  const key = env.AZURE_SPEECH_KEY;
  const region = env.AZURE_SPEECH_REGION;
  if (!key || !region || !/^[a-z0-9-]{2,40}$/.test(region)) throw new TtsError('A voz neural não está configurada neste servidor.', 503);

  const voice = gender === 'feminina'
    ? env.AZURE_SPEECH_VOICE_FEMALE || 'pt-BR-FranciscaNeural'
    : env.AZURE_SPEECH_VOICE_MALE || 'pt-BR-AntonioNeural';
  if (!/^[A-Za-z]{2,3}-[A-Za-z]{2,4}-[A-Za-z0-9]+$/.test(voice)) throw new TtsError('Voz neural mal configurada no servidor.', 503);

  // Ritmo levemente mais lento e pausas de pontuação naturais deixam a leitura mais humana.
  const ssml = `<speak version="1.0" xml:lang="pt-BR" xmlns="http://www.w3.org/2001/10/synthesis"><voice name="${voice}"><prosody rate="-4%">${escapeXml(text.trim())}</prosody></voice></speak>`;

  let response;
  try {
    response = await fetchImpl(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'teachli',
      },
      body: ssml,
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new TtsError('Não foi possível acessar o serviço de voz. Tente novamente.', 502);
  }
  if (!response.ok) throw new TtsError('O serviço de voz não conseguiu gerar o áudio.', 502);
  return Buffer.from(await response.arrayBuffer());
}
