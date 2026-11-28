import { ClassroomPanel } from "@/components/ClassroomPanel";
import { useClassroomConnection } from "@/contexts/ClassroomContext";
import { RoomStatus, WorkspaceHeading } from "@/components/AppShell";
import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Video, VideoOff, Waves, BookOpen, Plus, Trash2, ScanLine, ChevronDown, Lightbulb, MessageSquareText, Pause, Play, Space, Delete, Check } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useHandLandmarker } from "@/hooks/useHandLandmarker";
import { useGestureClassifier } from "@/hooks/useGestureClassifier";
import { useDynamicGestureClassifier } from "@/hooks/useDynamicGestureClassifier";
import { AvailableGestures } from "@/components/AvailableGestures";
import { isDynamicConfident, requiredStableCalls } from "@/lib/dynamicGestureClassifier";
import { useFaceLandmarker } from "@/hooks/useFaceLandmarker";
import {
  EXPRESSION_LABELS,
  EXPRESSION_MARKS,
  HeadMotionDetector,
  applyExpressionToText,
  readExpression,
  type FacialExpression,
} from "@/lib/facialExpression";
import { twoHandLandmarksToFeatures } from "@/lib/handFeatures";
import type { HandDetectionResult } from "@/lib/librasGestureDatabase";
import type { FaceObservation } from "@/lib/facialExpression";
import { translateWithVLibras } from "@/components/VLibrasWidget";
import { getGlossPhraseSuggestion, loadVLibrasBD, type LibrasCorpusEntry } from "@/lib/librasDatasetImporter";
import { StudentLessonSummary } from "@/components/LessonControls";
import { LessonMaterials } from "@/components/LessonMaterials";

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
/** O modelo base testa janelas de até 120 quadros (~4 s). */
const DYNAMIC_BUFFER_SIZE = 120;
/** Mínimo de quadros para consultar o classificador de sinais. */
const DYNAMIC_MIN_FRAMES = 20;
/** Quadros seguidos sem mão que encerram o sinal: o buffer recomeça e não mistura sinais vizinhos. */
const HAND_GAP_FRAMES = 6;
/** A cada quantos quadros o classificador dinâmico é consultado — ele é mais
 * pesado que o estático (roda sobre uma sequência inteira), então não faz
 * sentido chamá-lo a cada quadro. */
const DYNAMIC_PREDICT_EVERY = 4;

/** Confiança mínima para o classificador estático considerar o sinal decidido. */
const CONFIDENCE_THRESHOLD = 0.75;
/**
 * Margem mínima entre a 1ª e a 2ª classe mais prováveis. Sem uma classe
 * "nenhum sinal" treinada com exemplos negativos (ver docs/DOCUMENTACAO.md, seção 5), confiança
 * sozinha não separa "o modelo decidiu" de "duas classes empatadas" — pares
 * que o modelo já confunde de verdade (C/O, M/N/W) passariam do limiar de
 * confiança mesmo quase empatados. É uma heurística, não substitui dado novo.
 */
const MARGIN_THRESHOLD = 0.15;

/** Quadros sem gesto confiável para considerar que o aluno "soltou" a letra —
 * só depois disso a mesma letra pode ser confirmada de novo (ex.: LL, RR). */
const RELEASE_FRAMES = 8;
/** Pausa sem gestos antes de separar palavras (acrescenta um espaço). */
const WORD_GAP_MS = 1500;
/** Pausa sem gestos antes de enviar a mensagem ao professor automaticamente. */
const AUTO_SEND_MS = 5000; // mais tempo para o aluno revisar/corrigir o texto antes do envio
const MAX_MESSAGE_LENGTH = 2000;

/** Intervalo mínimo entre detecções de mãos (~30 quadros/s). Monitores de 60/144 Hz chamariam o
 * detector 60/144 vezes por segundo sem ganho: a mão se move devagar para a câmera de 30 quadros/s. */
const MIN_DETECT_INTERVAL_MS = 28;
/** O rosto é analisado a ~10 vezes por segundo, por tempo (expressões e aceno não precisam de mais). */
const FACE_INTERVAL_MS = 100;
/** Análises seguidas com a mesma expressão antes de confirmá-la (~0,5 s). */
const EXPRESSION_STABLE_CALLS = 5;
/** Análises sem expressão para considerar que o aluno "soltou" a expressão. */
const EXPRESSION_RELEASE_CALLS = 3;
/** Intervalo mínimo entre duas expressões acrescentadas à mensagem. */
const EXPRESSION_COOLDOWN_MS = 2000;
/** A expressão só vale se houve gesto de mão recente — rosto solto não vira texto. */
const EXPRESSION_CONTEXT_MS = 4000;

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
  const [confirmProgress, setConfirmProgress] = useState(0);
  const [lastAdded, setLastAdded] = useState("");
  const [paused, setPaused] = useState(false);
  const [autoSend, setAutoSend] = useState(true);
  const [faceEnabled, setFaceEnabled] = useState(true);
  const [currentExpression, setCurrentExpression] = useState<FacialExpression | null>(null);
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
    sources: dynamicSources,
    isLoading: isDynamicClassifierLoading,
    predict: predictDynamicGesture,
  } = useDynamicGestureClassifier();

  const {
    isReady: isFaceReady,
    isLoading: isFaceLoading,
    error: faceError,
    detectFace,
  } = useFaceLandmarker(faceEnabled);

  const faceEnabledRef = useRef(true);
  faceEnabledRef.current = faceEnabled;
  const lastFaceAtRef = useRef(0);
  const lastDetectAtRef = useRef(0);
  const handAbsentFramesRef = useRef(0);
  const expressionStableRef = useRef<{ label: FacialExpression | ""; count: number }>({ label: "", count: 0 });
  const expressionReleaseRef = useRef(0);
  const lastExpressionRef = useRef<FacialExpression | "">("");
  const lastExpressionAtRef = useRef(0);
  const shownExpressionRef = useRef<FacialExpression | null>(null);
  const headMotionRef = useRef(new HeadMotionDetector());

  const stableRef = useRef<{ label: string; count: number }>({ label: "", count: 0 });
  const unconfidentFramesRef = useRef(0);
  const pausedRef = useRef(false);
  const draftRef = useRef("");
  const gestureDraftRef = useRef(false);
  const lastActivityRef = useRef(0);
  const lastAddedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const classroomRef = useRef(classroom);
  classroomRef.current = classroom;
  pausedRef.current = paused;
  draftRef.current = recognizedText;
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
      if (timestamp - lastDetectAtRef.current < MIN_DETECT_INTERVAL_MS) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }
      lastDetectAtRef.current = timestamp;
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
        handAbsentFramesRef.current = 0;

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
            // Transição incerta: nenhuma letra é acrescentada. Após alguns
            // quadros assim, a letra anterior é considerada "solta".
            unconfidentFramesRef.current += 1;
            if (unconfidentFramesRef.current >= RELEASE_FRAMES) lastCommittedRef.current = "";
          } else if (prediction.label === stable.label) {
            stable.count += 1;
          } else {
            stable.label = prediction.label;
            stable.count = 1;
          }
          if (isConfident) {
            unconfidentFramesRef.current = 0;
            lastActivityRef.current = performance.now();
          }

          const now = performance.now();
          if (now - lastUiUpdateRef.current > UI_THROTTLE_MS) {
            lastUiUpdateRef.current = now;
            if (isConfident) {
              setCurrentGesture(prediction.label);
              setCurrentConfidence(Math.round(prediction.confidence * 100));
              setCurrentGestureKind("static");
              setConfirmProgress(
                prediction.label === lastCommittedRef.current
                  ? 100
                  : Math.min(100, Math.round((stable.count / STABLE_FRAMES) * 100)),
              );
            } else {
              setCurrentGesture("");
              setCurrentConfidence(0);
              setConfirmProgress(0);
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
            setConfirmProgress(100);
            appendGesture(prediction.label, "static");
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
            buffer.length >= DYNAMIC_MIN_FRAMES
          ) {
            const dynPrediction = predictDynamicGesture(buffer);
            if (dynPrediction) {
              // Limiares por modelo ficam em isDynamicConfident. Uma consulta sem
              // certeza zera a sequência: só sinais estáveis entram na mensagem.
              const dynIsConfident = isDynamicConfident(dynPrediction);
              const dstable = dynamicStableRef.current;
              if (!dynIsConfident) {
                dstable.label = "";
                dstable.count = 0;
              } else if (dynPrediction.label === dstable.label) {
                dstable.count += 1;
              } else {
                dstable.label = dynPrediction.label;
                dstable.count = 1;
              }

              if (dynIsConfident) {
                setCurrentGesture(dynPrediction.label);
                setCurrentConfidence(Math.round(dynPrediction.confidence * 100));
                setCurrentGestureKind("dynamic");
              }

              const now = performance.now();
              if (
                dynIsConfident &&
                dstable.count >= requiredStableCalls(dynPrediction.source) &&
                now - lastDynamicCommittedAtRef.current > 1200
              ) {
                lastDynamicCommittedAtRef.current = now;
                dstable.count = 0;
                // Limpa o buffer: evita que o mesmo movimento seja contado de
                // novo na próxima janela, já que ele ainda estaria presente
                // nos quadros mais recentes do buffer.
                dynamicBufferRef.current = [];
                lastActivityRef.current = now;
                appendGesture(dynPrediction.label, "dynamic");
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
        unconfidentFramesRef.current = 0;
        dynamicStableRef.current = { label: "", count: 0 };
        handAbsentFramesRef.current += 1;
        if (handAbsentFramesRef.current >= HAND_GAP_FRAMES && dynamicBufferRef.current.length > 0) {
          dynamicBufferRef.current = [];
        }
        // Sem mão no quadro não há gesto atual: evita adicionar uma detecção antiga.
        setCurrentGesture("");
        setCurrentConfidence(0);
        setConfirmProgress(0);
      }

      if (faceEnabledRef.current) {
        if (timestamp - lastFaceAtRef.current >= FACE_INTERVAL_MS) {
          lastFaceAtRef.current = timestamp;
          let observation: FaceObservation | null = null;
          try {
            observation = detectFace(video, timestamp);
          } catch (err) {
            console.error("Falha ao analisar o rosto neste quadro:", err);
          }
          handleFace(observation);
        }
      }

      animationFrameRef.current = requestAnimationFrame(processFrame);
    };

    animationFrameRef.current = requestAnimationFrame(processFrame);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isCapturing, handLandmarker, detectHands, detectFace, predictGesture, predictDynamicGesture, hasDynamicModel]);

  /** Letras se juntam em palavras (sem espaços); sinais/palavras inteiras são separados por espaço. */
  const appendGesture = (rawLabel: string, kind: "static" | "dynamic") => {
    if (pausedRef.current) return;
    const text = rawLabel.replace(/\[(ESQ|DIR)\]\s*/g, "").trim();
    if (!text) return;
    const isLetter = kind === "static" && Array.from(text).length === 1;
    setRecognizedText(prev => {
      const next = isLetter
        ? `${prev}${text}`
        : `${prev}${prev && !/\s$/.test(prev) ? " " : ""}${text} `;
      return next.slice(0, MAX_MESSAGE_LENGTH);
    });
    gestureDraftRef.current = true;
    lastActivityRef.current = performance.now();
    setLastAdded(text);
    if (lastAddedTimerRef.current) clearTimeout(lastAddedTimerRef.current);
    lastAddedTimerRef.current = setTimeout(() => setLastAdded(""), 1500);
  };

  const showExpression = (expression: FacialExpression | null) => {
    if (shownExpressionRef.current === expression) return;
    shownExpressionRef.current = expression;
    setCurrentExpression(expression);
  };

  /** Acrescenta a expressão (pontuação ou marca) ao rascunho, junto da palavra sinalizada. */
  const commitExpression = (expression: FacialExpression) => {
    const now = performance.now();
    if (pausedRef.current || !draftRef.current.trim()) return;
    if (now - lastActivityRef.current > EXPRESSION_CONTEXT_MS) return;
    if (now - lastExpressionAtRef.current < EXPRESSION_COOLDOWN_MS) return;
    if (lastExpressionRef.current === expression) return;

    lastExpressionRef.current = expression;
    lastExpressionAtRef.current = now;
    lastActivityRef.current = now;
    gestureDraftRef.current = true;
    setRecognizedText(prev => applyExpressionToText(prev, expression).slice(0, MAX_MESSAGE_LENGTH));
    setLastAdded(EXPRESSION_MARKS[expression]);
    if (lastAddedTimerRef.current) clearTimeout(lastAddedTimerRef.current);
    lastAddedTimerRef.current = setTimeout(() => setLastAdded(""), 1500);
  };

  const handleFace = (observation: FaceObservation | null) => {
    if (!observation) {
      expressionStableRef.current = { label: "", count: 0 };
      headMotionRef.current.reset();
      showExpression(null);
      return;
    }

    // Aceno (sim → certeza) e giro (não → negação) vêm do movimento da cabeça.
    const motion = observation.matrix ? headMotionRef.current.push(observation.matrix) : null;
    if (motion) {
      const moved: FacialExpression = motion === "nod" ? "certeza" : "negacao";
      showExpression(moved);
      commitExpression(moved);
      return;
    }

    const { expression } = readExpression(observation.blendshapes);
    const stable = expressionStableRef.current;
    if (!expression) {
      stable.label = "";
      stable.count = 0;
      expressionReleaseRef.current += 1;
      if (expressionReleaseRef.current >= EXPRESSION_RELEASE_CALLS) {
        lastExpressionRef.current = "";
        showExpression(null);
      }
      return;
    }

    expressionReleaseRef.current = 0;
    if (stable.label === expression) stable.count += 1;
    else {
      stable.label = expression;
      stable.count = 1;
    }
    showExpression(expression);
    if (stable.count === EXPRESSION_STABLE_CALLS) commitExpression(expression);
  };

  const startCapture = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 640, 
          height: 480,
          facingMode: 'user',
          frameRate: { ideal: 30, max: 30 }
        } 
      });
      
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      dynamicBufferRef.current = [];
      dynamicFrameCounterRef.current = 0;
      dynamicStableRef.current = { label: "", count: 0 };
      lastActivityRef.current = performance.now();

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
    
    stableRef.current = { label: "", count: 0 };
    lastCommittedRef.current = "";
    dynamicStableRef.current = { label: "", count: 0 };
    expressionStableRef.current = { label: "", count: 0 };
    lastExpressionRef.current = "";
    headMotionRef.current.reset();
    showExpression(null);
    setHandDetected(false);
    setCurrentGesture("");
    setCurrentConfidence(0);
    setConfirmProgress(0);
    setIsCapturing(false);
    toast.info('Câmera desligada. A mensagem foi mantida.');
  };

  const clearDraft = () => {
    setRecognizedText("");
    setSpokenTypedText("");
    gestureDraftRef.current = false;
  };

  const addGestureToText = () => {
    if (!currentGesture) return;
    if (currentGestureKind === "static") lastCommittedRef.current = currentGesture;
    appendGesture(currentGesture, currentGestureKind ?? "static");
  };

  /** Gesto escolhido na lista: entra na mensagem mesmo com a composição por câmera pausada. */
  const insertFromList = (label: string, isLetter: boolean) => {
    const text = label.trim();
    if (!text) return;
    setRecognizedText(prev => {
      const next = isLetter
        ? `${prev}${text}`
        : `${prev}${prev && !/\s$/.test(prev) ? " " : ""}${text} `;
      return next.slice(0, MAX_MESSAGE_LENGTH);
    });
    gestureDraftRef.current = true;
    lastActivityRef.current = performance.now();
    setLastAdded(text);
    if (lastAddedTimerRef.current) clearTimeout(lastAddedTimerRef.current);
    lastAddedTimerRef.current = setTimeout(() => setLastAdded(""), 1500);
  };

  const addSpace = () => {
    setRecognizedText(prev => (prev && !/\s$/.test(prev) ? `${prev} ` : prev));
    lastActivityRef.current = performance.now();
  };

  const removeLastChar = () => {
    setRecognizedText(prev => Array.from(prev).slice(0, -1).join(""));
    lastActivityRef.current = performance.now();
  };

  const useGlossSuggestion = () => {
    if (!glossSuggestion) return;
    setRecognizedText(prev => `${prev}${prev && !prev.endsWith(" ") ? " " : ""}${glossSuggestion.portuguese} `);
    toast.success("Sugestão do VLibrasBD adicionada ao texto; revise antes de enviar.");
  };

  const sendMessage = () => {
    if (classroom.send(recognizedText.trim())) clearDraft();
  };

  const autoSendActive = autoSend && isCapturing && !paused && !classroom.lessonEndedAt;

  // Envio automático: separa palavras após uma pausa curta e envia a mensagem
  // ao professor após uma pausa maior, sem exigir nenhum clique durante o sinal.
  useEffect(() => {
    if (!autoSendActive) return;
    const timer = setInterval(() => {
      if (!gestureDraftRef.current) return;
      if (document.activeElement?.id === "gesture-message") {
        lastActivityRef.current = performance.now(); // aluno editando o texto
        return;
      }
      const text = draftRef.current;
      if (!text.trim()) return;
      const idle = performance.now() - lastActivityRef.current;
      if (idle > AUTO_SEND_MS) {
        const room = classroomRef.current;
        if (room.status === "connected" && room.professor && room.send(text.trim())) {
          setRecognizedText("");
          setSpokenTypedText("");
          gestureDraftRef.current = false;
          draftRef.current = "";
          toast.success("Mensagem enviada ao professor");
        }
      } else if (idle > WORD_GAP_MS && !/\s$/.test(text)) {
        setRecognizedText(`${text} `);
        draftRef.current = `${text} `;
      }
    }, 300);
    return () => clearInterval(timer);
  }, [autoSendActive]);

  const handleMessageKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && recognizedText.trim() && classroom.status === 'connected' && classroom.professor && !classroom.lessonEndedAt) {
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
        <StudentLessonSummary />
        <LessonMaterials role="aluno" />
        <div className="student-studio">
          {/* Mensagens da sala no topo: o aluno lê o que chegou antes de compor a resposta. */}
          <ClassroomPanel compact embedded />
          <section className="student-camera-workspace" aria-labelledby="camera-title">
            <div className="student-section-heading">
              <div>
                <p className="student-section-label">Pela câmera</p>
                <h2 id="camera-title">Reconhecimento de gestos</h2>
                <p>Enquadre sua mão: os gestos reconhecidos entram sozinhos na mensagem.</p>
              </div>
              <span className="student-experiment">Experimental</span>
            </div>

            <div className="video-container student-camera-stage" data-active={isCapturing}>
              <video ref={videoRef} autoPlay playsInline muted className="video-mirror block w-full h-auto" />
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
                <Button variant="outline" onClick={addGestureToText} disabled={!currentGesture || paused}>
                  <Plus size={17} aria-hidden="true" /> Adicionar ao texto
                </Button>
              </div>
              <div className="student-face-row">
                <label className="student-auto-send">
                  <input type="checkbox" checked={faceEnabled} onChange={e => setFaceEnabled(e.target.checked)} />
                  <span>Reconhecer expressões faciais</span>
                </label>
                {faceEnabled && (
                  <span className="student-face-chip" data-active={!!currentExpression} role="status">
                    {faceError ? "Expressões indisponíveis"
                      : isFaceLoading || !isFaceReady ? "Preparando expressões…"
                      : currentExpression ? `Expressão: ${EXPRESSION_LABELS[currentExpression]}`
                      : "Expressão neutra"}
                  </span>
                )}
              </div>
              <div className="student-auto-compose" role="status" aria-live="polite">
                {paused ? (
                  <span>Composição pausada — os gestos não entram na mensagem.</span>
                ) : lastAdded ? (
                  <span className="student-auto-added"><Check size={15} aria-hidden="true" /> Adicionado à mensagem: <strong>{lastAdded}</strong></span>
                ) : currentGesture && confirmProgress > 0 && confirmProgress < 100 ? (
                  <span>Confirmando… mantenha o gesto</span>
                ) : (
                  <span>Os gestos estáveis entram sozinhos na mensagem. Solte o gesto para repetir a mesma letra.</span>
                )}
                <div className="student-confidence-track" role="meter" aria-label="Confirmação do gesto" aria-valuemin={0} aria-valuemax={100} aria-valuenow={confirmProgress}>
                  <span style={{ width: `${paused ? 0 : confirmProgress}%` }} />
                </div>
              </div>
            </div>

            {gestureHistory.length > 0 && (
              <details className="student-model-details student-recent-gestures">
                <summary><span>Últimos gestos detectados</span><ChevronDown size={17} aria-hidden="true" /></summary>
                <div className="student-model-body">
                  <p>Gestos estáveis são incluídos automaticamente na mensagem.</p>
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
                  <AvailableGestures
                    onSelect={insertFromList}
                    letters={hasModel ? modelLabels : []}
                    signs={hasDynamicModel ? dynamicLabels : []}
                    lettersNote={isClassifierLoading ? "Preparando reconhecimento de letras…"
                      : modelSource === "user" ? "Usando o seu modelo treinado de letras."
                      : modelSource === "pretrained" ? "Modelo experimental do alfabeto (A–Z)."
                      : "Nenhum classificador de letras disponível."}
                    signsNote={isDynamicClassifierLoading ? "Preparando reconhecimento de movimentos…"
                      : hasDynamicModel ? `${dynamicSources.length === 2 ? "Seu modelo + modelo base (Libras-EQT-UECE)" : dynamicSources[0] === "pretrained" ? "Modelo base (Libras-EQT-UECE)" : "Seu modelo"}: sinais em movimento.`
                      : "Para reconhecer movimentos, grave clipes em Treinar gestos."}
                  />
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
            <p className="student-compose-intro">Digite livremente ou deixe a câmera montar a mensagem: letras consecutivas formam palavras e, após uma pausa, o texto segue para o professor. O texto pode ser editado a qualquer momento.</p>
            <label className="student-field-label" htmlFor="gesture-message">Escreva sua mensagem</label>
            <Textarea
              id="gesture-message"
              value={recognizedText}
              disabled={!!classroom.lessonEndedAt}
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
              {!autoSendActive && (
                <Button onClick={sendMessage} disabled={!recognizedText.trim() || classroom.status !== "connected" || !classroom.professor || !!classroom.lessonEndedAt}>Enviar ao professor</Button>
              )}
              <Button variant="outline" onClick={() => setPaused(value => !value)} aria-pressed={paused}>
                {paused ? <Play size={17} aria-hidden="true" /> : <Pause size={17} aria-hidden="true" />} {paused ? "Retomar composição" : "Pausar composição"}
              </Button>
              <Button variant="outline" onClick={addSpace} disabled={!recognizedText || /\s$/.test(recognizedText)}><Space size={17} aria-hidden="true" /> Espaço</Button>
              <Button variant="outline" onClick={removeLastChar} disabled={!recognizedText}><Delete size={17} aria-hidden="true" /> Apagar última</Button>
              <Button variant="ghost" onClick={clearDraft} disabled={!recognizedText && !spokenTypedText}><Trash2 size={16} aria-hidden="true" /> Limpar</Button>
            </div>
            <label className="student-auto-send">
              <input type="checkbox" checked={autoSend} onChange={e => setAutoSend(e.target.checked)} disabled={!!classroom.lessonEndedAt} />
              <span>{classroom.lessonEndedAt ? "A aula foi finalizada; o envio está encerrado." : "Envio automático ao professor após uma pausa nos gestos"}</span>
            </label>
            <p id="gesture-message-session" className="student-session-note">O rascunho fica nesta tela até você sair da sala.</p>

            <div className="student-libras-option">
              <div className="student-libras-heading">
                <strong>Apoio em Libras</strong>
                <small>Use o ícone do VLibras para traduzir o texto selecionado.</small>
              </div>
              <p className="student-spoken-text">{spokenTypedText || recognizedText || "O texto da sua mensagem aparecerá aqui para seleção."}</p>
            </div>
          </section>
        </div>

        <details className="student-guidance">
          <summary><Lightbulb size={18} aria-hidden="true" /><span>Dicas para o reconhecimento</span><ChevronDown size={17} aria-hidden="true" /></summary>
          <div className="student-guidance-tips">
            <p><strong>Boa iluminação.</strong> Deixe a mão inteira visível no quadro.</p>
            <p><strong>Faça uma pausa.</strong> Mantenha cada gesto por um instante; para repetir uma letra, solte-a e refaça.</p>
            <p><strong>Rosto visível.</strong> Sobrancelhas erguidas indicam pergunta (?), franzidas indicam dúvida, e acenar ou balançar a cabeça marca certeza ou negação.</p>
            <p><strong>Personalize.</strong> Capture amostras em Treinar gestos para incluir outros sinais.</p>
          </div>
          <p className="student-limit-note">O modelo experimental inclui A a Z. H, J, K, X e Z são reconhecidos pela posição da mão, sem validar o movimento completo. Ç ainda não está incluído. Não traduz Libras completa.</p>
        </details>
      </main>

    </div>
  );
}
