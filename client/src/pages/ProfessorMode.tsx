import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Mic, MicOff, Volume2, Loader } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function ProfessorMode() {
  const [, setLocation] = useLocation();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [currentSentence, setCurrentSentence] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
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
        translateToLibras(finalTranscript.trim());
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

  const translateToLibras = async (text: string) => {
    if (!text.trim()) return;
    
    setIsProcessing(true);
    try {
      console.log(`Traduzindo para Libras: "${text}"`);
      
      // Chamada para a API VLibras
      const response = await fetch('https://www.vlibras.gov.br/api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          voice: 'pt-BR',
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro na API VLibras: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.videoUrl) {
        setVideoUrl(data.videoUrl);
        toast.success('Vídeo de Libras gerado com sucesso!');
      } else if (data.url) {
        setVideoUrl(data.url);
        toast.success('Vídeo de Libras gerado com sucesso!');
      } else {
        throw new Error('Nenhuma URL de vídeo retornada');
      }
    } catch (error) {
      console.error('Erro ao traduzir para Libras:', error);
      toast.error('Erro ao gerar vídeo de Libras. Tente novamente.');
      
      // Fallback: usar simulação
      simulateLibrasTranslation(text);
    } finally {
      setIsProcessing(false);
    }
  };

  const simulateLibrasTranslation = (text: string) => {
    // Fallback para quando a API não está disponível
    const videoUrl = `https://www.vlibras.gov.br/video?text=${encodeURIComponent(text)}&voice=pt-BR`;
    setVideoUrl(videoUrl);
    toast.info(`Simulando tradução de: "${text}"`);
  };

  const startRecording = () => {
    if (recognitionRef.current) {
      setTranscript("");
      setVideoUrl(null);
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
    setVideoUrl(null);
    toast.info('Texto limpo');
  };

  return (
    <div className="min-h-screen bg-background">
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
                <p>• O sistema reconhecerá e traduzirá para Libras</p>
                <p>• Um vídeo será gerado automaticamente</p>
                <p>• Clique em "Parar Gravação" quando terminar</p>
              </CardContent>
            </Card>
          </div>

          {/* Painel de Vídeo Libras */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Volume2 className="w-5 h-5" />
                  Vídeo de Interpretação em Libras
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isProcessing && (
                  <div className="flex items-center justify-center gap-2 p-6 bg-muted rounded-lg">
                    <Loader className="w-5 h-5 animate-spin" />
                    <span>Gerando vídeo de Libras...</span>
                  </div>
                )}

                {videoUrl && !isProcessing && (
                  <div className="space-y-4">
                    <iframe
                      src={videoUrl}
                      width="100%"
                      height="400"
                      frameBorder="0"
                      allowFullScreen
                      className="rounded-lg"
                    />
                    <p className="text-sm text-muted-foreground">
                      Vídeo de interpretação em Libras gerado pela API VLibras
                    </p>
                  </div>
                )}

                {!videoUrl && !isProcessing && (
                  <div className="flex items-center justify-center p-12 bg-muted rounded-lg">
                    <div className="text-center">
                      <Volume2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        Fale algo para gerar o vídeo de Libras
                      </p>
                    </div>
                  </div>
                )}
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
