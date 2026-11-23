import { ClassroomPanel } from "@/components/ClassroomPanel";
import { useClassroomConnection } from "@/contexts/ClassroomContext";
import { RoomStatus, WorkspaceHeading } from "@/components/AppShell";
import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Video, VideoOff, Volume2, Waves, BookOpen, Plus, Trash2, ScanLine, ChevronDown, Lightbulb, MessageSquareText } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useHandLandmarker } from "@/hooks/useHandLandmarker";
import { useGestureClassifier } from "@/hooks/useGestureClassifier";
import { useDynamicGestureClassifier } from "@/hooks/useDynamicGestureClassifier";
import { twoHandLandmarksToFeatures } from "@/lib/handFeatures";
import type { HandDetectionResult } from "@/lib/librasGestureDatabase";
import { translateWithVLibras } from "@/components/VLibrasWidget";
import { getGlossPhraseSuggestion, loadVLibrasBD, type LibrasCorpusEntry } from "@/lib/librasDatasetImporter";

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
  const classroom = useClassroomConnection();
  const [, setLocation] = useLocation();
  const [isCapturing, setIsCapturing] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");
  const [currentGesture, setCurrentGesture] = useState("");
  const [currentConfidence, setCurrentConfidence] = useState(0);
  const [currentGestureKind, setCurrentGestureKind] = useState<"static" | "dynamic" | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [gestureHistory, setGestureHistory] = useState<RecognitionResult[]>([]);
  const [handDetected, setHandDetected] = useState(false);
  const [spokenTypedText, setSpokenTypedText] = useState("");
  const [vlibrasCorpus, setVlibrasCorpus] = useState<LibrasCorpusEntry[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const translatedIds = useRef(new Set<string>());
  // Apoio em Libras: o VLibras já está disponível em toda a aplicação; traduz automaticamente cada
  // nova fala do professor (melhor esforço; se o VLibras não aceitar o comando, o aluno ainda pode
  // selecionar o texto manualmente).
  useEffect(() => {
    for (const message of classroom.messages) {
      if (message.role !== "professor" || translatedIds.current.has(message.id)) continue;
      translatedIds.current.add(message.id);
      translateWithVLibras(message.text);
    }
  }, [classroom.messages]);
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
    loadVLibrasBD().then(setVlibrasCorpus).catch(() => undefined);
  }, []);

  const glossSuggestion = useMemo(() => getGlossPhraseSuggestion(
    vlibrasCorpus,
    gestureHistory.filter(item => item.kind === "dynamic").map(item => item.gesture),
  ), [vlibrasCorpus, gestureHistory]);

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

  const clearDraft = () => {
    setRecognizedText("");
    setSpokenTypedText("");
  };

  const addGestureToText = () => {
    if (currentGesture) {
      const gestureText = currentGesture.replace(/\[(ESQ|DIR)\]\s*/g, '').trim();
      setRecognizedText(prev => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${gestureText} `);
      speakText(gestureText);
      toast.success(`Adicionado: ${gestureText}`);
    }
  };

  const useGlossSuggestion = () => {
    if (!glossSuggestion) return;
    setRecognizedText(prev => `${prev}${prev && !prev.endsWith(" ") ? " " : ""}${glossSuggestion.portuguese} `);
    toast.success("Sugestão do VLibrasBD adicionada ao texto; revise antes de enviar.");
  };

  const speakMessage = () => {
    if (!recognizedText.trim()) return;
    // Mantido num elemento visível (abaixo) para que o VLibras, que traduz o
    // texto presente na página, também consiga traduzir o que foi digitado.
    setSpokenTypedText(recognizedText);
    speakText(recognizedText);
  };

  const sendMessage = () => {
    if (classroom.send(recognizedText)) clearDraft();
  };

  const handleMessageKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && recognizedText.trim() && classroom.status === 'connected' && classroom.professor) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="workspace-page student-workspace">
      <WorkspaceHeading
        title="Comunique-se com sua turma"
        description="Escreva ou use os gestos para montar sua mensagem."
      >
        <div className="student-heading-actions">
          <RoomStatus />
        </div>
      </WorkspaceHeading>

      <main id="conteudo" tabIndex={-1} className="container workspace-content">
        <div className="student-studio">
          <section className="student-camera-workspace" aria-labelledby="camera-title">
            <div className="student-section-heading">
              <div>
                <p className="student-section-label">Pela câmera</p>
                <h2 id="camera-title">Reconhecimento de gestos</h2>
                <p>Enquadre sua mão para adicionar um gesto à mensagem.</p>
              </div>
              <span className="student-experiment">Experimental</span>
            </div>

            <div className="video-container student-camera-stage" data-active={isCapturing}>
              <video ref={videoRef} autoPlay playsInline muted className="video-mirror block w-full h-auto" />
              <canvas ref={canvasRef} className="video-mirror absolute inset-0 w-full h-full" />
              {!isCapturing && (
                <div className="student-camera-empty">
                  <span className="student-viewfinder" aria-hidden="true"><VideoOff size={30} strokeWidth={1.5} /></span>
                  <strong>Sua câmera está desligada</strong>
                  <p>Inicie a câmera e posicione a mão no quadro.</p>
                </div>
              )}
              <span className="student-camera-corner student-camera-corner-top" aria-hidden="true" />
              <span className="student-camera-corner student-camera-corner-bottom" aria-hidden="true" />
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
                        <p>{currentGestureKind === "dynamic" ? "Sinal em movimento" : "Letra reconhecida"} · {currentConfidence}% de confiança</p>
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
                  <p>Use “Adicionar ao texto” para incluir um gesto na mensagem.</p>
                  <div className="student-gesture-list">{gestureHistory.map((gesture, idx) => <span key={idx} data-dynamic={gesture.kind === "dynamic"}>{gesture.gesture}</span>)}</div>
                </div>
              </details>
            )}

            {glossSuggestion && (
              <div className="student-recognition" role="status">
                <div className="student-recognition-label">
                  <Lightbulb size={17} aria-hidden="true" />
                  <h3>Sugestão de frase (VLibrasBD)</h3>
                </div>
                <p className="student-empty-copy">{glossSuggestion.portuguese}</p>
                <p className="text-xs text-muted-foreground">Correspondência aproximada com a glossa: {glossSuggestion.gloss}</p>
                <Button variant="outline" onClick={useGlossSuggestion}>Usar sugestão</Button>
              </div>
            )}

            <div className="student-available-gestures">
              <details className="student-model-details">
                <summary><span><BookOpen size={17} aria-hidden="true" /> Gestos disponíveis</span><ChevronDown size={17} aria-hidden="true" /></summary>
                <div className="student-model-body">
                  <p>{isClassifierLoading ? "Preparando reconhecimento de letras…"
                    : modelSource === "user" ? `Usando o seu modelo treinado (${modelLabels.length} gestos).`
                    : modelSource === "pretrained" ? `Modelo experimental do alfabeto: ${modelLabels.length} letras.`
                    : "Nenhum classificador estático disponível."}</p>
                  {hasModel && <div className="student-gesture-list" aria-label="Letras disponíveis">{modelLabels.map(label => <span key={label}>{label}</span>)}</div>}
                  <p>{isDynamicClassifierLoading ? "Preparando reconhecimento de movimentos…"
                    : hasDynamicModel ? `Movimentos disponíveis: ${dynamicLabels.length} sinais.`
                    : "Para reconhecer movimentos, grave clipes em Treinar gestos."}</p>
                  {hasDynamicModel && <div className="student-gesture-list" aria-label="Gestos dinâmicos disponíveis">{dynamicLabels.map(label => <span key={label}>{label}</span>)}</div>}
                  <button type="button" className="student-text-link" onClick={() => setLocation("/aluno/treinar")}>Personalizar meus gestos</button>
                </div>
              </details>
              <button type="button" className="student-text-link student-train-link" onClick={() => setLocation("/aluno/treinar")}>
                Treinar gestos
              </button>
            </div>
          </section>

          <section className="student-compose-workspace" role="region" aria-labelledby="transcript-title">
            <div className="student-compose-heading">
              <div className="student-compose-symbol" aria-hidden="true"><MessageSquareText size={22} /></div>
              <div><p className="student-section-label">Sua vez</p><h2 id="transcript-title">Mensagem para a sala</h2></div>
            </div>
            <p className="student-compose-intro">Digite livremente ou acrescente os gestos reconhecidos pela câmera. O texto pode ser editado antes do envio.</p>
            <label className="student-field-label" htmlFor="gesture-message">Escreva sua mensagem</label>
            <Textarea
              id="gesture-message"
              value={recognizedText}
              onChange={e => setRecognizedText(e.target.value)}
              maxLength={2000}
              onKeyDown={handleMessageKeyDown}
              aria-describedby="gesture-message-help gesture-message-session"
              placeholder="Comece a escrever aqui…"
              className="student-message-input student-gesture-message"
            />
            <div className="student-compose-meta">
              <p id="gesture-message-help"><kbd>Enter</kbd> envia <span>·</span> <kbd>Shift + Enter</kbd> cria uma linha</p>
              <span>{recognizedText.length}/2.000</span>
            </div>
            <div className="student-actions student-phrase-actions">
              <Button onClick={sendMessage} disabled={!recognizedText.trim() || classroom.status !== "connected" || !classroom.professor}>Enviar ao professor</Button>
              <Button variant="outline" onClick={speakMessage} disabled={!recognizedText.trim()}><Volume2 size={17} aria-hidden="true" /> Ouvir</Button>
              <Button variant="ghost" onClick={clearDraft} disabled={!recognizedText && !spokenTypedText}><Trash2 size={16} aria-hidden="true" /> Limpar</Button>
            </div>
            <p id="gesture-message-session" className="student-session-note">O rascunho fica nesta tela até você sair da sala.</p>

            <div className="student-libras-option">
              <div className="student-libras-heading">
                <strong>Apoio em Libras</strong>
                <small>Use o ícone do VLibras para traduzir o texto selecionado.</small>
              </div>
              <p className="student-spoken-text">{spokenTypedText || recognizedText || "O texto da sua mensagem aparecerá aqui para seleção."}</p>
            </div>
          </section>
          <ClassroomPanel compact embedded />
        </div>

        <details className="student-guidance">
          <summary><Lightbulb size={18} aria-hidden="true" /><span>Dicas para o reconhecimento</span><ChevronDown size={17} aria-hidden="true" /></summary>
          <div className="student-guidance-tips">
            <p><strong>Boa iluminação.</strong> Deixe a mão inteira visível no quadro.</p>
            <p><strong>Faça uma pausa.</strong> Espere o resultado antes de adicionar o gesto.</p>
            <p><strong>Personalize.</strong> Capture amostras em Treinar gestos para incluir outros sinais.</p>
          </div>
          <p className="student-limit-note">O modelo experimental inclui A a Z. H, J, K, X e Z são reconhecidos pela posição da mão, sem validar o movimento completo. Ç ainda não está incluído. Não traduz Libras completa.</p>
        </details>
      </main>

    </div>
  );
}
