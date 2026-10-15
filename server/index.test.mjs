import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import test from "node:test";
import WebSocket from "ws";

async function getAvailablePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function startServer() {
  const port = await getAvailablePort();
  const child = spawn(process.execPath, ["index.mjs"], {
    cwd: new URL(".", import.meta.url),
    env: {
      ...process.env,
      PORT: String(port),
      DEMO_SESSION_SECRET: "test-session-secret-that-is-long-enough",
      DEMO_PROFESSOR_ACCESS_CODE: "codigo-seguro-de-teste",
      TEACHLI_CORS_ORIGIN: "http://localhost:5173",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Servidor de teste não iniciou.")), 5_000);
    child.stdout.on("data", chunk => {
      if (chunk.toString().includes("Servidor TeachLi ouvindo")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.once("error", reject);
    child.once("exit", code => reject(new Error(`Servidor de teste encerrou com código ${code}.`)));
  });
  return { child, baseUrl: `http://127.0.0.1:${port}`, wsUrl: `ws://127.0.0.1:${port}` };
}

async function login(baseUrl, input, origin = "http://localhost:5173") {
  return fetch(`${baseUrl}/auth/demo/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(input),
  });
}

function connect(url, protocols) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, protocols);
    ws.once("message", data => resolve({ ws, message: JSON.parse(data.toString()) }));
    ws.once("error", reject);
  });
}

test("protege a criação de sala com sessão demo de professor", async t => {
  const { child, baseUrl, wsUrl } = await startServer();
  t.after(() => child.kill());

  const studentEmail = await login(baseUrl, {
    name: "Aluno",
    email: "kaio.nunes@alunos.unibarretos.com.br",
    accessCode: "codigo-seguro-de-teste",
  });
  assert.equal(studentEmail.status, 403);

  const deniedOrigin = await login(baseUrl, {
    name: "Professor",
    email: "professor@unibarretos.com.br",
    accessCode: "codigo-seguro-de-teste",
  }, "https://origem-nao-autorizada.exemplo");
  assert.equal(deniedOrigin.status, 403);

  const wrongCode = await login(baseUrl, {
    name: "Professor",
    email: "professor@unibarretos.com.br",
    accessCode: "codigo-errado",
  });
  assert.equal(wrongCode.status, 401);

  const validLogin = await login(baseUrl, {
    name: "Professor Demo",
    email: "professor@unibarretos.com.br",
    accessCode: "codigo-seguro-de-teste",
  });
  assert.equal(validLogin.status, 200);
  const { token } = await validLogin.json();
  assert.equal(typeof token, "string");

  const withoutSession = await connect(`${wsUrl}?room=ABCD23&role=professor&name=Forjado`);
  assert.equal(withoutSession.message.type, "error");
  assert.match(withoutSession.message.message, /sessão de professor/i);
  withoutSession.ws.close();

  const invalidRoom = await connect(`${wsUrl}?room=../SEGREDO&role=aluno&name=Kaio`);
  assert.equal(invalidRoom.message.type, "error");
  assert.match(invalidRoom.message.message, /código de sala inválido/i);
  invalidRoom.ws.close();

  const professor = await connect(
    `${wsUrl}?room=ABCD23&role=professor&name=Forjado`,
    ["teachli-session", token]
  );
  assert.deepEqual(professor.message, { type: "joined", selfId: professor.message.selfId, peers: [] });

  const student = await connect(`${wsUrl}?room=ABCD23&role=aluno&name=Kaio`);
  assert.equal(student.message.type, "joined");
  assert.equal(student.message.peers.length, 1);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await login(baseUrl, {
      name: "Professor",
      email: "professor@unibarretos.com.br",
      accessCode: "codigo-errado",
    });
    assert.equal(response.status, 401);
  }
  const limited = await login(baseUrl, {
    name: "Professor",
    email: "professor@unibarretos.com.br",
    accessCode: "codigo-errado",
  });
  assert.equal(limited.status, 429);

  professor.ws.close();
  student.ws.close();
});
