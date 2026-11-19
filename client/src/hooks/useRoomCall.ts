import { useCallback, useEffect, useRef, useState } from "react";
import { useClassroomConnection } from "@/contexts/ClassroomContext";
import { ICE_SERVERS } from "@/lib/webrtc/config";

export interface RemoteParticipant { id: string; stream: MediaStream }

/**
 * Chamada de vídeo e áudio entre professor e alunos da sala, via WebRTC ponto a ponto.
 * O servidor de salas só retransmite a sinalização (SDP/ICE); a mídia não passa por ele.
 * Regras: o professor sempre cria a oferta; quem entra na chamada envia "hello" ao perfil
 * oposto; o aluno responde "hello" quando o professor entra depois dele.
 * `localStream` pertence a quem chama o hook: este hook nunca para as faixas dele.
 */
export function useRoomCall(role: "aluno" | "professor", localStream: MediaStream | null) {
  const { peers, sendSignal, onSignal, status } = useClassroomConnection();
  const [inCall, setInCall] = useState(false);
  const [remotes, setRemotes] = useState<RemoteParticipant[]>([]);
  const [error, setError] = useState("");
  const connections = useRef(new Map<string, RTCPeerConnection>());
  const queued = useRef(new Map<string, RTCIceCandidateInit[]>());
  const localRef = useRef(localStream);
  localRef.current = localStream;
  const inCallRef = useRef(false);

  const dropRemote = useCallback((id: string) => setRemotes(list => list.filter(r => r.id !== id)), []);

  const closePeer = useCallback((id: string) => {
    const connection = connections.current.get(id);
    if (connection) {
      connection.onicecandidate = null; connection.ontrack = null; connection.onconnectionstatechange = null;
      connection.close();
    }
    connections.current.delete(id); queued.current.delete(id); dropRemote(id);
  }, [dropRemote]);

  const createPeer = useCallback((id: string) => {
    closePeer(id);
    const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    connections.current.set(id, connection);
    const local = localRef.current;
    for (const track of local?.getTracks() ?? []) connection.addTrack(track, local!);
    connection.onicecandidate = event => { if (event.candidate) sendSignal(id, { kind: "candidate", candidate: event.candidate.toJSON() }); };
    connection.ontrack = event => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      setRemotes(list => list.some(r => r.id === id && r.stream === stream) ? list : [...list.filter(r => r.id !== id), { id, stream }]);
    };
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === "failed") {
        setError("Não foi possível estabelecer a chamada. A rede pode bloquear a conexão direta (pode ser necessário um servidor TURN).");
        closePeer(id);
      }
      if (connection.connectionState === "closed" || connection.connectionState === "disconnected") dropRemote(id);
    };
    return connection;
  }, [closePeer, dropRemote, sendSignal]);

  const flushCandidates = async (id: string, connection: RTCPeerConnection) => {
    for (const candidate of queued.current.get(id) ?? []) {
      try { await connection.addIceCandidate(candidate); } catch { /* candidato antigo */ }
    }
    queued.current.delete(id);
  };

  const offerTo = useCallback(async (id: string) => {
    const connection = createPeer(id);
    try {
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      sendSignal(id, { kind: "offer", sdp: offer.sdp });
    } catch { setError("Não foi possível iniciar a chamada."); closePeer(id); }
  }, [closePeer, createPeer, sendSignal]);

  // Sinalização recebida
  useEffect(() => onSignal(async (from, data) => {
    if (!inCallRef.current || typeof data?.kind !== "string") return;
    try {
      if (data.kind === "hello") {
        if (role === "professor") { if (!connections.current.has(from)) await offerTo(from); }
        else sendSignal(from, { kind: "hello" });
      } else if (data.kind === "offer" && role === "aluno" && typeof data.sdp === "string") {
        const connection = createPeer(from);
        await connection.setRemoteDescription({ type: "offer", sdp: data.sdp });
        await flushCandidates(from, connection);
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
        sendSignal(from, { kind: "answer", sdp: answer.sdp });
      } else if (data.kind === "answer" && typeof data.sdp === "string") {
        const connection = connections.current.get(from);
        if (connection && connection.signalingState === "have-local-offer") {
          await connection.setRemoteDescription({ type: "answer", sdp: data.sdp });
          await flushCandidates(from, connection);
        }
      } else if (data.kind === "candidate" && data.candidate && typeof data.candidate === "object") {
        const connection = connections.current.get(from);
        if (connection?.remoteDescription) {
          try { await connection.addIceCandidate(data.candidate as RTCIceCandidateInit); } catch { /* ignorado */ }
        } else queued.current.set(from, [...(queued.current.get(from) ?? []), data.candidate as RTCIceCandidateInit]);
      } else if (data.kind === "bye") closePeer(from);
    } catch {
      setError("Falha ao negociar a chamada. Saia e entre novamente.");
      closePeer(from);
    }
  }), [role, onSignal, sendSignal, createPeer, offerTo, closePeer]);

  const join = useCallback(() => {
    if (!localRef.current) {
      setError(role === "aluno" ? "Ligue a câmera antes de entrar na chamada." : "Permita câmera e microfone para entrar na chamada.");
      return false;
    }
    setError(""); inCallRef.current = true; setInCall(true);
    for (const peer of peers) sendSignal(peer.id, { kind: "hello" });
    return true;
  }, [peers, role, sendSignal]);

  const leave = useCallback(() => {
    for (const peer of peers) sendSignal(peer.id, { kind: "bye" });
    for (const id of [...connections.current.keys()]) closePeer(id);
    inCallRef.current = false; setInCall(false); setRemotes([]);
  }, [closePeer, peers, sendSignal]);

  // Participante novo (ou que saiu) durante a chamada.
  useEffect(() => {
    if (!inCall) return;
    const present = new Set(peers.map(p => p.id));
    for (const id of [...connections.current.keys()]) if (!present.has(id)) closePeer(id);
    for (const peer of peers) if (!connections.current.has(peer.id)) sendSignal(peer.id, { kind: "hello" });
  }, [peers, inCall, closePeer, sendSignal]);

  // Sala desconectada ou câmera desligada encerram a chamada.
  useEffect(() => {
    if (inCall && (status !== "connected" || !localStream)) {
      for (const id of [...connections.current.keys()]) closePeer(id);
      inCallRef.current = false; setInCall(false); setRemotes([]);
    }
  }, [status, localStream, inCall, closePeer]);

  useEffect(() => () => {
    for (const id of [...connections.current.keys()]) closePeer(id);
    inCallRef.current = false;
  }, [closePeer]);

  return { inCall, remotes, error, join, leave };
}
