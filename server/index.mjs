import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT ?? 8787);
const DEMO_SESSION_TTL_SECONDS = 60 * 60 * 8;
const MAX_LOGIN_BODY_BYTES = 8 * 1024;
const MAX_SIGNAL_PAYLOAD_BYTES = 64 * 1024;
const PROFESSOR_DOMAIN = "@unibarretos.com.br";
const STUDENT_DOMAIN = "@alunos.unibarretos.com.br";
const corsOrigins = (process.env.TEACHLI_CORS_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);

const isProduction = process.env.NODE_ENV === "production";
const professorAccessCode = process.env.DEMO_PROFESSOR_ACCESS_CODE ??
  (isProduction ? "" : "teachli-professor-demo");

if (isProduction && !process.env.DEMO_SESSION_SECRET) {
  throw new Error("DEMO_SESSION_SECRET é obrigatório em produção.");
}

const sessionSecret = process.env.DEMO_SESSION_SECRET ?? randomBytes(32).toString("base64url");

if (!process.env.DEMO_SESSION_SECRET) {
  console.warn("DEMO_SESSION_SECRET ausente: as sessões serão invalidadas quando o servidor reiniciar.");
}
if (!process.env.DEMO_PROFESSOR_ACCESS_CODE) {
  console.warn(
    isProduction
      ? "DEMO_PROFESSOR_ACCESS_CODE ausente: login de professor demo está desativado."
      : "Usando código demo local padrão. Defina DEMO_PROFESSOR_ACCESS_CODE antes de demonstrar a outras pessoas."
  );
}

/** roomId -> { professor: ClientInfo | null, students: Map<id, ClientInfo> } */
const rooms = new Map();
const loginAttempts = new Map();

function getOrCreateRoom(roomId) {
  let room = rooms.get(roomId);
  if (!room) {
    room = { professor: null, students: new Map() };
    rooms.set(roomId, room);
  }
  return room;
}

function send(ws, message) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
}

function normalizeName(value, fallback) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 60) || fallback;
}

function isProfessorEmail(email) {
  const normalized = String(email ?? "").trim().toLowerCase();
  return normalized.endsWith(PROFESSOR_DOMAIN) && !normalized.endsWith(STUDENT_DOMAIN) &&
    /^[^\s@]+@unibarretos\.com\.br$/.test(normalized);
}

function signSession(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", sessionSecret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifySession(token) {
  if (typeof token !== "string") return null;
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) return null;

  const expected = createHmac("sha256", sessionSecret).update(encoded).digest("base64url");
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length || !timingSafeEqual(receivedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (
      payload?.version !== 1 ||
      payload?.role !== "professor" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.exp !== "number" ||
      payload.exp <= Math.floor(Date.now() / 1000) ||
      !isProfessorEmail(payload.email)
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function requestOriginAllowed(req) {
  const origin = req.headers.origin;
  return !origin || corsOrigins.includes(origin);
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin && corsOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function respondJson(req, res, statusCode, body) {
  setCorsHeaders(req, res);
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_LOGIN_BODY_BYTES) throw new Error("Corpo da solicitação é muito grande.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function getLoginAttempt(ip) {
  const now = Date.now();
  const existing = loginAttempts.get(ip);
  if (!existing || now - existing.startedAt > 60_000) {
    const attempt = { startedAt: now, count: 0 };
    loginAttempts.set(ip, attempt);
    return attempt;
  }
  return existing;
}

function accessCodeMatches(value) {
  const received = Buffer.from(String(value ?? ""));
  const expected = Buffer.from(professorAccessCode);
  return expected.length > 0 && received.length === expected.length && timingSafeEqual(received, expected);
}

function removeClient(client) {
  if (!client) return;
  const room = rooms.get(client.roomId);
  if (!room) return;

  if (client.role === "professor" && room.professor === client) {
    room.professor = null;
    for (const student of room.students.values()) send(student.ws, { type: "room-closed" });
    room.students.clear();
  } else if (client.role === "aluno") {
    room.students.delete(client.id);
    if (room.professor) send(room.professor.ws, { type: "peer-left", id: client.id });
  }

  if (!room.professor && room.students.size === 0) rooms.delete(client.roomId);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (req.method === "OPTIONS") {
    if (!requestOriginAllowed(req)) return respondJson(req, res, 403, { error: "Origem não autorizada." });
    setCorsHeaders(req, res);
    res.writeHead(204).end();
    return;
  }

  if (req.method !== "POST" || url.pathname !== "/auth/demo/login") {
    respondJson(req, res, 404, { error: "Rota não encontrada." });
    return;
  }
  if (!requestOriginAllowed(req)) {
    respondJson(req, res, 403, { error: "Origem não autorizada." });
    return;
  }

  const ip = req.socket.remoteAddress ?? "unknown";
  const attempt = getLoginAttempt(ip);
  if (attempt.count >= 5) {
    respondJson(req, res, 429, { error: "Muitas tentativas. Aguarde um minuto antes de tentar novamente." });
    return;
  }

  try {
    const body = await readJson(req);
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!isProfessorEmail(email)) {
      attempt.count += 1;
      respondJson(req, res, 403, { error: "Use uma conta de professor @unibarretos.com.br." });
      return;
    }
    if (!accessCodeMatches(body.accessCode)) {
      attempt.count += 1;
      respondJson(req, res, 401, { error: "Código de demonstração inválido." });
      return;
    }

    loginAttempts.delete(ip);
    const now = Math.floor(Date.now() / 1000);
    const session = {
      version: 1,
      role: "professor",
      email,
      name: normalizeName(body.name, email.split("@")[0]),
      iat: now,
      exp: now + DEMO_SESSION_TTL_SECONDS,
      nonce: randomUUID(),
    };
    respondJson(req, res, 200, {
      token: signSession(session),
      profile: { name: session.name, email: session.email, role: session.role, expiresAt: session.exp },
    });
  } catch {
    respondJson(req, res, 400, { error: "Não foi possível processar o login." });
  }
});

const wss = new WebSocketServer({
  server,
  maxPayload: MAX_SIGNAL_PAYLOAD_BYTES,
  handleProtocols: protocols => (protocols.has("teachli-session") ? "teachli-session" : false),
});

wss.on("connection", (ws, req) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const roomId = (url.searchParams.get("room") || "").trim().toUpperCase();
  const requestedProfessor = url.searchParams.get("role") === "professor";
  const protocols = (req.headers["sec-websocket-protocol"] ?? "").split(",").map(value => value.trim());
  const session = verifySession(protocols.find(value => value.includes(".")));

  if (!roomId) {
    send(ws, { type: "error", message: "Código de sala ausente." });
    ws.close();
    return;
  }
  if (!/^[A-Z2-9]{6}$/.test(roomId)) {
    send(ws, { type: "error", message: "Código de sala inválido." });
    ws.close();
    return;
  }
  if (requestedProfessor && !session) {
    send(ws, { type: "error", message: "A sessão de professor é obrigatória para iniciar uma aula." });
    ws.close();
    return;
  }

  const role = requestedProfessor ? "professor" : "aluno";
  const name = role === "professor"
    ? session.name
    : normalizeName(url.searchParams.get("name"), "Aluno(a)");
  const room = getOrCreateRoom(roomId);
  const client = { id: randomUUID(), ws, roomId, role, name, email: session?.email };

  if (role === "professor") {
    if (room.professor) {
      send(ws, { type: "error", message: "Essa sala já tem um professor conectado." });
      ws.close();
      return;
    }
    room.professor = client;
    send(ws, { type: "joined", selfId: client.id, peers: [] });
  } else {
    if (!room.professor) {
      send(ws, { type: "error", message: "A aula ainda não começou — peça para o professor iniciar a sala primeiro." });
      ws.close();
      return;
    }
    room.students.set(client.id, client);
    send(ws, { type: "joined", selfId: client.id, peers: [room.professor.id] });
    send(room.professor.ws, { type: "peer-joined", id: client.id, name: client.name });
  }

  ws.on("message", raw => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (message?.type !== "signal" || typeof message.to !== "string") return;

    const target = room.professor?.id === message.to ? room.professor : room.students.get(message.to);
    if (target) send(target.ws, { type: "signal", from: client.id, data: message.data });
  });

  ws.on("close", () => removeClient(client));
  ws.on("error", () => removeClient(client));
});

server.listen(PORT, () => {
  console.log(`Servidor TeachLi ouvindo em http://localhost:${PORT} e ws://localhost:${PORT}`);
});
