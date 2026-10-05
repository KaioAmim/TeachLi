export type Role = "professor" | "aluno";

export type SignalingEvent =
  | { type: "joined"; selfId: string; peers: string[] }
  | { type: "peer-joined"; id: string; name?: string }
  | { type: "peer-left"; id: string }
  | { type: "signal"; from: string; data: unknown }
  | { type: "room-closed" }
  | { type: "error"; message: string };

export interface SignalingClient {
  selfId: string;
  send: (to: string, data: unknown) => void;
  on: (handler: (event: SignalingEvent) => void) => () => void;
  close: () => void;
}

/**
 * Abre a conexão com o servidor de sinalização (ver server/ na raiz do
 * repo) e resolve quando o servidor confirma a entrada na sala com
 * {type:"joined"}. A partir daí, toda troca de SDP/ICE passa por
 * client.send/on — este módulo não sabe nada sobre WebRTC, só relaia
 * mensagens entre professor e aluno na mesma sala.
 */
export function connectSignaling(
  url: string,
  roomId: string,
  role: Role,
  name: string
): Promise<SignalingClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      `${url}?room=${encodeURIComponent(roomId)}&role=${role}&name=${encodeURIComponent(name)}`
    );
    const handlers = new Set<(event: SignalingEvent) => void>();
    let settled = false;

    ws.onmessage = ev => {
      let event: SignalingEvent;
      try {
        event = JSON.parse(ev.data);
      } catch {
        return;
      }

      if (event.type === "joined" && !settled) {
        settled = true;
        resolve({
          selfId: event.selfId,
          send: (to, data) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "signal", to, data }));
            }
          },
          on: handler => {
            handlers.add(handler);
            return () => handlers.delete(handler);
          },
          close: () => ws.close(),
        });
      }

      if (event.type === "error" && !settled) {
        settled = true;
        reject(new Error(event.message));
      }

      handlers.forEach(h => h(event));
    };

    ws.onerror = () => {
      if (!settled) {
        settled = true;
        reject(new Error("Falha ao conectar no servidor de sinalização."));
      }
    };

    ws.onclose = () => {
      if (!settled) {
        settled = true;
        reject(new Error("Conexão de sinalização encerrada antes de entrar na sala."));
      }
    };
  });
}
