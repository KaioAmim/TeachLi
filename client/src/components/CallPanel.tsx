import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneCall, PhoneOff, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClassroomConnection } from "@/contexts/ClassroomContext";
import { useRoomCall } from "@/hooks/useRoomCall";

function RemoteVideo({ stream, label, muted }: { stream: MediaStream; label: string; muted?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]);
  return <figure className="call-remote">
    <video ref={ref} autoPlay playsInline muted={muted} aria-label={label} />
    <figcaption>{label}</figcaption>
  </figure>;
}

/**
 * Chamada da sala. O aluno envia a câmera sem áudio e vê o professor com as legendas;
 * o professor envia câmera e microfone e pode ouvir em voz alta as mensagens dos alunos.
 */
export function CallPanel({ role, studentStream }: { role: "aluno" | "professor"; studentStream?: MediaStream | null }) {
  const { messages, status, professor, students, lessonEndedAt } = useClassroomConnection();
  const [ownStream, setOwnStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [mediaError, setMediaError] = useState("");
  const [wantJoin, setWantJoin] = useState(false);
  const localStream = role === "aluno" ? studentStream ?? ownStream : ownStream;
  const call = useRoomCall(role, localStream);
  const localVideo = useRef<HTMLVideoElement>(null);

  useEffect(() => { if (localVideo.current) localVideo.current.srcObject = ownStream; }, [ownStream, role]);

  const stopOwn = () => { ownStream?.getTracks().forEach(track => track.stop()); setOwnStream(null); };
  const join = async () => {
    setMediaError("");
    if (!studentStream && !ownStream) {
      try {
        const media = role === "professor"
          ? { audio: { echoCancellation: true, noiseSuppression: true }, video: { width: 640, height: 480, facingMode: "user" } }
          : { audio: false, video: { width: 640, height: 480, facingMode: "user" } };
        const stream = await navigator.mediaDevices.getUserMedia(media);
        setOwnStream(stream); setMicOn(role === "professor"); setCamOn(true); setWantJoin(true);
      } catch { setMediaError("Não foi possível usar a câmera" + (role === "professor" ? " e o microfone" : "") + ". Verifique as permissões do navegador."); }
      return;
    }
    call.join();
  };
  // Entra na chamada só depois que o fluxo local já está no estado do hook.
  useEffect(() => { if (wantJoin && ownStream) { setWantJoin(false); call.join(); } }, [wantJoin, ownStream]); // eslint-disable-line react-hooks/exhaustive-deps
  const leave = () => { call.leave(); stopOwn(); };

  useEffect(() => { if (status !== "connected") stopOwn(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (role !== "professor" || !lessonEndedAt) return;
    call.leave();
    stopOwn();
  }, [lessonEndedAt, role]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { ownStream?.getTracks().forEach(track => track.stop()); }, [ownStream]);

  const toggle = (kind: "audio" | "video") => {
    const on = kind === "audio" ? !micOn : !camOn;
    ownStream?.getTracks().filter(t => t.kind === kind).forEach(t => { t.enabled = on; });
    if (kind === "audio") setMicOn(on); else setCamOn(on);
  };

  const latest = [...messages].reverse().find(m => m.role === (role === "aluno" ? "professor" : "aluno"));
  const connected = status === "connected";
  const waiting = role === "aluno" ? !professor : students === 0;
  const error = mediaError || call.error;

  return <section className="container call-panel" aria-label="Chamada da sala">
    <div className="call-header">
      <div>
        <strong><PhoneCall size={18} aria-hidden="true" /> Chamada ao vivo <span className="call-optional-label">Opcional</span></strong>
        <p role="status">{!connected ? "Entre em uma sala para usar a chamada." : call.inCall ? (call.remotes.length ? "Chamada em andamento" : waiting ? (role === "aluno" ? "Aguardando o professor entrar na chamada" : "Aguardando alunos") : "Conectando…") : "Você ainda não entrou na chamada"}</p>
      </div>
      <div className="call-actions">
        {call.inCall
          ? <Button variant="destructive" onClick={leave}><PhoneOff size={17} aria-hidden="true" /> Sair da chamada</Button>
          : <Button onClick={join} disabled={!connected}><PhoneCall size={17} aria-hidden="true" /> Entrar na chamada</Button>}
        {role === "professor" && call.inCall && <>
          <Button variant="outline" onClick={() => toggle("audio")} aria-pressed={!micOn}>{micOn ? <Mic size={17} aria-hidden="true" /> : <MicOff size={17} aria-hidden="true" />}{micOn ? "Silenciar" : "Ativar microfone"}</Button>
          <Button variant="outline" onClick={() => toggle("video")} aria-pressed={!camOn}>{camOn ? <Video size={17} aria-hidden="true" /> : <VideoOff size={17} aria-hidden="true" />}{camOn ? "Desligar câmera" : "Ligar câmera"}</Button>
        </>}
      </div>
    </div>
    <p className="call-description">Converse por vídeo com as pessoas da sua sala. Você pode sair da chamada a qualquer momento.</p>
    <details className="call-privacy"><summary>Como a chamada usa câmera e microfone</summary><p>Ao entrar, {role === "aluno" ? "sua câmera (sem áudio)" : "sua câmera e seu microfone"} são enviados diretamente aos participantes da sala. O TeachLi não grava a chamada nem recebe o vídeo e o áudio. A conexão usa um serviço STUN público, que pode ver seu endereço IP; algumas redes podem bloquear a chamada.</p></details>
    {error && <p className="room-error" role="alert">{error}</p>}
    {call.inCall && <div className="call-grid">
      <figure className="call-remote call-self"><video ref={localVideo} autoPlay playsInline muted aria-label="Sua câmera" /><figcaption>Você</figcaption></figure>
      {call.remotes.map((remote, index) => <RemoteVideo key={remote.id} stream={remote.stream} label={role === "aluno" ? "Professor" : `Aluno ${index + 1}`} />)}
    </div>}
    {call.inCall && <div className="call-caption" role="log" aria-live="polite" aria-label={role === "aluno" ? "Legenda da fala do professor" : "Texto dos sinais do aluno"}>
      {latest ? <><small>{role === "aluno" ? "Professor" : latest.author}</small><p>{latest.text}</p></> : <p className="room-hint">{role === "aluno" ? "A fala do professor aparecerá aqui como legenda." : "O que o aluno sinalizar aparecerá aqui como texto, depois que ele confirmar o envio."}</p>}
    </div>}

  </section>;
}
