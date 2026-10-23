import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { transformWithEsbuild } from "vite";

const sessionKey = "teachli.microsoft.session";
const pendingKey = "teachli.microsoft.pending-login";
const clientId = "test-client";
let auth;
let redirect;
const originalFetch = globalThis.fetch;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

before(async () => {
  const api = await readFile(new URL("../src/lib/classroomApi.ts", import.meta.url), "utf8");
  const source = api + (await readFile(new URL("../src/lib/microsoftAuth.ts", import.meta.url), "utf8")).replace('import { ClassroomRequestError, classroomRequest } from "./classroomApi";', "");
  const { code } = await transformWithEsbuild(source, "microsoftAuth.ts", {
    loader: "ts",
    format: "esm",
    define: {
      "import.meta.env.VITE_SIGNALING_URL": JSON.stringify("ws://localhost:8787"),
      "import.meta.env.VITE_MICROSOFT_CLIENT_ID": JSON.stringify(clientId),
      "import.meta.env.VITE_MICROSOFT_TENANT_ID": JSON.stringify("organizations"),
    },
  });
  auth = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
});

beforeEach(() => {
  const storage = new Map();
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key),
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { origin: "http://localhost:5173", assign: url => { redirect = new URL(url); } } },
  });
  redirect = null;
  globalThis.fetch = async () => { throw new Error("Unexpected network request"); };
});

after(() => {
  globalThis.fetch = originalFetch;
  for (const [key, descriptor] of [["sessionStorage", originalStorage], ["window", originalWindow]]) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
});

async function callback(role, claims = {}) {
  await auth.startMicrosoftLogin(role);
  const pending = JSON.parse(sessionStorage.getItem(pendingKey));
  const payload = { aud: clientId, nonce: pending.nonce, exp: Math.floor(Date.now() / 1000) + 3600, name: "Teste", ...claims };
  // Fixture for the existing token-response parser, not proof of signature validation.
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ id_token: `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature` }) });
  return auth.finishMicrosoftLogin(`?code=test-code&state=${pending.state}`);
}

for (const [role, email] of [["aluno", "aluno@alunos.unibarretos.com.br"], ["professor", "docente@unibarretos.com.br"]]) {
  test(`permite ${role} somente no perfil correspondente`, async () => {
    const session = await callback(role, { email });
    assert.equal(session.role, role);
    assert.equal(auth.loadMicrosoftSession(role)?.profile.email, email);
    const otherRole = role === "aluno" ? "professor" : "aluno";
    assert.equal(auth.loadMicrosoftSession(otherRole), null);
    assert.ok(auth.loadMicrosoftSession(role));
  });
  test(`bloqueia ${email} no outro perfil e não grava sessão`, async () => {
    const otherRole = role === "aluno" ? "professor" : "aluno";
    await assert.rejects(callback(otherRole, { email }), /use sua conta @/);
    assert.equal(sessionStorage.getItem(sessionKey), null);
  });
}

test("rejeita contas externas, domínio fictício, subdomínios e e-mails malformados", async () => {
  for (const email of ["teste@apoiopoupatempo.sp.gov.br", "demo@tenant.onmicrosoft.com", "docente@prof.unibarretos.com.br", "a@unibarretos.com.br.evil.test", "a@evilunibarretos.com.br", "a@@unibarretos.com.br", "a b@unibarretos.com.br", "@unibarretos.com.br", "", null]) {
    for (const role of ["aluno", "professor"]) {
      await assert.rejects(callback(role, { email }), /use sua conta @/);
      assert.equal(sessionStorage.getItem(sessionKey), null);
    }
  }
});

test("normaliza maiúsculas e usa preferred_username quando não há email", async () => {
  const session = await callback("aluno", { preferred_username: " Aluno@ALUNOS.UNIBARRETOS.COM.BR " });
  assert.equal(session.profile.email, "aluno@alunos.unibarretos.com.br");
});

test("invalida sessão antiga de aluno que entrou como professor", () => {
  sessionStorage.setItem(sessionKey, JSON.stringify({ role: "professor", profile: { name: "Aluno", email: "aluno@alunos.unibarretos.com.br", expiresAt: Date.now() + 60000 } }));
  assert.equal(auth.loadMicrosoftSession("professor"), null);
  assert.equal(sessionStorage.getItem(sessionKey), null);
});

test("rejeita sessões expiradas e malformadas", () => {
  for (const value of ["{", "null", "{}", JSON.stringify({ role: "professor", profile: { name: "Teste", email: "prof@unibarretos.com.br", expiresAt: Date.now() - 1 } }), JSON.stringify({ role: "professor", profile: { name: "Teste", email: "prof@unibarretos.com.br" } })]) {
    sessionStorage.setItem(sessionKey, value);
    assert.equal(auth.loadMicrosoftSession("professor"), null);
    assert.equal(sessionStorage.getItem(sessionKey), null);
  }
});

test("novo login limpa a sessão e solicita seleção de conta Microsoft", async () => {
  sessionStorage.setItem(sessionKey, "old-session");
  await auth.startMicrosoftLogin("professor");
  assert.equal(sessionStorage.getItem(sessionKey), null);
  assert.equal(redirect.searchParams.get("prompt"), "select_account");
  assert.equal(redirect.searchParams.get("redirect_uri"), "http://localhost:5173/entrar");
  assert.equal(redirect.searchParams.get("code_challenge_method"), "S256");
});

test("rejeita state, nonce, audiência e expiração inválidos", async () => {
  await auth.startMicrosoftLogin("aluno");
  await assert.rejects(auth.finishMicrosoftLogin("?code=x&state=wrong"), /validar o retorno/);
  for (const claims of [{ nonce: "wrong" }, { aud: "other-app" }, { exp: 1 }]) {
    await assert.rejects(callback("aluno", { email: "aluno@alunos.unibarretos.com.br", ...claims }), /validação da aplicação/);
    assert.equal(sessionStorage.getItem(sessionKey), null);
  }
});



test("login Microsoft funciona sem servidor de salas e sem Tenant ID institucional", async () => {
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await auth.startMicrosoftLogin('aluno');
  assert.equal(redirect.hostname, 'login.microsoftonline.com');
  assert.equal(redirect.pathname, '/organizations/oauth2/v2.0/authorize');
  assert.ok(JSON.parse(sessionStorage.getItem(pendingKey)).nonce);
});

test("retorno Microsoft salva login sem consultar o servidor de salas", async () => {
  await auth.startMicrosoftLogin('professor');
  const pending = JSON.parse(sessionStorage.getItem(pendingKey));
  const payload = { aud: clientId, nonce: pending.nonce, exp: Math.floor(Date.now() / 1000) + 3600, email: 'p@unibarretos.com.br' };
  const calls = [];
  globalThis.fetch = async url => {
    calls.push(String(url));
    assert.ok(String(url).startsWith('https://login.microsoftonline.com/'));
    return { ok: true, json: async () => ({ id_token: `a.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.b` }) };
  };
  const session = await auth.finishMicrosoftLogin(`?code=x&state=${pending.state}`);
  assert.equal(session.role, 'professor');
  assert.equal(session.token, undefined);
  assert.equal(calls.length, 1);
  await auth.logoutMicrosoftSession(); // local logout needs no room server either
  assert.equal(sessionStorage.getItem(sessionKey), null);
});

test("falha da sala preserva login e retry prepara apenas uma sessão compartilhada", async () => {
  await callback('aluno', { email: 'a@alunos.unibarretos.com.br' });
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(auth.prepareClassroomSession(), /servidor de salas está iniciado/);
  assert.ok(auth.loadMicrosoftSession('aluno'));
  let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: true, json: async () => ({ token: 'room-token' }) }; };
  const [first, second] = await Promise.all([auth.prepareClassroomSession(), auth.prepareClassroomSession()]);
  assert.equal(first.token, 'room-token');
  assert.equal(second.token, 'room-token');
  assert.equal(calls, 1);
});

test("logout limpa token rejeitado e retorno tardio da sala não recria login", async () => {
  await callback('aluno', { email: 'a@alunos.unibarretos.com.br' });
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ token: 'room-token' }) });
  await auth.prepareClassroomSession();
  globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: 'Sessão inválida' }) });
  await auth.logoutMicrosoftSession();
  assert.equal(sessionStorage.getItem(sessionKey), null);
  await callback('aluno', { email: 'a@alunos.unibarretos.com.br' });
  let resolve;
  globalThis.fetch = () => new Promise(done => { resolve = done; });
  const pending = auth.prepareClassroomSession();
  await auth.logoutMicrosoftSession();
  resolve({ ok: true, json: async () => ({ token: 'late-token' }) });
  await assert.rejects(pending, /conta foi alterada/);
  assert.equal(sessionStorage.getItem(sessionKey), null);
});
