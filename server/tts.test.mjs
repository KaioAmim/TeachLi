import assert from 'node:assert/strict';
import test from 'node:test';
import { synthesizeSpeech, TtsError } from './tts.mjs';

const env = { AZURE_SPEECH_KEY: 'k', AZURE_SPEECH_REGION: 'brazilsouth' };

test('sem chave configurada, informa que a voz neural não está disponível', async () => {
  await assert.rejects(() => synthesizeSpeech('Olá', 'feminina', { env: {} }), error => error instanceof TtsError && error.status === 503);
});

test('rejeita texto vazio, longo demais e voz inválida', async () => {
  await assert.rejects(() => synthesizeSpeech('  ', 'feminina', { env }), { status: 400 });
  await assert.rejects(() => synthesizeSpeech('a'.repeat(801), 'feminina', { env }), { status: 400 });
  await assert.rejects(() => synthesizeSpeech('Olá', 'robo', { env }), { status: 400 });
});

test('envia SSML escapado com a voz do gênero escolhido e devolve o áudio', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
  };
  const audio = await synthesizeSpeech('Tom & <Jerry>', 'masculina', { env, fetchImpl });
  assert.deepEqual([...audio], [1, 2, 3]);
  assert.equal(calls[0].url, 'https://brazilsouth.tts.speech.microsoft.com/cognitiveservices/v1');
  assert.equal(calls[0].init.headers['Ocp-Apim-Subscription-Key'], 'k');
  assert.match(calls[0].init.body, /pt-BR-AntonioNeural/);
  assert.match(calls[0].init.body, /Tom &amp; &lt;Jerry&gt;/);

  await synthesizeSpeech('Olá', 'feminina', { env, fetchImpl });
  assert.match(calls[1].init.body, /pt-BR-FranciscaNeural/);
});

test('falha do serviço vira erro 502 sem expor detalhes', async () => {
  const fetchImpl = async () => ({ ok: false });
  await assert.rejects(() => synthesizeSpeech('Olá', 'feminina', { env, fetchImpl }), { status: 502 });
});

test('não aceita região com formato suspeito', async () => {
  await assert.rejects(() => synthesizeSpeech('Olá', 'feminina', { env: { ...env, AZURE_SPEECH_REGION: 'x.evil.com/' } }), { status: 503 });
});
