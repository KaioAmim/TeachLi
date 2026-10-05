/**
 * STUN público do Google — resolve o endereço público de cada peer, mas não
 * ajuda quando um dos lados está atrás de um NAT simétrico ou firewall
 * restritivo (comum em redes escolares/corporativas). Nesse caso a conexão
 * P2P falha silenciosamente e só um servidor TURN resolveria — não incluído
 * aqui porque exige infraestrutura própria para retransmitir mídia (ver
 * server/README.md na raiz do repo).
 */
export const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

/** Sobrescreva com VITE_SIGNALING_URL num .env.local apontando para onde o
 * servidor em server/ estiver rodando (ver server/README.md). */
export const SIGNALING_URL =
  (import.meta.env.VITE_SIGNALING_URL as string | undefined) ?? "ws://localhost:8787";
