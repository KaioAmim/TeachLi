import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { createMicrosoftVerifier } from './microsoft.mjs';
import { generateLessonSummary, LessonSummaryError } from './lessonSummary.mjs';

export const DEFAULT_ROOMS = [
  { id: 'laboratorio-a', name: 'Laboratório A' },
  { id: 'laboratorio-b', name: 'Laboratório B' },
  { id: 'laboratorio-c', name: 'Laboratório C' },
  { id: 'sala-01', name: 'Sala 01' },
  { id: 'sala-02', name: 'Sala 02' },
];

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-site',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

const SIGNAL_KINDS = new Set(['hello', 'offer', 'answer', 'candidate', 'bye']);
const MAX_ROOM_CAPTIONS = 500;
const MAX_ROOM_CAPTION_CHARS = 40000;
const MAX_DAILY_SUMMARY_CALLS = 100;
const PACIFIC_DAY = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
});

function pacificDate(timestamp) {
  const parts = Object.fromEntries(PACIFIC_DAY.formatToParts(new Date(timestamp)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function createClassroomServer({ env = process.env, verifyIdentity = createMicrosoftVerifier(env), now = Date.now, audit = event => console.log(JSON.stringify(event)) } = {}) {
  const catalog = env.TEACHLI_ROOMS ? JSON.parse(env.TEACHLI_ROOMS) : DEFAULT_ROOMS;
  if (!Array.isArray(catalog) || !catalog.length || catalog.length > 100 || catalog.some(r => !/^[a-z0-9-]{1,60}$/.test(r.id) || typeof r.name !== 'string' || !r.name.trim() || r.name.length > 100) || new Set(catalog.map(r => r.id)).size !== catalog.length) throw new Error('TEACHLI_ROOMS inválido.');
  const rooms = new Map(catalog.map(r => [r.id, { ...r, clients: new Set(), lessonEndedAt: null, captions: [], captionChars: 0, summaryCache: null, summaryPending: null }]));
  const origins = (env.TEACHLI_CORS_ORIGIN ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(s => s.trim());
  const sessions = new Map();
  const attempts = new Map();
  const summaryAttempts = new Map();
  let summaryDailyUsage = { date: pacificDate(now()), calls: 0 };
  const accountLogins = new Map();
  // Limites por conta (ID Microsoft verificado), não por IP: em laboratórios e no Wi-Fi da faculdade
  // todos os computadores saem pelo mesmo IP público, e um limite por IP barraria a turma.
  const MAX_ATTEMPT_ENTRIES = 10000, MAX_CONNECTIONS_PER_ACCOUNT = 1, MAX_SESSIONS_PER_ACCOUNT = 5;
  const MAX_LOGINS_PER_ACCOUNT_MINUTE = 10, MAX_INVALID_LOGINS_PER_IP_MINUTE = 30;
  // Por IP, só tentativas inválidas (antes de haver conta verificada). Atrás de proxy reverso o IP real
  // vem de X-Forwarded-For: confie nele só com TEACHLI_TRUST_PROXY=1 e quando o proxy sobrescreve o
  // cabeçalho; caso contrário, qualquer cliente poderia forjá-lo.
  const trustProxy = env.TEACHLI_TRUST_PROXY === '1';
  const clientIp = req => {
    const forwarded = trustProxy ? req.headers['x-forwarded-for']?.split(',').pop()?.trim() : undefined;
    return forwarded || req.socket.remoteAddress || 'unknown';
  };
  // Registro de auditoria sem token, e-mail ou nome: o usuário é identificado por hash curto do ID Microsoft.
  const who = id => createHash('sha256').update(String(id)).digest('hex').slice(0, 12);
  const log = (event, fields = {}) => { try { audit({ ts: new Date(now()).toISOString(), event, ...fields }); } catch { /* auditoria nunca derruba o serviço */ } };
  const opaque = () => randomBytes(32).toString('base64url');
  const send = (ws, event) => { if (ws.readyState === 1) ws.send(JSON.stringify(event)); };
  const allowed = req => origins.includes(req.headers.origin);
  const validSession = token => { const session = sessions.get(token); return session?.expiresAt > now() ? session : null; };
  const reserveSummaryCall = () => {
    const date = pacificDate(now());
    if (summaryDailyUsage.date !== date) summaryDailyUsage = { date, calls: 0 };
    if (summaryDailyUsage.calls >= MAX_DAILY_SUMMARY_CALLS) {
      throw new LessonSummaryError('O TeachLi atingiu o limite diário de 100 chamadas para resumo. Tente novamente após a renovação diária.', 429);
    }
    summaryDailyUsage.calls++;
    return () => {
      if (summaryDailyUsage.date === date) summaryDailyUsage.calls = Math.max(0, summaryDailyUsage.calls - 1);
    };
  };
  const bearer = req => req.headers.authorization?.replace(/^Bearer /, '');
  const json = (req, res, status, body) => {
    res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Origin', ...(allowed(req) ? { 'Access-Control-Allow-Origin': req.headers.origin } : {}) });
    res.end(JSON.stringify(body));
  };
  const readJson = async (req, maxBytes = 32768) => {
    let size = 0; const chunks = [];
    for await (const chunk of req) { size += chunk.length; if (size > maxBytes) throw new Error('Requisição muito grande.'); chunks.push(chunk); }
    return JSON.parse(Buffer.concat(chunks).toString());
  };
  const presence = room => {
    const clients = [...room.clients];
    const event = { type: 'presence', professor: clients.some(c => c.session.role === 'professor'), students: clients.filter(c => c.session.role === 'aluno').length };
    // Cada conexão só conhece os IDs do perfil oposto (aluno↔professor); alunos não veem IDs de outros alunos.
    for (const c of clients) send(c.ws, { ...event, peers: clients.filter(o => o !== c && o.session.role !== c.session.role).map(o => ({ id: o.id, role: o.session.role })) });
  };
  const remove = client => {
    if (!client.room.clients.delete(client)) return;
    if (client.room.clients.size === 0) {
      client.room.lessonEndedAt = null;
      client.room.captions = [];
      client.room.captionChars = 0;
      client.room.summaryCache = null;
      client.room.summaryPending = null;
    }
    presence(client.room);
  };
  const revoke = token => {
    sessions.delete(token);
    for (const room of rooms.values()) for (const c of [...room.clients]) if (c.token === token) { remove(c); c.ws.close(1008, 'Sessão encerrada'); }
  };
  const server = createServer(async (req, res) => {
    if (!allowed(req)) return json(req, res, 403, { error: 'Origem não autorizada.' });
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { ...SECURITY_HEADERS, 'Access-Control-Allow-Origin': req.headers.origin, 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' });
      return res.end();
    }
    try {
      if (!/^\/(?!\/)/.test(req.url ?? '')) return json(req, res, 400, { error: 'Endereço inválido.' });
      const path = new URL(req.url, 'http://localhost').pathname;
      if (req.method === 'POST' && path === '/auth/microsoft/session') {
        const ip = clientIp(req);
        let limit = attempts.get(ip);
        if (!limit || limit.until <= now()) {
          if (!limit && attempts.size >= MAX_ATTEMPT_ENTRIES) return json(req, res, 429, { error: 'Muitas tentativas. Aguarde um minuto.' });
          limit = { count: 0, until: now() + 60000 }; attempts.set(ip, limit);
        }
        if (limit.count >= MAX_INVALID_LOGINS_PER_IP_MINUTE) { log('login.rate_limited'); return json(req, res, 429, { error: 'Muitas tentativas. Aguarde um minuto.' }); }
        const invalid = (status, error) => { limit.count++; return json(req, res, status, { error }); };
        const body = await readJson(req).catch(() => null);
        if (typeof body?.idToken !== 'string' || !body.idToken) return invalid(401, 'Entre novamente pela Microsoft antes de acessar as salas.');
        let identity;
        try { identity = await verifyIdentity(body.idToken); }
        catch { log('login.failed'); return invalid(401, 'Não foi possível validar sua conta. Entre novamente com sua conta institucional Microsoft.'); }
        if (identity.role !== body.role) { log('login.role_denied', { user: who(identity.id) }); return invalid(403, 'Esta conta não tem permissão para o perfil escolhido.'); }
        const account = who(identity.id);
        let accountLimit = accountLogins.get(account);
        if (!accountLimit || accountLimit.until <= now()) {
          if (!accountLimit && accountLogins.size >= MAX_ATTEMPT_ENTRIES) return json(req, res, 429, { error: 'Muitas tentativas. Aguarde um minuto.' });
          accountLimit = { count: 0, until: now() + 60000 }; accountLogins.set(account, accountLimit);
        }
        if (++accountLimit.count > MAX_LOGINS_PER_ACCOUNT_MINUTE) { log('login.rate_limited', { user: account }); return json(req, res, 429, { error: 'Muitas entradas com esta conta. Aguarde um minuto.' }); }
        if (sessions.size >= 10000) return json(req, res, 503, { error: 'Serviço ocupado. Tente novamente.' });
        const token = opaque(); const expiresAt = Math.min(identity.exp * 1000, now() + 3600000);
        if (expiresAt <= now()) return json(req, res, 401, { error: 'Sessão expirada.' });
        // Cada conta mantém poucas sessões ativas; a mais antiga é encerrada (ex.: PC esquecido logado).
        const accountSessions = [...sessions].filter(([, s]) => s.id === identity.id).sort((a, b) => a[1].createdAt - b[1].createdAt);
        for (const [oldToken] of accountSessions.slice(0, Math.max(0, accountSessions.length - MAX_SESSIONS_PER_ACCOUNT + 1))) revoke(oldToken);
        sessions.set(token, { ...identity, expiresAt, createdAt: now() });
        log('login.ok', { user: who(identity.id), role: identity.role });
        return json(req, res, 200, { token, role: identity.role, profile: { name: identity.name, email: identity.email, expiresAt } });
      }
      const token = bearer(req);
      // Logout is idempotent, including sessions lost after a server restart.
      if (path === '/auth/logout' && req.method === 'POST') { if (sessions.has(token)) log('logout', { user: who(sessions.get(token).id) }); revoke(token); return json(req, res, 200, { ok: true }); }
      const session = validSession(token);
      if (!session) return json(req, res, 401, { error: 'Sua sessão expirou. Entre novamente pela Microsoft.' });
      if (path === '/classrooms' && req.method === 'GET') return json(req, res, 200, { rooms: catalog });
      if (path === '/lessons/summary' && req.method === 'POST') {
        if (session.role !== 'aluno') return json(req, res, 403, { error: 'Somente alunos podem gerar o resumo da aula.' });
        const body = await readJson(req, 4096);
        const endedRoom = typeof body?.roomId === 'string' ? rooms.get(body.roomId) : null;
        if (!endedRoom?.lessonEndedAt || body.endedAt !== endedRoom.lessonEndedAt) {
          return json(req, res, 409, { error: 'Entre em uma aula finalizada para gerar o resumo.' });
        }
        const summaryLimit = summaryAttempts.get(who(session.id));
        if (summaryLimit?.until > now() && summaryLimit.count >= 5) return json(req, res, 429, { error: 'Você já gerou vários resumos. Aguarde alguns minutos para tentar novamente.' });
        if (summaryAttempts.size >= 10000 && !summaryLimit) return json(req, res, 429, { error: 'Muitas solicitações. Tente novamente em alguns minutos.' });
        if (!summaryLimit || summaryLimit.until <= now()) summaryAttempts.set(who(session.id), { count: 1, until: now() + 600000 });
        else summaryLimit.count++;
        const endedAt = endedRoom.lessonEndedAt;
        let summaryPromise;
        if (endedRoom.summaryCache?.endedAt === endedAt) {
          summaryPromise = Promise.resolve(endedRoom.summaryCache.result);
        } else if (endedRoom.summaryPending?.endedAt === endedAt) {
          summaryPromise = endedRoom.summaryPending.promise;
        } else {
          if (!endedRoom.captions.length) throw new LessonSummaryError('Não há legendas disponíveis para resumir.', 422);
          const releaseSummaryCall = reserveSummaryCall();
          const pending = { endedAt, promise: null };
          pending.promise = generateLessonSummary(endedRoom.captions.map(caption => caption.text), {
            apiBase: env.LITELLM_API_BASE,
            apiKey: env.LITELLM_API_KEY,
            model: env.LITELLM_MODEL,
            timeoutSeconds: Number(env.LITELLM_TIMEOUT_SECONDS || 60),
          }).then(result => {
            if (endedRoom.lessonEndedAt === endedAt) endedRoom.summaryCache = { endedAt, result };
            return result;
          }).catch(error => {
            releaseSummaryCall();
            throw error;
          }).finally(() => {
            if (endedRoom.summaryPending === pending) endedRoom.summaryPending = null;
          });
          endedRoom.summaryPending = pending;
          summaryPromise = pending.promise;
        }
        const summary = await summaryPromise;
        return json(req, res, 200, summary);
      }
      return json(req, res, 404, { error: 'Rota não encontrada.' });
    } catch (error) {
      if (error instanceof LessonSummaryError) return json(req, res, error.status, { error: error.message });
      return json(req, res, 400, { error: 'Requisição inválida.' });
    }
  });
  const wss = new WebSocketServer({ server, maxPayload: 16384, handleProtocols: p => p.has('teachli-session') ? 'teachli-session' : false });
  wss.on('connection', (ws, req) => {
    const reject = message => { send(ws, { type: 'error', message }); ws.close(1008); };
    // Rejected sockets can still emit protocol errors while the close handshake is pending.
    ws.on('error', () => ws.terminate());
    let url;
    try {
      if (!/^\/(?!\/)/.test(req.url ?? '')) return reject('Endereço inválido.');
      url = new URL(req.url, 'http://localhost');
    } catch { return reject('Endereço inválido.'); }
    const protocols = (req.headers['sec-websocket-protocol'] ?? '').split(',').map(s => s.trim());
    const token = protocols.find(p => p !== 'teachli-session');
    const session = validSession(token);
    if (!allowed(req) || url.pathname !== '/classroom' || !session) { log('ws.denied'); return reject('Sessão inválida. Entre novamente pela Microsoft.'); }
    const room = rooms.get(url.searchParams.get('room'));
    if (!room) return reject('Sala não cadastrada. Escolha uma sala da lista.');
    if (session.role === 'professor' && [...room.clients].some(c => c.session.role === 'professor' && c.session.id !== session.id)) return reject('Esta sala já tem um professor. Escolha outra sala ou aguarde a saída dele.');
    // A session belongs to exactly one connection/room. An old connection loses membership immediately.
    for (const r of rooms.values()) for (const old of [...r.clients]) if (old.token === token) { remove(old); old.ws.close(1000, 'Sala alterada'); }
    // Uma conexão por conta: entrar em outro dispositivo/aba encerra a conexão anterior da mesma conta.
    const accountClients = [...rooms.values()].flatMap(r => [...r.clients]).filter(c => c.session.id === session.id).sort((a, b) => a.joinedAt - b.joinedAt);
    for (const old of accountClients.slice(0, Math.max(0, accountClients.length - MAX_CONNECTIONS_PER_ACCOUNT + 1))) {
      remove(old); send(old.ws, { type: 'error', message: 'Sua conta entrou em outro dispositivo. Esta conexão foi encerrada.' }); old.ws.close(1000, 'Conta conectada em outro dispositivo');
    }
    const client = { id: randomUUID(), ws, token, session, room, joinedAt: now(), seen: new Set(), count: 0, until: now() + 10000, signals: 0, signalUntil: now() + 10000 };
    room.clients.add(client);
    log('room.join', { user: who(session.id), role: session.role, room: room.id });
    send(ws, { type: 'joined', room: { id: room.id, name: room.name }, role: session.role, selfId: client.id });
    presence(room);
    if (session.role === 'aluno') send(ws, { type: 'caption.history', captions: room.captions });
    if (room.lessonEndedAt) send(ws, { type: 'lesson.ended', endedAt: room.lessonEndedAt });
    ws.on('message', raw => {
      if (!validSession(token) || !room.clients.has(client)) { remove(client); return reject('Sua sessão expirou. Entre novamente.'); }
      let signal;
      try { signal = JSON.parse(raw.toString()); } catch { return; }
      if (signal?.type === 'signal') {
        // Sinalização da chamada (SDP/ICE): só entre aluno e professor da mesma sala, com limite próprio.
        if (now() >= client.signalUntil) { client.signals = 0; client.signalUntil = now() + 10000; }
        if (++client.signals > 300) return send(ws, { type: 'error', message: 'Sinalização muito rápida. Aguarde alguns segundos.' });
        const target = [...room.clients].find(c => c.id === signal.to && c !== client && c.session.role !== session.role && validSession(c.token) && c.ws.readyState === 1);
        const data = signal.data;
        const ok = target && data && typeof data === 'object' && !Array.isArray(data) && SIGNAL_KINDS.has(data.kind) && JSON.stringify(data).length <= 12000;
        if (!ok) return send(ws, { type: 'signal.rejected', to: typeof signal.to === 'string' ? signal.to.slice(0, 40) : null });
        if (data.kind === 'hello' || data.kind === 'offer') log('call.' + data.kind, { user: who(session.id), room: room.id });
        return send(target.ws, { type: 'signal', from: client.id, data });
      }
      if (now() >= client.until) { client.count = 0; client.until = now() + 10000; }
      if (++client.count > 60) return send(ws, { type: 'error', message: 'Envios muito rápidos. Aguarde alguns segundos.' });
      if (signal?.type === 'lesson.end') {
        if (session.role !== 'professor') return send(ws, { type: 'error', message: 'Somente o professor pode finalizar a aula.' });
        if (!room.lessonEndedAt) {
          room.lessonEndedAt = now();
          room.summaryCache = null;
          room.summaryPending = null;
          log('lesson.end', { user: who(session.id), room: room.id });
        }
        const event = { type: 'lesson.ended', endedAt: room.lessonEndedAt };
        for (const participant of room.clients) send(participant.ws, event);
        return;
      }
      if (room.lessonEndedAt && ['student.message', 'caption.final'].includes(signal?.type)) {
        return send(ws, { type: 'lesson.closed', message: 'A aula foi finalizada. Não é possível enviar novas mensagens nesta aula.' });
      }
      const message = signal;
      if (!message || !['student.message', 'caption.final'].includes(message.type) ||
          (message.type === 'student.message') !== (session.role === 'aluno') ||
          typeof message.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(message.id) ||
          typeof message.text !== 'string' || !message.text.trim() || message.text.length > 2000) return send(ws, { type: 'error', message: 'Mensagem inválida ou sem permissão (máximo de 2.000 caracteres).' });
      if (client.seen.has(message.id)) return; // never retransmit the same message
      const targets = [...room.clients].filter(c => c !== client && c.session.role !== session.role && validSession(c.token) && c.ws.readyState === 1);
      if (!targets.length && session.role === 'aluno') return send(ws, { type: 'message.rejected', id: message.id, message: 'Aguarde o professor entrar para enviar.' });
      client.seen.add(message.id);
      if (client.seen.size > 500) client.seen.delete(client.seen.values().next().value);
      const event = { type: message.type, id: randomUUID(), text: message.text.trim(), author: session.name, role: session.role, roomId: room.id, createdAt: now() };
      if (message.type === 'caption.final') {
        room.captions.push(event);
        room.captionChars += event.text.length;
        while (room.captions.length > MAX_ROOM_CAPTIONS || room.captionChars > MAX_ROOM_CAPTION_CHARS) {
          room.captionChars -= room.captions.shift()?.text.length ?? 0;
        }
      }
      for (const target of targets) send(target.ws, event);
      send(ws, { type: 'message.ack', id: message.id, recipients: targets.length, ...(message.type === 'caption.final' ? { archived: true } : {}) });
    });
    ws.on('close', () => remove(client));
    ws.on('error', () => remove(client));
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
  });
  const cleanup = setInterval(() => {
    for (const [token, s] of sessions) if (s.expiresAt <= now()) revoke(token);
    for (const [ip, a] of attempts) if (a.until <= now()) attempts.delete(ip);
    for (const [account, a] of accountLogins) if (a.until <= now()) accountLogins.delete(account);
    for (const [user, a] of summaryAttempts) if (a.until <= now()) summaryAttempts.delete(user);
    for (const ws of wss.clients) { if (!ws.isAlive) ws.terminate(); else { ws.isAlive = false; ws.ping(); } }
  }, 15000);
  cleanup.unref();
  server.on('close', () => clearInterval(cleanup));
  return { server, wss, close: async () => {
    clearInterval(cleanup);
    for (const ws of wss.clients) ws.terminate();
    wss.close();
    await new Promise(resolve => server.close(resolve));
  } };
}
