/**
 * Servidores ICE da chamada. O STUN público resolve o endereço de cada lado, mas não
 * atravessa NAT simétrico nem firewalls restritivos (comuns em redes institucionais).
 * Para esses casos configure um servidor TURN próprio da instituição:
 * VITE_TURN_URL (ex.: turns:turn.exemplo.edu.br:443), VITE_TURN_USERNAME e VITE_TURN_CREDENTIAL.
 * Atenção: valores VITE_* ficam públicos no build; use credenciais TURN temporárias e limitadas.
 */
const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined;
const turnUser = import.meta.env.VITE_TURN_USERNAME as string | undefined;
const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined;

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  ...(turnUrl && turnUser && turnCredential ? [{ urls: turnUrl, username: turnUser, credential: turnCredential }] : []),
];
