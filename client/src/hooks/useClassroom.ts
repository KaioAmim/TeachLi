import { useCallback, useEffect, useRef, useState } from "react";
import { connectSignaling, type SignalingClient, type Role } from "@/lib/webrtc/signalingClient";
import { ICE_SERVERS, SIGNALING_URL } from "@/lib/webrtc/config";

export interface RemotePeer {
  id: string;
  name?: string;
  stream: MediaStream | null;
}

export interface UseClassroomOptions {
  roomId: string;
  role: Role;
  name: string;
}

export type ClassroomStatus = "connecting" | "connected" | "error";

type SignalPayload =
  | { kind: "offer"; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; sdp: RTCSessionDescriptionInit }
  | { kind: "ice-candidate"; candidate: RTCIceCandidateInit };

/**
 * Topologia em estrela: o professor mantém uma RTCPeerConnection com cada
 * aluno conectado (não é mesh — alunos não se conectam entre si). Quem já
 * está na sala sempre inicia a oferta para quem chega, o que evita os dois
 * lados ofertarem ao mesmo tempo ("glare"), já que só existe um par
 * possível por conexão (professor↔aluno).
 *
 * Isso custa banda de upload ao professor proporcional ao nº de alunos —
 * cada stream de vídeo é enviado individualmente. Funciona bem para turmas
 * pequenas; para turmas grandes, o próximo passo seria um SFU (ex.
 * mediasoup, LiveKit) em vez de P2P puro.
 */
export function useClassroom({ roomId, role, name }: UseClassroomOptions) {
  const [status, setStatus] = useState<ClassroomStatus>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Record<string, RemotePeer>>({});

  const signalingRef = useRef<SignalingClient | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  const closePeer = useCallback((id: string) => {
    peerConnectionsRef.current.get(id)?.close();
    peerConnectionsRef.current.delete(id);
    setPeers(prev => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const createPeerConnection = useCallback((peerId: string, signaling: SignalingClient) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConnectionsRef.current.set(peerId, pc);

    localStreamRef.current?.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current!);
    });

    pc.onicecandidate = ev => {
      if (ev.candidate) {
        signaling.send(peerId, { kind: "ice-candidate", candidate: ev.candidate.toJSON() });
      }
    };

    pc.ontrack = ev => {
      setPeers(prev => ({
        ...prev,
        [peerId]: { id: peerId, name: prev[peerId]?.name, stream: ev.streams[0] ?? null },
      }));
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        closePeer(peerId);
      }
    };

    return pc;
  }, [closePeer]);

  useEffect(() => {
    let cancelled = false;
    setStatus("connecting");
    setErrorMessage(null);

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);

        const signaling = await connectSignaling(SIGNALING_URL, roomId, role, name);
        if (cancelled) {
          signaling.close();
          return;
        }
        signalingRef.current = signaling;

        signaling.on(event => {
          if (event.type === "peer-joined") {
            setPeers(prev => ({
              ...prev,
              [event.id]: { id: event.id, name: event.name, stream: prev[event.id]?.stream ?? null },
            }));
            const pc = createPeerConnection(event.id, signaling);
            pc.createOffer()
              .then(offer => pc.setLocalDescription(offer).then(() => offer))
              .then(offer => signaling.send(event.id, { kind: "offer", sdp: offer }))
              .catch(err => console.error("Falha ao criar oferta:", err));
            return;
          }

          if (event.type === "peer-left") {
            closePeer(event.id);
            return;
          }

          if (event.type === "room-closed") {
            setStatus("error");
            setErrorMessage("O professor encerrou a aula.");
            return;
          }

          if (event.type === "signal") {
            const data = event.data as SignalPayload;
            let pc = peerConnectionsRef.current.get(event.from);

            if (data.kind === "offer") {
              if (!pc) pc = createPeerConnection(event.from, signaling);
              pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
                .then(() => pc!.createAnswer())
                .then(answer => pc!.setLocalDescription(answer).then(() => answer))
                .then(answer => signaling.send(event.from, { kind: "answer", sdp: answer }))
                .catch(err => console.error("Falha ao responder oferta:", err));
            } else if (data.kind === "answer" && pc) {
              pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).catch(err =>
                console.error("Falha ao aplicar resposta:", err)
              );
            } else if (data.kind === "ice-candidate" && pc) {
              pc.addIceCandidate(data.candidate).catch(err =>
                console.error("Falha ao adicionar candidato ICE:", err)
              );
            }
          }
        });

        if (!cancelled) setStatus("connected");
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Falha ao entrar na sala.");
      }
    })();

    return () => {
      cancelled = true;
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      peerConnectionsRef.current.forEach(pc => pc.close());
      peerConnectionsRef.current.clear();
      signalingRef.current?.close();
      signalingRef.current = null;
    };
    // As dependências abaixo não devem disparar reconexão a cada render —
    // só entrar/sair da sala deve reiniciar tudo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, role, name]);

  return { status, errorMessage, localStream, peers: Object.values(peers) };
}
