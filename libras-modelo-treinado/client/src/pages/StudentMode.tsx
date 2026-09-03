import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Video, VideoOff, Volume2, Zap, GraduationCap } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useHandLandmarker } from "@/hooks/useHandLandmarker";
import { useGestureClassifier } from "@/hooks/useGestureClassifier";
import type { HandDetectionResult } from "@/lib/librasGestureDatabase";

interface RecognitionResult {
  gesture: string;
  confidence: number;
}

/** Frames consecutivos com o mesmo rótulo antes de registrar no histórico. */
const STABLE_FRAMES = 6;
/** Intervalo mínimo entre atualizações de estado (evita re-render a 60fps). */
const UI_THROTTLE_MS = 80;

export default function StudentMode() {
  const [, setLocation] = useLocation();
  const [isCapturing, setIsCapturing] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");
  const [currentGesture, setCurrentGesture] = useState("");
  const [currentConfidence, setCurrentConfidence] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [gestureHistory, setGestureHistory] = useState<RecognitionResult[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const { handLandmarker, isLoading: isHandLandmarkerLoading, error: handLandmarkerError, detectHands } = useHandLandmarker();
  const {
    hasModel,
    labels: modelLabels,
    source: modelSource,
    isLoading: isClassifierLoading,
    predict: predictGesture,
  } = useGestureClassifier();

  const stableRef = useRef<{ label: string; count: number }>({ label: "", count: 0 });
  const lastUiUpdateRef = useRef(0);
  const lastCommittedRef = useRef("");

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [stream]);

  useEffect(() => {
    if (!isCapturing || !videoRef.current || !handLandmarker) return;

    const processFrame = () => {
      const video = videoRef.current;
      if (!video || !video.videoWidth) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }

      const timestamp = performance.now();
      const detectionResult = detectHands(video, timestamp);

      if (detectionResult && detectionResult.landmarks.length > 0) {
        const prediction = predictGesture(detectionResult.landmarks[0] as any);

        if (prediction) {
          // Janela de estabilidade: só considera o gesto quando o mesmo rótulo
          // se repete por vários frames, o que evita a oscilação quadro a quadro
          // e impede o histórico de encher com duplicatas do mesmo sinal.
          const stable = stableRef.current;
          if (prediction.label === stable.label) {
            stable.count += 1;
          } else {
            stable.label = prediction.label;
            stable.count = 1;
          }

          const now = performance.now();
          if (now - lastUiUpdateRef.current > UI_THROTTLE_MS) {
            lastUiUpdateRef.current = now;
            setCurrentGesture(prediction.label);
            setCurrentConfidence(Math.round(prediction.confidence * 100));
          }

          if (
            stable.count === STABLE_FRAMES &&
            prediction.confidence > 0.75 &&
            prediction.label !== lastCommittedRef.current
          ) {
            lastCommittedRef.current = prediction.label;
            setGestureHistory(prev => [
              ...prev.slice(-9),
              { gesture: prediction.label, confidence: prediction.confidence },
            ]);
          }
        }
      } else {
        stableRef.current = { label: "", count: 0 };
        lastCommittedRef.current = "";
      }

      if (canvasRef.current && detectionResult) {
        drawLandmarks(canvasRef.current, detectionResult);
      }

      animationFrameRef.current = requestAnimationFrame(processFrame);
    };

    animationFrameRef.current = requestAnimationFrame(processFrame);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isCapturing, handLandmarker, detectHands, predictGesture]);

  const drawLandmarks = (canvas: HTMLCanvasElement, detectionResult: HandDetectionResult) => {
    const ctx = canvas.getContext('2d');
    if (!ctx || !videoRef.current) return;

    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    detectionResult.landmarks.forEach((landmarks: any, handIndex: number) => {
      const color = handIndex === 0 ? '#FF6B6B' : '#4ECDC4';
      
      landmarks.forEach((landmark: any) => {
        const x = landmark.x * canvas.width;
        const y = landmark.y * canvas.height;
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
      });

      const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [0, 5], [5, 6], [6, 7], [7, 8],
        [0, 9], [9, 10], [10, 11], [11, 12],
        [0, 13], [13, 14], [14, 15], [15, 16],
        [0, 17], [17, 18], [18, 19], [19, 20],
      ];

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      connections.forEach(([start, end]) => {
        const startLandmark = landmarks[start];
        const endLandmark = landmarks[end];
        ctx.beginPath();
        ctx.moveTo(startLandmark.x * canvas.width, startLandmark.y * canvas.height);
        ctx.lineTo(endLandmark.x * canvas.width, endLandmark.y * canvas.height);
        ctx.stroke();
      });
    });
  };

  const startCapture = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 640, 
          height: 480,
          facingMode: 'user'
        } 
      });
      
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      
      setIsCapturing(true);
      toast.success('Câmera iniciada - MediaPipe Hands ativado');
      
    } catch (error) {
      console.error('Erro ao acessar câmera:', error);
      toast.error('Erro ao acessar câmera. Verifique as permissões.');
    }
  };

  const stopCapture = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsCapturing(false);
    toast.info('Câmera desligada');
  };

  const speakText = (text: string) => {
    if (!text.trim()) return;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    const voices = window.speechSynthesis.getVoices();
    const ptBRVoice = voices.find(voice => voice.lang === 'pt-BR');
    if (ptBRVoice) {
      utterance.voice = ptBRVoice;
    }
    
    window.speechSynthesis.speak(utterance);
    toast.success(`Falando: "${text}"`);
  };

  const clearText = () => {
    setRecognizedText("");
    setCurrentGesture("");
    setGestureHistory([]);
    setCurrentConfidence(0);
    toast.info('Texto limpo');
  };

  const addGestureToText = () => {
    if (currentGesture) {
      const gestureText = currentGesture.replace(/\[(ESQ|DIR)\]\s*/g, '').trim();
      setRecognizedText(prev => prev + gestureText + ' ');
      speakText(gestureText);
      toast.success(`Adicionado: ${gestureText}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="container py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setLocation('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Modo Aluno - MediaPipe Hands</h1>
          <Button variant="ghost" onClick={() => setLocation('/aluno/treinar')}>
            <GraduationCap className="w-4 h-4 mr-2" />
            Treinar Gestos
          </Button>
        </div>
      </header>

      <main className="container py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="w-5 h-5" />
                  Captura de Gestos com MediaPipe
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="video-container bg-black relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full"
                  />
                  {!isCapturing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted">
                      <div className="text-center">
                        <Video className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">
                          Clique em "Iniciar Câmera" para começar
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {!isCapturing ? (
                    <Button 
                      className="flex-1" 
                      onClick={startCapture}
                    >
                      <Video className="w-4 h-4 mr-2" />
                      Iniciar Câmera
                    </Button>
                  ) : (
                    <Button 
                      variant="destructive" 
                      className="flex-1" 
                      onClick={stopCapture}
                    >
                      <VideoOff className="w-4 h-4 mr-2" />
                      Parar Câmera
                    </Button>
                  )}
                </div>

                {isCapturing && (
                  <div className="space-y-2">
                    <div className="text-center">
                      <span className="status-badge ready">
                        <span className="w-2 h-2 rounded-full bg-chart-2 animate-pulse"></span>
                        Câmera Ativa
                      </span>
                    </div>
                    {isHandLandmarkerLoading && (
                      <p className="text-sm text-muted-foreground text-center">Carregando MediaPipe...</p>
                    )}
                    {handLandmarkerError && (
                      <p className="text-sm text-destructive text-center">Erro: {handLandmarkerError}</p>
                    )}
                    <p className="text-xs text-muted-foreground text-center">
                      {isClassifierLoading
                        ? "Carregando classificador..."
                        : modelSource === "user"
                          ? `Usando o seu modelo treinado (${modelLabels.length} gestos)`
                          : modelSource === "pretrained"
                            ? `Usando o modelo base do alfabeto (${modelLabels.length} letras) — treine o seu para incluir outros sinais`
                            : "Nenhum classificador disponível"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-primary/5">
              <CardHeader>
                <CardTitle className="text-lg">Gestos Disponíveis</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                {hasModel ? (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {modelLabels.map(lbl => (
                        <span key={lbl} className="px-2 py-1 rounded bg-primary/10 text-primary font-medium">
                          {lbl}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground pt-1">
                      Estes são os sinais que o classificador ativo reconhece. Para acrescentar
                      outros, capture amostras em{" "}
                      <button className="underline" onClick={() => setLocation("/aluno/treinar")}>
                        Treinar Gestos
                      </button>
                      .
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground italic">Carregando lista de sinais...</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-accent/50">
              <CardHeader>
                <CardTitle className="text-lg">Instruções</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>• Posicione-se em frente à câmera</p>
                <p>• Certifique-se de ter boa iluminação</p>
                <p>• Mantenha as mãos visíveis na câmera</p>
                <p>• Faça os gestos de forma clara e pausada</p>
                <p>• Os landmarks (pontos vermelhos e azuis) mostram a detecção</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Gesto Reconhecido
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="min-h-[100px] p-4 bg-muted rounded-lg flex flex-col items-center justify-center">
                  {currentGesture ? (
                    <div className="text-center">
                      <span className="gesture-indicator text-2xl mb-2">
                        {currentGesture}
                      </span>
                      <div className="mt-2 w-full">
                        <div className="w-full bg-muted-foreground/20 rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${currentConfidence}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Confiança: {currentConfidence}%
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic">
                      Aguardando gestos...
                    </p>
                  )}
                </div>
                {currentGesture && currentConfidence > 75 && (
                  <Button 
                    className="w-full"
                    onClick={addGestureToText}
                  >
                    Adicionar ao Texto
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Volume2 className="w-5 h-5" />
                  Texto Reconhecido
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="max-h-[300px] overflow-y-auto p-4 bg-muted rounded-lg">
                  <p className="whitespace-pre-wrap text-lg">
                    {recognizedText || (
                      <span className="text-muted-foreground italic">
                        Nenhum texto reconhecido ainda...
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={clearText}
                  >
                    Limpar
                  </Button>
                  <Button 
                    className="flex-1"
                    onClick={() => speakText(recognizedText)}
                    disabled={!recognizedText}
                  >
                    <Volume2 className="w-4 h-4 mr-2" />
                    Falar
                  </Button>
                </div>

                {gestureHistory.length > 0 && (
                  <div className="mt-4 p-3 bg-secondary rounded-lg">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Histórico de Gestos:</p>
                    <div className="flex flex-wrap gap-2">
                      {gestureHistory.map((gesture, idx) => (
                        <span key={idx} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                          {gesture.gesture}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-chart-2/5">
              <CardHeader>
                <CardTitle className="text-lg">Como Funciona</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <strong>1. Detecção:</strong> MediaPipe Hands detecta as mãos em tempo real
                </p>
                <p>
                  <strong>2. Landmarks:</strong> 21 pontos de referência por mão são extraídos
                </p>
                <p>
                  <strong>3. Reconhecimento:</strong> Algoritmo compara com gestos conhecidos
                </p>
                <p>
                  <strong>4. Conversão:</strong> Gesto é convertido em texto português
                </p>
                <p>
                  <strong>5. Áudio:</strong> Texto é falado automaticamente
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
