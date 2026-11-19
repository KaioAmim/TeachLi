import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneCall, PhoneOff, Video, VideoOff, Volume2 } from "lucide-react";
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
 * Chamada da sala. O aluno envia só a câmera que já usa para os gestos (sem áudio) e vê o
 * professor com a legenda da fala; o professor envia câmera e microfone e vê os alunos com o
 * texto reconhecido, que pode ser lido em voz alta.
 */
export function CallPanel({ role, studentStream }: { role: "aluno" | "professor"; studentStream?: MediaStream | null }) {
  const { messages, status, professor, students } = useClassroomConnection();
  const [ownStream, setOwnStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [wantJoin, setWantJoin] = useState(false);
  const localStream = role === "aluno" ? studentStream ?? null : ownStream;
  const call = useRoomCall(role, localStream);
  const spoken = useRef(new Set<string>());
  const localVideo = useRef<HTMLVideoElement>(null);

  useEffect(() => { if (localVideo.current) localVideo.current.srcObject = role === "professor" ? ownStream : null; }, [ownStream, role]);

  const stopOwn = () => { ownStream?.getTracks().forEach(track => track.stop()); setOwnStream(null); };
  const join = async () => {
    setMediaError("");
    if (role === "professor" && !ownStream) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: { width: 640, height: 480, facingMode: "user" } });
        setOwnStream(stream); setMicOn(true); setCamOn(true); setWantJoin(true);
      } catch { setMediaError("Não foi possível usar câmera e microfone. Verifique as permissões do navegador."); }
      return;
    }
    call.join();
  };
  // Entra na chamada só depois que o fluxo local já está no estado do hook.
  useEffect(() => { if (wantJoin && ownStream) { setWantJoin(false); call.join(); } }, [wantJoin, ownStream]); // eslint-disable-line react-hooks/exhaustive-deps
  const leave = () => { call.leave(); if (role === "professor") stopOwn(); };

  useEffect(() => { if (role === "professor" && status !== "connected") stopOwn(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { ownStream?.getTracks().forEach(track => track.stop()); }, [ownStream]);

  const toggle = (kind: "audio" | "video") => {
    const on = kind === "audio" ? !micOn : !camOn;
    ownStream?.getTracks().filter(t => t.kind === kind).forEach(t => { t.enabled = on; });
    if (kind === "audio") setMicOn(on); else setCamOn(on);
  };

  // Professor: lê em voz alta o texto novo dos alunos, quando ativado.
  useEffect(() => {
    if (role !== "professor" || !autoSpeak || !("speechSynthesis" in window)) return;
    for (const message of messages) {
      if (message.role !== "aluno" || spoken.current.has(message.id)) continue;
      spoken.current.add(message.id);
      const utterance = new SpeechSynthesisUtterance(message.text); utterance.lang = "pt-BR"; window.speechSynthesis.speak(utterance);
    }
  }, [messages, autoSpeak, role]);
  useEffect(() => { if (!autoSpeak) window.speechSynthesis?.cancel(); }, [autoSpeak]);

  const latest = [...messages].reverse().find(m => m.role === (role === "aluno" ? "professor" : "aluno"));
  const connected = status === "connected";
  const waiting = role === "aluno" ? !professor : students === 0;
  const error = mediaError || call.error;

  return <section className="container call-panel" aria-label="Chamada da sala">
    <div className="call-header">
      <div>
        <strong><PhoneCall size={18} aria-hidden="true" /> Chamada da aula</strong>
        <p role="status">{!connected ? "Entre em uma sala para usar a chamada." : call.inCall ? (call.remotes.length ? "Chamada em andamento" : waiting ? (role === "aluno" ? "Aguardando o professor entrar na chamada" : "Aguardando alunos") : "Conectando…") : "Você ainda não entrou na chamada"}</p>
      </div>
      <div className="call-actions">
        {call.inCall
          ? <Button variant="destructive" onClick={leave}><PhoneOff size={17} aria-hidden="true" /> Sair da chamada</Button>
          : <Button onClick={join} disabled={!connected || (role === "aluno" && !studentStream)}><PhoneCall size={17} aria-hidden="true" /> Entrar na chamada</Button>}
        {role === "professor" && call.inCall && <>
          <Button variant="outline" onClick={() => toggle("audio")} aria-pressed={!micOn}>{micOn ? <Mic size={17} aria-hidden="true" /> : <MicOff size={17} aria-hidden="true" />}{micOn ? "Silenciar" : "Ativar microfone"}</Button>
          <Button variant="outline" onClick={() => toggle("video")} aria-pressed={!camOn}>{camOn ? <Video size={17} aria-hidden="true" /> : <VideoOff size={17} aria-hidden="true" />}{camOn ? "Desligar câmera" : "Ligar câmera"}</Button>
        </>}
      </div>
    </div>
    {role === "aluno" && !studentStream && <p className="room-hint">Ligue a câmera em “Reconhecimento de gestos” para entrar na chamada. O professor verá seus sinais.</p>}
    <p className="room-hint">Privacidade: ao entrar, {role === "aluno" ? "sua câmera (sem áudio)" : "sua câmera e seu microfone"} serão transmitidos direto ao {role === "aluno" ? "professor" : "aluno"} da sala. A chamada não é gravada nem passa pelo servidor do TeachLi; a conexão usa um servidor STUN público para descobrir o endereço de rede.</p>
    {error && <p className="room-error" role="alert">{error}</p>}
    {call.inCall && <div className="call-grid">
      {role === "professor" && <figure className="call-remote call-self"><video ref={localVideo} autoPlay playsInline muted aria-label="Sua câmera" /><figcaption>Você</figcaption></figure>}
      {call.remotes.map((remote, index) => <RemoteVideo key={remote.id} stream={remote.stream} label={role === "aluno" ? "Professor" : `Aluno ${index + 1}`} />)}
    </div>}
    {call.inCall && <div className="call-caption" role="log" aria-live="polite" aria-label={role === "aluno" ? "Legenda da fala do professor" : "Texto dos sinais do aluno"}>
      {latest ? <><small>{role === "aluno" ? "Professor" : latest.author}</small><p>{latest.text}</p></> : <p className="room-hint">{role === "aluno" ? "A fala do professor aparecerá aqui como legenda." : "O que o aluno sinalizar aparecerá aqui como texto, depois que ele confirmar o envio."}</p>}
    </div>}
    {role === "professor" && <label className="call-autospeak"><input type="checkbox" role="switch" checked={autoSpeak} onChange={e => setAutoSpeak(e.target.checked)} /> <Volume2 size={16} aria-hidden="true" /> Ler em voz alta o texto dos sinais do aluno</label>}
  </section>;
}
