import { WorkspaceHeading } from "@/components/AppShell";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Video, VideoOff, Volume2, Waves, Keyboard, BookOpen, Plus, Trash2, ScanLine, ChevronDown, Lightbulb } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useHandLandmarker } from "@/hooks/useHandLandmarker";
import { useGestureClassifier } from "@/hooks/useGestureClassifier";
import { useDynamicGestureClassifier } from "@/hooks/useDynamicGestureClassifier";
import { twoHandLandmarksToFeatures } from "@/lib/handFeatures";
import type { HandDetectionResult } from "@/lib/librasGestureDatabase";
import VLibrasWidget from "@/components/VLibrasWidget";

interface RecognitionResult {
  gesture: string;
  confidence: number;
  kind: "static" | "dynamic";
}

/** Frames consecutivos com o mesmo rótulo antes de registrar no histórico (estático). */
const STABLE_FRAMES = 6;
/** Intervalo mínimo entre atualizações de estado (evita re-render a 60fps). */
const UI_THROTTLE_MS = 80;

/** Quantos quadros o buffer de sinais dinâmicos mantém (~2s a 30fps). */
const DYNAMIC_BUFFER_SIZE = 60;
/** A cada quantos quadros o classificador dinâmico é consultado — ele é mais
 * pesado que o estático (roda sobre uma sequência inteira), então não faz
 * sentido chamá-lo a cada quadro. */
const DYNAMIC_PREDICT_EVERY = 5;
/** Chamadas seguidas com o mesmo rótulo antes de registrar um sinal dinâmico. */
const DYNAMIC_STABLE_CALLS = 3;
const DYNAMIC_CONFIDENCE_THRESHOLD = 0.75;

/** Confiança mínima para o classificador estático considerar o sinal decidido. */
const CONFIDENCE_THRESHOLD = 0.75;
/**
 * Margem mínima entre a 1ª e a 2ª classe mais prováveis. Sem uma classe
 * "nenhum sinal" treinada com exemplos negativos (ver MODELO.md), confiança
 * sozinha não separa "o modelo decidiu" de "duas classes empatadas" — pares
 * que o modelo já confunde de verdade (C/O, M/N/W) passariam do limiar de
 * confiança mesmo quase empatados. É uma heurística, não substitui dado novo.
 */
const MARGIN_THRESHOLD = 0.15;
const DYNAMIC_MARGIN_THRESHOLD = 0.15;

export default function StudentMode() {
  const [, setLocation] = useLocation();
  const [isCapturing, setIsCapturing] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");
  const [currentGesture, setCurrentGesture] = useState("");
  const [currentConfidence, setCurrentConfidence] = useState(0);
  const [currentGestureKind, setCurrentGestureKind] = useState<"static" | "dynamic" | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [gestureHistory, setGestureHistory] = useState<RecognitionResult[]>([]);
  const [handDetected, setHandDetected] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [spokenTypedText, setSpokenTypedText] = useState("");
  const [librasEnabled, setLibrasEnabled] = useState(false);

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
  const {
    hasModel: hasDynamicModel,
    labels: dynamicLabels,
    isLoading: isDynamicClassifierLoading,
    predict: predictDynamicGesture,
  } = useDynamicGestureClassifier();

  const stableRef = useRef<{ label: string; count: number }>({ label: "", count: 0 });
  const lastUiUpdateRef = useRef(0);
  const lastCommittedRef = useRef("");

  // Buffer circular com os últimos quadros (as duas mãos) para o
  // classificador dinâmico — preenchido a cada quadro, mesmo quando o
  // estático não reconhece nada, para não perder o início do movimento.
  const dynamicBufferRef = useRef<Float32Array[]>([]);
  const dynamicFrameCounterRef = useRef(0);
  const dynamicStableRef = useRef<{ label: string; count: number }>({ label: "", count: 0 });
  const lastDynamicCommittedAtRef = useRef(0);

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
      // Uma exceção aqui abortaria o rAF em definitivo e a tela ficaria parada
      // em "Aguardando gestos..." sem nenhum sinal do que houve.
      let detectionResult: HandDetectionResult | null = null;
      try {
        detectionResult = detectHands(video, timestamp);
      } catch (err) {
        console.error("Falha ao detectar mãos neste quadro:", err);
      }

      if (detectionResult && detectionResult.landmarks.length > 0) {
        setHandDetected(true);

        // --- reconhecimento estático (pose de um único quadro) ---
        const prediction = predictGesture(detectionResult.landmarks[0] as any);
        if (prediction) {
          // Rejeição por confiança + margem: sem uma classe "nenhum sinal"
          // treinada com exemplos negativos, é a melhor heurística disponível
          // para não afirmar uma letra quando o modelo está indeciso (ex. numa
          // transição entre gestos, ou entre duas classes confundíveis).
          const isConfident =
            prediction.confidence > CONFIDENCE_THRESHOLD && prediction.margin > MARGIN_THRESHOLD;

          // Janela de estabilidade: só considera o gesto quando o mesmo rótulo
          // se repete por vários frames, o que evita a oscilação quadro a quadro
          // e impede o histórico de encher com duplicatas do mesmo sinal.
          const stable = stableRef.current;
          if (!isConfident) {
            stable.label = "";
            stable.count = 0;
          } else if (prediction.label === stable.label) {
            stable.count += 1;
          } else {
            stable.label = prediction.label;
            stable.count = 1;
          }

          const now = performance.now();
          if (now - lastUiUpdateRef.current > UI_THROTTLE_MS) {
            lastUiUpdateRef.current = now;
            if (isConfident) {
              setCurrentGesture(prediction.label);
              setCurrentConfidence(Math.round(prediction.confidence * 100));
              setCurrentGestureKind("static");
            } else {
              setCurrentGesture("");
              setCurrentConfidence(0);
            }
          }

          if (
            isConfident &&
            stable.count === STABLE_FRAMES &&
            prediction.label !== lastCommittedRef.current
          ) {
            lastCommittedRef.current = prediction.label;
            setGestureHistory(prev => [
              ...prev.slice(-9),
              { gesture: prediction.label, confidence: prediction.confidence, kind: "static" },
            ]);
          }
        }

        // --- reconhecimento dinâmico (janela deslizante de quadros) ---
        if (hasDynamicModel) {
          const buffer = dynamicBufferRef.current;
          buffer.push(twoHandLandmarksToFeatures(detectionResult));
          if (buffer.length > DYNAMIC_BUFFER_SIZE) buffer.shift();

          dynamicFrameCounterRef.current += 1;
          if (
            dynamicFrameCounterRef.current % DYNAMIC_PREDICT_EVERY === 0 &&
            buffer.length >= DYNAMIC_BUFFER_SIZE / 2
          ) {
            const dynPrediction = predictDynamicGesture(buffer);
            if (dynPrediction) {
              const dstable = dynamicStableRef.current;
              if (dynPrediction.label === dstable.label) {
                dstable.count += 1;
              } else {
                dstable.label = dynPrediction.label;
                dstable.count = 1;
              }

              const dynIsConfident =
                dynPrediction.confidence > DYNAMIC_CONFIDENCE_THRESHOLD &&
                dynPrediction.margin > DYNAMIC_MARGIN_THRESHOLD;

              if (dynIsConfident) {
                setCurrentGesture(dynPrediction.label);
                setCurrentConfidence(Math.round(dynPrediction.confidence * 100));
                setCurrentGestureKind("dynamic");
              }

              const now = performance.now();
              if (
                dynIsConfident &&
                dstable.count >= DYNAMIC_STABLE_CALLS &&
                now - lastDynamicCommittedAtRef.current > 1200
              ) {
                lastDynamicCommittedAtRef.current = now;
                dstable.count = 0;
                // Limpa o buffer: evita que o mesmo movimento seja contado de
                // novo na próxima janela, já que ele ainda estaria presente
                // nos quadros mais recentes do buffer.
                dynamicBufferRef.current = [];
                setGestureHistory(prev => [
                  ...prev.slice(-9),
                  { gesture: dynPrediction.label, confidence: dynPrediction.confidence, kind: "dynamic" },
                ]);
              }
            }
          }
        }
      } else {
        setHandDetected(false);
        stableRef.current = { label: "", count: 0 };
        lastCommittedRef.current = "";
        dynamicStableRef.current = { label: "", count: 0 };
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
  }, [isCapturing, handLandmarker, detectHands, predictGesture, predictDynamicGesture, hasDynamicModel]);

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

      dynamicBufferRef.current = [];
      dynamicFrameCounterRef.current = 0;
      dynamicStableRef.current = { label: "", count: 0 };

      setIsCapturing(true);
      toast.success('Câmera iniciada. Posicione sua mão no quadro.');
      
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
    setCurrentGestureKind(null);
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

  const speakTypedText = () => {
    if (!typedText.trim()) return;
    // Mantido num elemento visível (abaixo) para que o VLibras, que traduz o
    // texto presente na página, também consiga traduzir o que foi digitado.
    setSpokenTypedText(typedText);
    speakText(typedText);
  };

  const handleTypedTextKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      speakTypedText();
    }
  };

  const clearTypedText = () => {
    setTypedText("");
    setSpokenTypedText("");
  };

  return (
    <div className="workspace-page student-workspace">
      {librasEnabled && <VLibrasWidget />}
      <WorkspaceHeading
        title="Seu espaço de comunicação"
        description="Use o teclado para falar ou explore gestos com a câmera."
      >
        <Button variant="outline" onClick={() => setLocation("/aluno/treinar")}>
          <BookOpen size={17} aria-hidden="true" /> Treinar gestos
        </Button>
      </WorkspaceHeading>

      <main id="conteudo" tabIndex={-1} className="container workspace-content">
        <div className="student-layout">
          <Card className="student-panel student-camera-panel" role="region" aria-labelledby="camera-title">
            <CardHeader className="student-panel-header">
              <div className="student-title-row">
                <span className="student-tool-icon"><Video size={21} aria-hidden="true" /></span>
                <div><h2 id="camera-title">Reconhecimento de gestos</h2><p>Enquadre sua mão e acompanhe o resultado.</p></div>
              </div>
              <span className="student-experiment">Experimental</span>
            </CardHeader>
            <CardContent className="student-camera-content">
              <div className="video-container student-camera-stage" data-active={isCapturing}>
                <video ref={videoRef} autoPlay playsInline muted className="video-mirror block w-full h-auto" />
                <canvas ref={canvasRef} className="video-mirror absolute inset-0 w-full h-full" />
                {!isCapturing && (
                  <div className="student-camera-empty">
                    <span className="student-viewfinder" aria-hidden="true"><VideoOff size={30} strokeWidth={1.5} /></span>
                    <strong>Sua câmera está desligada</strong>
                    <p>Quando estiver pronto, inicie a câmera<br />e posicione a mão no quadro.</p>
                  </div>
                )}
              </div>
              <div className="student-camera-toolbar">
                <div className="student-camera-status" role="status">
                  <span className="student-status-dot" data-ready={!isHandLandmarkerLoading && !handLandmarkerError} />
                  {isHandLandmarkerLoading ? "Preparando reconhecimento…"
                    : handLandmarkerError ? "Reconhecimento indisponível"
                    : isCapturing ? (handDetected ? "Mão detectada" : "Nenhuma mão no quadro")
                    : "Pronto para começar"}
                </div>
                <Button variant={isCapturing ? "destructive" : "default"} onClick={isCapturing ? stopCapture : startCapture}>
                  {isCapturing ? <VideoOff size={17} aria-hidden="true" /> : <Video size={17} aria-hidden="true" />}
                  {isCapturing ? "Parar câmera" : "Iniciar câmera"}
                </Button>
              </div>
              {handLandmarkerError && <p className="student-error" role="alert">Erro: {handLandmarkerError}</p>}

              <div className="student-recognition">
                <div className="student-recognition-label">
                  {currentGestureKind === "dynamic" ? <Waves size={17} aria-hidden="true" /> : <ScanLine size={17} aria-hidden="true" />}
                  <h3>Gesto reconhecido</h3>
                </div>
                <div className="student-recognition-result">
                  <div className="student-result-value">
                    {currentGesture ? (
                      <>
                        <strong className="student-gesture-value">{currentGesture}</strong>
                        <div className="student-confidence">
                          <p>{currentGestureKind === "dynamic" ? "Sinal em movimento" : "Gesto estático"} · {currentConfidence}% de confiança</p>
                          <div className="student-confidence-track" role="meter" aria-label="Confiança do reconhecimento" aria-valuemin={0} aria-valuemax={100} aria-valuenow={currentConfidence}>
                            <span style={{ width: `${currentConfidence}%` }} />
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="student-empty-copy">{isCapturing ? "Mantenha a mão visível e faça um gesto pausadamente." : "O gesto identificado aparecerá aqui."}</p>
                    )}
                  </div>
                  <Button variant="outline" onClick={addGestureToText} disabled={!currentGesture || currentConfidence <= 75}>
                    <Plus size={17} aria-hidden="true" /> Adicionar ao texto
                  </Button>
                </div>
              </div>

              {gestureHistory.length > 0 && (
                <details className="student-model-details student-recent-gestures">
                  <summary><span>Últimos gestos detectados</span><ChevronDown size={17} aria-hidden="true" /></summary>
                  <div className="student-model-body">
                    <p>Este histórico mostra as detecções da câmera. Use Adicionar ao texto para incluir um gesto na sua mensagem.</p>
                    <div className="student-gesture-list">{gestureHistory.map((gesture, idx) => <span key={idx} data-dynamic={gesture.kind === "dynamic"}>{gesture.gesture}</span>)}</div>
                  </div>
                </details>
              )}

              <details className="student-model-details">
                <summary><span><BookOpen size={17} aria-hidden="true" /> Gestos disponíveis</span><ChevronDown size={17} aria-hidden="true" /></summary>
                <div className="student-model-body">
                  <p>{isClassifierLoading ? "Preparando reconhecimento de letras…"
                    : modelSource === "user" ? `Usando o seu modelo treinado (${modelLabels.length} gestos).`
                    : modelSource === "pretrained" ? `Modelo base do alfabeto: ${modelLabels.length} letras estáticas.`
                    : "Nenhum classificador estático disponível."}</p>
                  {hasModel && <div className="student-gesture-list" aria-label="Gestos estáticos disponíveis">{modelLabels.map(label => <span key={label}>{label}</span>)}</div>}
                  <p>{isDynamicClassifierLoading ? "Preparando reconhecimento de movimentos…"
                    : hasDynamicModel ? `Movimentos disponíveis: ${dynamicLabels.length} sinais.`
                    : "Para reconhecer movimentos, grave clipes em Treinar gestos."}</p>
                  {hasDynamicModel && <div className="student-gesture-list" aria-label="Gestos dinâmicos disponíveis">{dynamicLabels.map(label => <span key={label}>{label}</span>)}</div>}
                  <button type="button" className="student-text-link" onClick={() => setLocation("/aluno/treinar")}>Personalizar meus gestos</button>
                </div>
              </details>
            </CardContent>
          </Card>

          <div className="student-message-column">
            <Card className="student-panel student-transcript-panel" role="region" aria-labelledby="transcript-title">
              <CardHeader className="student-panel-header">
                <div className="student-title-row">
                  <span className="student-tool-icon"><ScanLine size={21} aria-hidden="true" /></span>
                  <div><h2 id="transcript-title">Mensagem com gestos</h2><p>Acompanhe o texto que você está construindo.</p></div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="student-message-label-row">
                  <label className="student-field-label" htmlFor="gesture-message">Sua mensagem</label>
                  <span className="student-manual-label">Adição manual</span>
                </div>
                <Textarea
                  id="gesture-message"
                  value={recognizedText}
                  readOnly
                  aria-describedby="gesture-message-help gesture-message-session"
                  placeholder="Sua mensagem aparecerá aqui…"
                  className="student-message-input student-gesture-message"
                />
                <p id="gesture-message-help" className="student-message-help">Reconheça um gesto e clique em <strong>Adicionar ao texto</strong>, abaixo da câmera.</p>
                <div className="student-actions student-phrase-actions">
                  <Button onClick={() => speakText(recognizedText)} disabled={!recognizedText.trim()}><Volume2 size={17} aria-hidden="true" /> Ouvir mensagem</Button>
                  <Button variant="ghost" onClick={clearText} disabled={!recognizedText && !gestureHistory.length && !currentGesture}><Trash2 size={16} aria-hidden="true" /> Limpar mensagem</Button>
                </div>
                <p id="gesture-message-session" className="student-session-note">O texto fica disponível enquanto esta tela estiver aberta.</p>
              </CardContent>
            </Card>

            <Card className="student-panel student-compose-panel" role="region" aria-labelledby="compose-title">
              <CardHeader className="student-panel-header">
                <div className="student-title-row">
                  <span className="student-tool-icon"><Keyboard size={21} aria-hidden="true" /></span>
                  <div><h2 id="compose-title">Digitar e ouvir</h2><p>Transforme sua mensagem em voz.</p></div>
                </div>
              </CardHeader>
              <CardContent>
                <label className="student-field-label" htmlFor="student-message">O que você quer dizer?</label>
                <Textarea
                  id="student-message"
                  aria-label="Mensagem para ler em voz alta"
                  aria-describedby="student-keyboard-hint"
                  value={typedText}
                  onChange={e => setTypedText(e.target.value)}
                  onKeyDown={handleTypedTextKeyDown}
                  placeholder="Escreva sua mensagem aqui…"
                  className="student-message-input"
                />
                <p className="student-keyboard-hint" id="student-keyboard-hint"><kbd>Enter</kbd> para falar <span>·</span> <kbd>Shift + Enter</kbd> para nova linha</p>
                <div className="student-actions">
                  <Button onClick={speakTypedText} disabled={!typedText.trim()}><Volume2 size={17} aria-hidden="true" /> Falar mensagem</Button>
                  <Button variant="ghost" onClick={clearTypedText} disabled={!typedText && !spokenTypedText}><Trash2 size={16} aria-hidden="true" /> Limpar</Button>
                </div>
                <div className="student-libras-option">
                  <label htmlFor="student-libras"><span><strong>Apoio em Libras</strong><small>Mostrar o tradutor VLibras na tela.</small></span>
                    <input id="student-libras" type="checkbox" role="switch" checked={librasEnabled} onChange={e => setLibrasEnabled(e.target.checked)} />
                  </label>
                  {librasEnabled && (
                    <div className="student-libras-preview">
                      <p>Abra o ícone azul do VLibras e selecione a mensagem abaixo para traduzir.</p>
                      <p className="student-spoken-text">{spokenTypedText || "Digite uma mensagem e escolha Falar mensagem para exibi-la aqui."}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>


          </div>
        </div>

        <aside className="student-guidance" aria-labelledby="student-guidance-title">
          <div className="student-guidance-heading"><Lightbulb size={20} aria-hidden="true" /><h2 id="student-guidance-title">Para reconhecer melhor</h2></div>
          <div className="student-guidance-tips">
            <p><strong>Cuide da iluminação.</strong> Deixe a mão inteira visível no quadro.</p>
            <p><strong>Faça uma pausa no gesto.</strong> Espere o resultado antes de adicionar ao texto.</p>
            <p><strong>Personalize no treino.</strong> Capture suas amostras para incluir outros gestos.</p>
          </div>
          <p className="student-limit-note">O modelo base reconhece 15 letras estáticas. O reconhecimento é experimental e não traduz Libras completa.</p>
        </aside>
      </main>
    </div>
  );
}
