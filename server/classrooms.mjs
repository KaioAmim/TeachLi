import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { createMicrosoftVerifier } from './microsoft.mjs';

export const DEFAULT_ROOMS = [
  { id: 'laboratorio-a', name: 'Laboratório A' },
  { id: 'laboratorio-b', name: 'Laboratório B' },
  { id: 'laboratorio-c', name: 'Laboratório C' },
  { id: 'sala-01', name: 'Sala 01' },
  { id: 'sala-02', name: 'Sala 02' },
];

export function createClassroomServer({ env = process.env, verifyIdentity = createMicrosoftVerifier(env), now = Date.now } = {}) {
  const catalog = env.TEACHLI_ROOMS ? JSON.parse(env.TEACHLI_ROOMS) : DEFAULT_ROOMS;
  if (!Array.isArray(catalog) || !catalog.length || catalog.length > 100 || catalog.some(r => !/^[a-z0-9-]{1,60}$/.test(r.id) || typeof r.name !== 'string' || !r.name.trim() || r.name.length > 100) || new Set(catalog.map(r => r.id)).size !== catalog.length) throw new Error('TEACHLI_ROOMS inválido.');
  const rooms = new Map(catalog.map(r => [r.id, { ...r, clients: new Set() }]));
  const origins = (env.TEACHLI_CORS_ORIGIN ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(s => s.trim());
  const sessions = new Map();
  const attempts = new Map();
  const opaque = () => randomBytes(32).toString('base64url');
  const send = (ws, event) => { if (ws.readyState === 1) ws.send(JSON.stringify(event)); };
  const allowed = req => origins.includes(req.headers.origin);
  const validSession = token => { const session = sessions.get(token); return session?.expiresAt > now() ? session : null; };
  const bearer = req => req.headers.authorization?.replace(/^Bearer /, '');
  const json = (req, res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Origin', ...(allowed(req) ? { 'Access-Control-Allow-Origin': req.headers.origin } : {}) });
    res.end(JSON.stringify(body));
  };
  const readJson = async req => {
    let size = 0; const chunks = [];
    for await (const chunk of req) { size += chunk.length; if (size > 32768) throw new Error('Requisição muito grande.'); chunks.push(chunk); }
    return JSON.parse(Buffer.concat(chunks).toString());
  };
  const presence = room => {
    const clients = [...room.clients];
    const event = { type: 'presence', professor: clients.some(c => c.session.role === 'professor'), students: clients.filter(c => c.session.role === 'aluno').length };
    for (const c of clients) send(c.ws, event);
  };
  const remove = client => { if (client.room.clients.delete(client)) presence(client.room); };
  const revoke = token => {
    sessions.delete(token);
    for (const room of rooms.values()) for (const c of [...room.clients]) if (c.token === token) { remove(c); c.ws.close(1008, 'Sessão encerrada'); }
  };
  const server = createServer(async (req, res) => {
    if (!allowed(req)) return json(req, res, 403, { error: 'Origem não autorizada.' });
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': req.headers.origin, 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' });
      return res.end();
    }
    try {
      if (!/^\/(?!\/)/.test(req.url ?? '')) return json(req, res, 400, { error: 'Endereço inválido.' });
      const path = new URL(req.url, 'http://localhost').pathname;
      if (req.method === 'POST' && path === '/auth/microsoft/session') {
        const ip = req.socket.remoteAddress;
        let limit = attempts.get(ip);
        if (!limit || limit.until <= now()) { limit = { count: 0, until: now() + 60000 }; attempts.set(ip, limit); }
        if (++limit.count > 30) return json(req, res, 429, { error: 'Muitas tentativas. Aguarde um minuto.' });
        const body = await readJson(req);
        if (typeof body?.idToken !== 'string' || !body.idToken) return json(req, res, 401, { error: 'Entre novamente pela Microsoft antes de acessar as salas.' });
        let identity;
        try { identity = await verifyIdentity(body.idToken); }
        catch { return json(req, res, 401, { error: 'Não foi possível validar sua conta. Entre novamente com sua conta institucional Microsoft.' }); }
        if (identity.role !== body.role) return json(req, res, 403, { error: 'Esta conta não tem permissão para o perfil escolhido.' });
        if (sessions.size >= 10000) return json(req, res, 503, { error: 'Serviço ocupado. Tente novamente.' });
        const token = opaque(); const expiresAt = Math.min(identity.exp * 1000, now() + 3600000);
        if (expiresAt <= now()) return json(req, res, 401, { error: 'Sessão expirada.' });
        sessions.set(token, { ...identity, expiresAt });
        return json(req, res, 200, { token, role: identity.role, profile: { name: identity.name, email: identity.email, expiresAt } });
      }
      const token = bearer(req);
      // Logout is idempotent, including sessions lost after a server restart.
      if (path === '/auth/logout' && req.method === 'POST') { revoke(token); return json(req, res, 200, { ok: true }); }
      const session = validSession(token);
      if (!session) return json(req, res, 401, { error: 'Sua sessão expirou. Entre novamente pela Microsoft.' });
      if (path === '/classrooms' && req.method === 'GET') return json(req, res, 200, { rooms: catalog });
      return json(req, res, 404, { error: 'Rota não encontrada.' });
    } catch { return json(req, res, 400, { error: 'Requisição inválida.' }); }
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
    if (!allowed(req) || url.pathname !== '/classroom' || !session) return reject('Sessão inválida. Entre novamente pela Microsoft.');
    const room = rooms.get(url.searchParams.get('room'));
    if (!room) return reject('Sala não cadastrada. Escolha uma sala da lista.');
    if (session.role === 'professor' && [...room.clients].some(c => c.session.role === 'professor' && c.token !== token)) return reject('Esta sala já tem um professor. Escolha outra sala ou aguarde a saída dele.');
    // A session belongs to exactly one connection/room. An old connection loses membership immediately.
    for (const r of rooms.values()) for (const old of [...r.clients]) if (old.token === token) { remove(old); old.ws.close(1000, 'Sala alterada'); }
    const client = { ws, token, session, room, seen: new Set(), count: 0, until: now() + 10000 };
    room.clients.add(client);
    send(ws, { type: 'joined', room: { id: room.id, name: room.name }, role: session.role });
    presence(room);
    ws.on('message', raw => {
      if (!validSession(token) || !room.clients.has(client)) { remove(client); return reject('Sua sessão expirou. Entre novamente.'); }
      if (now() >= client.until) { client.count = 0; client.until = now() + 10000; }
      if (++client.count > 60) return send(ws, { type: 'error', message: 'Envios muito rápidos. Aguarde alguns segundos.' });
      let message;
      try { message = JSON.parse(raw.toString()); } catch { return; }
      if (!message || !['student.message', 'caption.final'].includes(message.type) ||
          (message.type === 'student.message') !== (session.role === 'aluno') ||
          typeof message.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(message.id) ||
          typeof message.text !== 'string' || !message.text.trim() || message.text.length > 2000) return send(ws, { type: 'error', message: 'Mensagem inválida ou sem permissão (máximo de 2.000 caracteres).' });
      if (client.seen.has(message.id)) return; // never retransmit the same message
      const targets = [...room.clients].filter(c => c !== client && c.session.role !== session.role && validSession(c.token) && c.ws.readyState === 1);
      if (!targets.length) return send(ws, { type: 'message.rejected', id: message.id, message: session.role === 'aluno' ? 'Aguarde o professor entrar para enviar.' : 'Nenhum aluno conectado para receber a legenda.' });
      client.seen.add(message.id);
      if (client.seen.size > 500) client.seen.delete(client.seen.values().next().value);
      const event = { type: message.type, id: randomUUID(), text: message.text.trim(), author: session.name, role: session.role, roomId: room.id, createdAt: now() };
      for (const target of targets) send(target.ws, event);
      send(ws, { type: 'message.ack', id: message.id, recipients: targets.length });
    });
    ws.on('close', () => remove(client));
    ws.on('error', () => remove(client));
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
  });
  const cleanup = setInterval(() => {
    for (const [token, s] of sessions) if (s.expiresAt <= now()) revoke(token);
    for (const [ip, a] of attempts) if (a.until <= now()) attempts.delete(ip);
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
