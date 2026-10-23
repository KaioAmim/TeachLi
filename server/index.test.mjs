import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { connect as connectTcp } from 'node:net';
import test from 'node:test';
import WebSocket from 'ws';
import { createClassroomServer } from './classrooms.mjs';
import { createMicrosoftVerifier } from './microsoft.mjs';
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from 'jose';

const origin = 'http://localhost:5173';
async function setup(t) {
  let now = Date.now();
  const app = createClassroomServer({ now: () => now, verifyIdentity: async token => {
    const identity = JSON.parse(token);
    return identity;
  } });
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const request = (path, token, body, requestOrigin = origin) => fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Origin: requestOrigin, ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const login = async (role, name = role) => {
    const idToken = JSON.stringify({ role, name, id: name, email: `${name}@unibarretos.com.br`, exp: Math.floor(now / 1000) + 3600 });
    const response = await request('/auth/microsoft/session', null, { idToken, role });
    assert.equal(response.status, 200); return (await response.json()).token;
  };
  const connect = async (token, room = 'laboratorio-c', requestOrigin = origin, query = '') => {
    const ws = new WebSocket(base.replace('http', 'ws') + `/classroom?room=${room}${query}`, token ? ['teachli-session', token] : undefined, { origin: requestOrigin });
    const events = []; const waiters = [];
    ws.on('message', raw => { const event = JSON.parse(raw.toString()); events.push(event); for (const waiter of [...waiters]) if (waiter.type === event.type) { waiter.resolve(event); waiters.splice(waiters.indexOf(waiter), 1); } });
    const next = type => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Missing event ${type}: ${JSON.stringify(events)}`)), 2000);
      waiters.push({ type, resolve: value => { clearTimeout(timer); resolve(value); } });
    });
    const first = next(token && ['laboratorio-a', 'laboratorio-b', 'laboratorio-c', 'sala-01', 'sala-02'].includes(room) && requestOrigin === origin ? 'joined' : 'error');
    await first;
    return { ws, events, next, send: data => ws.send(JSON.stringify(data)) };
  };
  return { base, request, login, connect, advance: ms => { now += ms; } };
}

test('autenticação obrigatória, catálogo e origem', async t => {
  const { request, login, connect } = await setup(t);
  assert.equal((await request('/classrooms')).status, 401);
  const token = await login('aluno');
  assert.equal((await (await request('/classrooms', token)).json()).rooms.length, 5);
  assert.equal((await request('/classrooms', token, undefined, 'https://evil.test')).status, 403);
  await connect(null); await connect(token, 'nao-existe'); await connect(token, 'laboratorio-c', 'https://evil.test');
  assert.equal((await request('/auth/microsoft/session', null, { role: 'aluno' })).status, 401);
  assert.equal((await request('/auth/microsoft/session', null, { idToken: 'invalid', role: 'aluno' })).status, 401);
  assert.equal((await request('/auth/demo/login', null, {})).status, 401);
});

test('isola salas, autoria e papel; aluno espera professor e não fala com outra sala', async t => {
  const { login, connect } = await setup(t);
  const student = await connect(await login('aluno', 'Ana'), 'laboratorio-c', origin, '&role=professor&name=Forjado');
  assert.equal(student.events[0].role, 'aluno');
  let reply = student.next('message.rejected');
  student.send({ type: 'student.message', id: 'waiting', text: 'Olá' }); await reply;
  const teacher = await connect(await login('professor', 'Docente C'));
  const other = await connect(await login('professor', 'Docente A'), 'laboratorio-a');
  const studentB = await connect(await login('aluno', 'Bia'), 'laboratorio-b');
  const received = teacher.next('student.message'); const ack = student.next('message.ack');
  student.send({ type: 'student.message', id: 'message-1', text: 'Preciso de ajuda', roomId: 'laboratorio-a', author: 'Falso' });
  assert.equal((await received).author, 'Ana'); assert.equal((await ack).recipients, 1);
  reply = student.next('error'); student.send({ type: 'caption.final', id: 'fake', text: 'Invasão' }); await reply;
  const caption = student.next('caption.final');
  teacher.send({ type: 'caption.final', id: 'caption-1', text: 'Vamos começar.' }); await caption;
  student.send({ type: 'student.message', id: 'message-1', text: 'duplicado' });
  // A barrier event ensures previous sends have been processed before checking isolation.
  reply = student.next('error'); student.send({ type: 'student.message', id: 'too-long', text: 'x'.repeat(2001) }); await reply;
  assert.equal(teacher.events.filter(e => e.type === 'student.message').length, 1);
  assert.equal(other.events.filter(e => e.type === 'student.message').length, 0);
  assert.equal(studentB.events.filter(e => e.type === 'caption.final').length, 0);
  const left = student.next('presence'); teacher.ws.close(); assert.equal((await left).professor, false);
  reply = student.next('message.rejected'); student.send({ type: 'student.message', id: 'after-exit', text: 'Olá' }); await reply;
});

test('trocar sala revoga associação anterior; logout e expiração impedem novos envios', async t => {
  const { login, connect, request, advance } = await setup(t);
  const token = await login('aluno');
  const first = await connect(token);
  const closed = once(first.ws, 'close');
  const nextRoom = await connect(token, 'sala-01'); await closed;
  const logoutClose = once(nextRoom.ws, 'close');
  assert.equal((await request('/auth/logout', token, {})).status, 200); await logoutClose;
  assert.equal((await request('/classrooms', token)).status, 401);
  const expiring = await connect(await login('aluno', 'Expira'));
  advance(3600001);
  const denied = expiring.next('error'); expiring.send({ type: 'student.message', id: 'expired', text: 'x' }); await denied;
});

test('limita login, rejeita perfil forjado e segundo professor', async t => {
  const { login, connect, request } = await setup(t);
  await connect(await login('professor'));
  const token = await login('professor', 'Outro');
  // Connect manually because this connection must be refused despite a valid token.
  const catalogResponse = await request('/classrooms', token);
  const base = catalogResponse.url.replace('/classrooms', '').replace('http', 'ws');
  const ws = new WebSocket(base + '/classroom?room=laboratorio-c', ['teachli-session', token], { origin });
  const [raw] = await once(ws, 'message'); assert.match(JSON.parse(raw).message, /já tem um professor/); ws.close();
  assert.equal((await request('/auth/microsoft/session', null, { role: 'professor', idToken: JSON.stringify({ role: 'aluno' }) })).status, 403);
  for (let i = 0; i < 30; i++) await request('/auth/microsoft/session', null, {});
  assert.equal((await request('/auth/microsoft/session', null, {})).status, 429);
});

test('valida identidade Microsoft sem Tenant ID configurado e sem cadastro adicional de docente', async () => {
  const tenant = '12345678-1234-1234-1234-123456789abc';
  const issuerTemplate = 'https://login.microsoftonline.com/{tenantid}/v2.0';
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = { ...await exportJWK(publicKey), kid: 'test', issuer: issuerTemplate };
  const verify = createMicrosoftVerifier({ MICROSOFT_CLIENT_ID: 'client' }, createLocalJWKSet({ keys: [jwk] }));
  const claims = { tid: tenant, oid: 'user-id', email: 'ana@alunos.unibarretos.com.br', iss: issuerTemplate.replace('{tenantid}', tenant), aud: 'client', sub: 'user', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 };
  const sign = patch => new SignJWT({ ...claims, ...patch }).setProtectedHeader({ alg: 'RS256', kid: 'test' }).sign(privateKey);
  const token = await sign({}); assert.equal((await verify(token)).role, 'aluno');
  assert.equal((await verify(await sign({ email: 'p@unibarretos.com.br' }))).role, 'professor');
  const otherTenant = '87654321-1234-1234-1234-123456789abc';
  assert.equal((await verify(await sign({ tid: otherTenant, iss: issuerTemplate.replace('{tenantid}', otherTenant) }))).role, 'aluno');
  for (const patch of [{ aud: 'other' }, { tid: 'other' }, { iss: 'other' }, { exp: 1 }, { nbf: claims.exp + 1000 }, { email: 'a@external.test' }, { email: 'a@unibarretos.com.br.evil.test' }, { tid: '9188040d-6c67-4c5b-b112-36a304b66dad' }]) await assert.rejects(verify(await sign(patch)));
  const parts = token.split('.'); parts[1] = Buffer.from(JSON.stringify({ ...claims, email: 'p@unibarretos.com.br' })).toString('base64url');
  await assert.rejects(verify(parts.join('.')));
  const wrongKeyIssuer = createMicrosoftVerifier({ MICROSOFT_CLIENT_ID: 'client' }, createLocalJWKSet({ keys: [{ ...jwk, issuer: 'https://evil.test' }] }));
  await assert.rejects(wrongKeyIssuer(token), /Emissor da chave/);
});

test('logout de sessão perdida é idempotente', async t => {
  const { request } = await setup(t);
  const response = await request('/auth/logout', 'lost-after-restart', {});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  assert.equal((await request('/classrooms', 'lost-after-restart')).status, 401);
});

test('URL malformada e frame inválido em socket recusado não derrubam o serviço', async t => {
  const { base, request } = await setup(t);
  const port = Number(new URL(base).port);
  const status = await new Promise((resolve, reject) => {
    const req = httpRequest({ hostname: '127.0.0.1', port, path: '//%', headers: { Origin: origin } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.end();
  });
  assert.equal(status, 400);
  for (const path of ['/classroom?room=laboratorio-c', '//%']) {
    await new Promise((resolve, reject) => {
      const socket = connectTcp(port, '127.0.0.1');
      let upgraded = false;
      socket.setTimeout(2000, () => { socket.destroy(); reject(new Error('Socket não foi fechado.')); });
      socket.on('connect', () => socket.write([
        `GET ${path} HTTP/1.1`, `Host: localhost:${port}`, 'Connection: Upgrade', 'Upgrade: websocket',
        'Sec-WebSocket-Version: 13', 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==', `Origin: ${origin}`, '', '',
      ].join('\r\n')));
      socket.on('data', data => {
        if (!upgraded && data.toString().includes('101 Switching Protocols')) {
          upgraded = true;
          // Invalid client frame: no mandatory masking, during an auth/URL rejection.
          socket.write(Buffer.from([0x81, 0x01, 0x61]));
        }
      });
      socket.on('error', reject);
      socket.on('close', () => { assert.equal(upgraded, true); resolve(); });
    });
    assert.equal((await request('/classrooms')).status, 401);
  }
});
