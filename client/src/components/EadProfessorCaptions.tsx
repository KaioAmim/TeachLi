import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useClassroomConnection } from "@/contexts/ClassroomContext";

type SpeechRecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type SpeechRecognitionEvent = { resultIndex: number; results: ArrayLike<SpeechRecognitionResult> };
type SpeechRecognitionLike = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};

export function EadProfessorCaptions() {
  const { status, lessonEndedAt, send } = useClassroomConnection();
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const active = useRef(false);
  const sendRef = useRef(send);
  const statusRef = useRef(status);
  const endedRef = useRef(lessonEndedAt);
  sendRef.current = send;
  statusRef.current = status;
  endedRef.current = lessonEndedAt;

  useEffect(() => {
    const SpeechRecognition = (window as Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition
      ?? (window as Window & { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    setSupported(true);
    const instance = new SpeechRecognition();
    instance.lang = "pt-BR";
    instance.continuous = true;
    instance.interimResults = false;
    instance.onresult = event => {
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        const text = result?.[0]?.transcript?.trim();
        if (result?.isFinal && text) sendRef.current(text);
      }
    };
    instance.onerror = event => {
      if (["not-allowed", "service-not-allowed", "audio-capture"].includes(event.error)) {
        active.current = false;
        setListening(false);
      }
      if (event.error === "not-allowed") toast.error("Permita o microfone para compartilhar legendas com os alunos.");
      else if (event.error !== "no-speech") toast.error(`Não foi possível transcrever a fala: ${event.error}.`);
    };
    instance.onend = () => {
      if (!active.current || statusRef.current !== "connected" || endedRef.current) return;
      try { instance.start(); } catch { active.current = false; setListening(false); }
    };
    recognition.current = instance;
    return () => {
      active.current = false;
      instance.onend = null;
      instance.onresult = null;
      instance.onerror = null;
      instance.abort();
      recognition.current = null;
    };
  }, []);

  useEffect(() => {
    if ((status !== "connected" || lessonEndedAt) && active.current) {
      active.current = false;
      recognition.current?.stop();
      setListening(false);
    }
  }, [status, lessonEndedAt]);

  const toggle = () => {
    if (!recognition.current || status !== "connected" || lessonEndedAt) return;
    if (active.current) {
      active.current = false;
      recognition.current.stop();
      setListening(false);
      return;
    }
    try {
      active.current = true;
      recognition.current.start();
      setListening(true);
    } catch {
      active.current = false;
      setListening(false);
      toast.error("Não foi possível iniciar a transcrição. Tente novamente.");
    }
  };

  return <section className="ead-caption-control" aria-labelledby="ead-caption-title">
    <div>
      <h2 id="ead-caption-title">Legendas para o resumo</h2>
      <p>{!supported ? "Este navegador não oferece transcrição automática de fala." : "Ative para compartilhar a fala do professor como texto e incluí-la no resumo da aula."}</p>
    </div>
    <Button type="button" variant={listening ? "destructive" : "outline"} onClick={toggle} disabled={!supported || status !== "connected" || !!lessonEndedAt} aria-pressed={listening}>
      {listening ? <MicOff size={17} aria-hidden="true" /> : <Mic size={17} aria-hidden="true" />}
      {listening ? "Parar legendas" : "Ativar legendas"}
    </Button>
    <span className="ead-caption-status" role="status">{listening ? "Transcrevendo fala em português." : supported ? "Transcrição desligada." : "Transcrição indisponível."}</span>
  </section>;
}
