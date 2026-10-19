import { WorkspaceHeading } from "@/components/AppShell";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Mic, MicOff, FileText, Languages, Trash2, ChevronDown, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import VLibrasWidget from "@/components/VLibrasWidget";

export default function ProfessorMode() {
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
        setCurrentSentence(finalTranscript.trim());
      } else {
        setCurrentSentence(interimTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Erro no reconhecimento de fala:', event.error);
      if (event.error === 'no-speech') {
        toast.error('Nenhuma fala detectada. Fale mais alto ou verifique o microfone.');
      } else if (event.error === 'not-allowed') {
        toast.error('Permissão de microfone negada. Habilite o acesso ao microfone.');
      } else {
        toast.error(`Erro: ${event.error}`);
      }
    };

    recognition.onend = () => {
      if (isRecording) {
        recognition.start();
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isRecording]);

  const startRecording = () => {
    if (recognitionRef.current) {
      setTranscript("");
      recognitionRef.current.start();
      setIsRecording(true);
      toast.success('Gravação iniciada. Fale algo!');
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
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
      <VLibrasWidget />
      <WorkspaceHeading title="A sua fala, mais acessível." description="Fale, acompanhe a transcrição e compartilhe com a turma." />

      <main id="conteudo" tabIndex={-1} className="container workspace-content">
        <div className="professor-layout">
          <div className="professor-main-column">
            <Card className="professor-panel professor-live-panel" role="region" aria-labelledby="speech-title">
              <CardHeader className="professor-panel-header">
                <div className="professor-title-row">
                  <span className="professor-tool-icon"><Mic size={21} aria-hidden="true" /></span>
                  <div><h2 id="speech-title">Sua fala em texto</h2><p>Acompanhe a frase enquanto você fala.</p></div>
                </div>
                <span className="professor-recording-status" data-recording={isRecording} role="status"><i aria-hidden="true" />{isRecording ? "Ouvindo" : "Microfone desligado"}</span>
              </CardHeader>
              <CardContent>
                <div className="professor-live-text" data-empty={!currentSentence} aria-label="Fala atual" aria-live="polite" aria-atomic="true">
                  {currentSentence ? <p>{currentSentence}</p> : (
                    <div className="professor-empty-state">
                      <span className="professor-mic-outline"><Mic size={28} strokeWidth={1.5} aria-hidden="true" /></span>
                      <strong>{isRecording ? "Pode falar. Estamos ouvindo." : "Tudo pronto para a sua voz"}</strong>
                      <p>{isRecording ? "Sua fala aparecerá aqui em instantes." : "Inicie a gravação e fale em português. O texto aparecerá aqui."}</p>
                    </div>
                  )}
                </div>
                <div className="professor-recording-toolbar">
                  <Button variant={isRecording ? "destructive" : "default"} onClick={isRecording ? stopRecording : startRecording}>
                    {isRecording ? <MicOff size={18} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
                    {isRecording ? "Parar gravação" : "Iniciar gravação"}
                  </Button>
                  <p>{isRecording ? "Ao terminar, pare a gravação para revisar o texto." : "Permita o acesso ao microfone para começar."}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="professor-panel" role="region" aria-labelledby="history-title">
              <CardHeader className="professor-panel-header">
                <div className="professor-title-row">
                  <span className="professor-tool-icon professor-tool-icon-muted"><FileText size={21} aria-hidden="true" /></span>
                  <div><h2 id="history-title">Histórico da fala</h2><p>As frases reconhecidas ficam reunidas aqui.</p></div>
                </div>
                <Button variant="ghost" className="professor-clear" onClick={clearTranscript} disabled={!transcript && !currentSentence}><Trash2 size={16} aria-hidden="true" /> Limpar histórico</Button>
              </CardHeader>
              <CardContent>
                <div className="professor-history" tabIndex={transcript ? 0 : undefined} aria-label="Histórico de transcrição">
                  <p className={transcript ? undefined : "professor-placeholder"}>{transcript || "Ainda não há transcrição. Suas frases aparecerão conforme você falar."}</p>
                </div>
                <p className="professor-history-note">Ao iniciar uma nova gravação, o histórico anterior é limpo.</p>
              </CardContent>
            </Card>
          </div>

          <aside className="professor-support" aria-labelledby="libras-title">
            <div className="professor-support-heading"><span className="professor-tool-icon professor-tool-icon-warm"><Languages size={23} aria-hidden="true" /></span><span>Apoio à comunicação</span></div>
            <h2 id="libras-title">Leve o texto <br />para Libras.</h2>
            <p>Use o avatar VLibras para apoiar a tradução do texto da sua fala.</p>
            <ol className="professor-steps">
              <li><span aria-hidden="true">1</span><div><strong>Abra o tradutor</strong><p>Clique no ícone azul do VLibras no canto da tela.</p></div></li>
              <li><span aria-hidden="true">2</span><div><strong>Escolha o texto</strong><p>Com o avatar aberto, selecione a frase ou um trecho do histórico.</p></div></li>
              <li><span aria-hidden="true">3</span><div><strong>Acompanhe o avatar</strong><p>Veja a tradução do trecho selecionado em Libras.</p></div></li>
            </ol>
            <details className="professor-help">
              <summary>Dicas para uma boa transcrição<ChevronDown size={17} aria-hidden="true" /></summary>
              <div><p>Fale com clareza e faça pequenas pausas entre as frases. Prefira um ambiente com pouco ruído.</p><p>Se o reconhecimento não estiver disponível, tente usar Chrome ou Edge.</p></div>
            </details>
            <a className="professor-about-link" href="https://www.vlibras.gov.br" target="_blank" rel="noopener noreferrer">Conheça o VLibras<ArrowUpRight size={15} aria-hidden="true" /></a>
          </aside>
        </div>
      </main>
    </div>
  );
}
