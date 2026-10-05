// Servidor de sinalização para a Sala de Aula (ver client/src/pages/Classroom.tsx).
//
// Este servidor NUNCA vê áudio/vídeo — só relaia mensagens de texto pequenas
// (SDP e candidatos ICE) para que o professor e cada aluno estabeleçam uma
// conexão WebRTC direta entre si. Depois que a conexão P2P é criada, a mídia
// não passa mais por aqui.
//
// Topologia: estrela. O professor mantém uma conexão com cada aluno; alunos
// não se conectam entre si. Por sala, no máximo um professor.
//
// Rodar localmente:
//   npm install
//   npm start            (escuta em ws://localhost:8787 por padrão)
//
// Hospedar (o client é estático — GitHub Pages não roda isto): qualquer
// serviço que rode um processo Node de longa duração serve, por exemplo
// Render, Railway ou Fly.io (todos têm um nível gratuito/hobby). Depois de
// hospedado, aponte o client para a URL pública com:
//   VITE_SIGNALING_URL=wss://seu-servidor.exemplo.com  (no client/.env.local)

import { WebSocketServer } from "ws";
import { randomUUID } from "node:crypto";

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;

/** roomId -> { professor: ClientInfo | null, students: Map<id, ClientInfo> } */
const rooms = new Map();

function getOrCreateRoom(roomId) {
  let room = rooms.get(roomId);
  if (!room) {
    room = { professor: null, students: new Map() };
    rooms.set(roomId, room);
  }
  return room;
}

function send(ws, message) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function removeClient(client) {
  if (!client) return;
  const room = rooms.get(client.roomId);
  if (!room) return;

  if (client.role === "professor" && room.professor === client) {
    room.professor = null;
    for (const student of room.students.values()) {
      send(student.ws, { type: "room-closed" });
    }
    room.students.clear();
  } else if (client.role === "aluno") {
    room.students.delete(client.id);
    if (room.professor) {
      send(room.professor.ws, { type: "peer-left", id: client.id });
    }
  }

  if (!room.professor && room.students.size === 0) {
    rooms.delete(client.roomId);
  }
}

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, "http://localhost");
  const roomId = (url.searchParams.get("room") || "").trim().toUpperCase();
  const role = url.searchParams.get("role") === "professor" ? "professor" : "aluno";
  const name = (url.searchParams.get("name") || "").slice(0, 60) || (role === "professor" ? "Professor(a)" : "Aluno(a)");

  if (!roomId) {
    send(ws, { type: "error", message: "Código de sala ausente." });
    ws.close();
    return;
  }

  const room = getOrCreateRoom(roomId);
  const client = { id: randomUUID(), ws, roomId, role, name };

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
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg?.type !== "signal" || typeof msg.to !== "string") return;

    const target =
      room.professor?.id === msg.to
        ? room.professor
        : room.students.get(msg.to);
    if (target) {
      send(target.ws, { type: "signal", from: client.id, data: msg.data });
    }
  });

  ws.on("close", () => removeClient(client));
  ws.on("error", () => removeClient(client));
});

console.log(`Servidor de sinalização da Sala de Aula ouvindo em ws://localhost:${PORT}`);
