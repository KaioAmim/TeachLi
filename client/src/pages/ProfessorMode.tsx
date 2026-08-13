import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Mic, MicOff, Volume2 } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import VLibrasWidget from "@/components/VLibrasWidget";

export default function ProfessorMode() {
  const [, setLocation] = useLocation();
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
    <div className="min-h-screen bg-background">
      <VLibrasWidget />
      <header className="bg-card border-b border-border">
        <div className="container py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setLocation('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Modo Professor - Fala para Libras</h1>
          <div className="w-24"></div>
        </div>
      </header>

      <main className="container py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Painel de Reconhecimento de Fala */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic className="w-5 h-5" />
                  Reconhecimento de Fala
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="min-h-[150px] p-4 bg-muted rounded-lg">
                  <p className="text-lg font-medium">
                    {currentSentence || (
                      <span className="text-muted-foreground italic">
                        {isRecording ? 'Ouvindo...' : 'Clique em iniciar para começar a falar'}
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex gap-2">
                  {!isRecording ? (
                    <Button 
                      className="flex-1" 
                      onClick={startRecording}
                    >
                      <Mic className="w-4 h-4 mr-2" />
                      Iniciar Gravação
                    </Button>
                  ) : (
                    <Button 
                      variant="destructive" 
                      className="flex-1" 
                      onClick={stopRecording}
                    >
                      <MicOff className="w-4 h-4 mr-2" />
                      Parar Gravação
                    </Button>
                  )}
                </div>

                {isRecording && (
                  <div className="flex items-center justify-center gap-2 p-3 bg-primary/10 rounded-lg">
                    <div className="w-3 h-3 rounded-full bg-primary animate-pulse"></div>
                    <span className="text-sm font-medium">Gravando...</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-accent/50">
              <CardHeader>
                <CardTitle className="text-lg">Instruções</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>• Clique em "Iniciar Gravação"</p>
                <p>• Fale claramente em português</p>
                <p>• O texto reconhecido aparecerá no painel de tradução</p>
                <p>• Ative o avatar VLibras para traduzi-lo para Libras</p>
                <p>• Clique em "Parar Gravação" quando terminar</p>
              </CardContent>
            </Card>
          </div>

          {/* Painel de Tradução Libras */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Volume2 className="w-5 h-5" />
                  Tradução em Libras
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="min-h-[150px] p-4 bg-muted rounded-lg">
                  <p className="text-lg font-medium" translate="no">
                    {currentSentence || (
                      <span className="text-muted-foreground italic">
                        O texto reconhecido aparecerá aqui para ser traduzido pelo avatar VLibras
                      </span>
                    )}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Clique no ícone azul do VLibras no canto da tela para ativar o avatar,
                  depois selecione o texto acima para vê-lo traduzido em Libras.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Histórico de Transcrição</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="max-h-[200px] overflow-y-auto p-4 bg-muted rounded-lg">
                  <p className="whitespace-pre-wrap text-sm">
                    {transcript || (
                      <span className="text-muted-foreground italic">
                        Nenhuma transcrição ainda...
                      </span>
                    )}
                  </p>
                </div>

                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={clearTranscript}
                >
                  Limpar Histórico
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-chart-2/5">
              <CardHeader>
                <CardTitle className="text-lg">Sobre VLibras</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  VLibras é um avatar que traduz conteúdo em português para Libras em tempo real.
                </p>
                <p>
                  Desenvolvido pelo governo brasileiro para acessibilidade.
                </p>
                <p>
                  <a href="https://www.vlibras.gov.br" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Saiba mais sobre VLibras
                  </a>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
