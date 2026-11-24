import { ClassroomPanel } from "@/components/ClassroomPanel";
import { useClassroomConnection } from "@/contexts/ClassroomContext";
import { RoomStatus, WorkspaceHeading } from "@/components/AppShell";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Languages, Trash2, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { FinishLessonControl } from "@/components/LessonControls";
import { LessonRecorder } from "@/components/LessonRecorder";

export default function ProfessorMode() {
  const classroom = useClassroomConnection();
  const sendRef = useRef(classroom.send);
  sendRef.current = classroom.send;
  const recordingRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [currentSentence, setCurrentSentence] = useState("");

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Verificar suporte do navegador para Web Speech API
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Seu navegador não suporta reconhecimento de fala. Use Chrome ou Edge.');
      return;
    }

    // Criar instância do reconhecedor de fala
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        setTranscript(prev => prev + finalTranscript);
        sendRef.current(finalTranscript.trim());
        setCurrentSentence(finalTranscript.trim());
      } else {
        setCurrentSentence(interimTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Erro no reconhecimento de fala:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture') {
        recordingRef.current = false;
        setIsRecording(false);
      }
      if (event.error === 'no-speech') {
        toast.error('Nenhuma fala detectada. Fale mais alto ou verifique o microfone.');
      } else if (event.error === 'not-allowed') {
        toast.error('Permissão de microfone negada. Habilite o acesso ao microfone.');
      } else {
        toast.error(`Erro: ${event.error}`);
      }
    };

    recognition.onend = () => {
      if (recordingRef.current) {
        try { recognition.start(); } catch { recordingRef.current = false; setIsRecording(false); }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recordingRef.current = false;
        recognitionRef.current.onend = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (classroom.status !== "connected") { recordingRef.current = false; recognitionRef.current?.stop(); setIsRecording(false); }
  }, [classroom.status]);

  useEffect(() => {
    if (classroom.lessonEndedAt && recordingRef.current) {
      recordingRef.current = false;
      recognitionRef.current?.stop();
      setIsRecording(false);
      setCurrentSentence("");
    }
  }, [classroom.lessonEndedAt]);

  const startRecording = () => {
    if (classroom.lessonEndedAt) return;
    if (recognitionRef.current) {
      setTranscript("");
      recordingRef.current = true;
      try {
        recognitionRef.current.start();
        setIsRecording(true);
        toast.success('Gravação iniciada. Fale algo!');
      } catch {
        recordingRef.current = false;
        setIsRecording(false);
        toast.error('Não foi possível iniciar o microfone. Tente novamente.');
      }
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recordingRef.current = false;
      recognitionRef.current.stop();
      setIsRecording(false);
      toast.info('Gravação parada');
    }
  };

  const clearTranscript = () => {
    setTranscript("");
    setCurrentSentence("");
    toast.info('Texto limpo');
  };

  return (
    <div className="workspace-page professor-workspace">
      <WorkspaceHeading title="Sua fala em texto" description="Acompanhe as legendas ao vivo e compartilhe com quem está na sala.">
        <div className="lesson-heading-actions"><RoomStatus /><FinishLessonControl /></div>
      </WorkspaceHeading>

      <main id="conteudo" tabIndex={-1} className="container workspace-content">
        <section className="professor-broadcast" aria-labelledby="speech-title">
          <div className="professor-broadcast-main">
            <div className="professor-speaking-heading">
              <div><p className="professor-section-label">Transcrição da aula</p><h2 id="speech-title">Fala do professor</h2></div>
              <span className="professor-recording-status" data-recording={isRecording} role="status"><i aria-hidden="true" />{isRecording ? "Ouvindo" : "Microfone desligado"}</span>
            </div>
            <div className="professor-live-text" data-empty={!currentSentence} aria-label="Fala atual" aria-live="polite" aria-atomic="true">
              {currentSentence ? <p>{currentSentence}</p> : (
                <div className="professor-empty-state">
                  <span className="professor-mic-outline"><Mic size={26} strokeWidth={1.5} aria-hidden="true" /></span>
                  <strong>{isRecording ? "Pode falar. Estamos ouvindo." : "A legenda aparece aqui"}</strong>
                  <p>{isRecording ? "Sua fala aparecerá aqui em instantes." : "Inicie o microfone para compartilhar a transcrição com os alunos."}</p>
                </div>
              )}
            </div>
            <div className="professor-recording-toolbar">
              <Button disabled={classroom.status !== "connected" || !!classroom.lessonEndedAt} variant={isRecording ? "destructive" : "default"} onClick={isRecording ? stopRecording : startRecording}>
                {isRecording ? <MicOff size={18} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
                {isRecording ? "Parar microfone" : "Ativar microfone"}
              </Button>
              <p>{classroom.lessonEndedAt ? "A aula foi finalizada. O conteúdo não pode mais ser enviado." : isRecording ? "As frases reconhecidas estão sendo enviadas para a sala." : "As frases finalizadas serão compartilhadas em tempo real."}</p>
            </div>
          </div>

          <ClassroomPanel compact embedded showAutoSpeak />
        </section>

        <LessonRecorder />

        <section className="professor-history-section" role="region" aria-labelledby="history-title">
          <div className="professor-history-heading">
            <div><p className="professor-section-label">Nesta sessão</p><h2 id="history-title">Transcrição anterior</h2></div>
            <Button variant="ghost" className="professor-clear" onClick={clearTranscript} disabled={!transcript && !currentSentence}><Trash2 size={16} aria-hidden="true" /> Limpar</Button>
          </div>
          <div className="professor-history" tabIndex={transcript ? 0 : undefined} aria-label="Histórico de transcrição">
            <p className={transcript ? undefined : "professor-placeholder"}>{transcript || "As frases reconhecidas nesta sessão aparecerão aqui."}</p>
          </div>
          <p className="professor-history-note">O histórico é apagado quando você inicia uma nova gravação.</p>
        </section>
        <aside className="professor-libras-note"><Languages size={17} aria-hidden="true" /><span>Apoio em Libras: selecione uma frase e use o avatar VLibras no canto da tela.</span><a href="https://www.vlibras.gov.br" target="_blank" rel="noopener noreferrer">Conheça o VLibras<ArrowUpRight size={14} aria-hidden="true" /></a></aside>
      </main>
    </div>
  );
}
