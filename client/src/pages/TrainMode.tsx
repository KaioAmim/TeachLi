import { WorkspaceHeading } from "@/components/AppShell";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Camera,
  Circle,
  Download,
  Play,
  Square,
  Trash2,
  Video,
  VideoOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHandLandmarker } from "@/hooks/useHandLandmarker";
import { landmarksToFeatures, twoHandLandmarksToFeatures } from "@/lib/handFeatures";
import { resampleSequence, sequenceToArray } from "@/lib/sequenceUtils";
import { importPretrainedAlphabetDataset } from "@/lib/pretrainedDatasetImporter";
import {
  deleteClassifier,
  getSampleCountsByLabel,
  loadDataset,
  saveDataset,
  trainClassifier,
  type TrainingProgress,
  type TrainingSample,
} from "@/lib/gestureClassifier";
import {
  SEQUENCE_LENGTH,
  deleteDynamicClassifier,
  getSampleCountsByLabel as getDynamicSampleCounts,
  loadDataset as loadDynamicDataset,
  saveDataset as saveDynamicDataset,
  trainDynamicClassifier,
  type DynamicTrainingProgress,
  type DynamicTrainingSample,
} from "@/lib/dynamicGestureClassifier";

type SignKind = "static" | "dynamic";

/** Quadros mínimos para um clipe dinâmico valer a pena (evita cliques acidentais). */
const MIN_CLIP_FRAMES = 8;

export default function TrainMode() {
  const [kind, setKind] = useState<SignKind>("static");

  // --- dataset estático (1 quadro por amostra) ---
  const [samples, setSamples] = useState<TrainingSample[]>(() => loadDataset());
  // --- dataset dinâmico (clipe reamostrado por amostra) ---
  const [dynamicSamples, setDynamicSamples] = useState<DynamicTrainingSample[]>(() =>
    loadDynamicDataset()
  );

  const [label, setLabel] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [handVisible, setHandVisible] = useState(false);
  const [progress, setProgress] = useState<TrainingProgress | null>(null);
  const [dynamicProgress, setDynamicProgress] = useState<DynamicTrainingProgress | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [isTrainingDynamic, setIsTrainingDynamic] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isRecordingClip, setIsRecordingClip] = useState(false);
  const [clipFrameCount, setClipFrameCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<number | null>(null);
  const latestFeaturesRef = useRef<Float32Array | null>(null);
  const clipFramesRef = useRef<Float32Array[]>([]);
  const isRecordingClipRef = useRef(false);

  const { isLoading: isLandmarkerLoading, error: landmarkerError, handLandmarker, detectHands } =
    useHandLandmarker();

  const counts = getSampleCountsByLabel(samples);
  const labels = Object.keys(counts).sort();

  const dynamicCounts = getDynamicSampleCounts(dynamicSamples);
  const dynamicLabels = Object.keys(dynamicCounts).sort();

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach(track => track.stop());
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [stream]);

  useEffect(() => {
    if (!isCapturing || !handLandmarker) return;

    const processFrame = () => {
      const video = videoRef.current;
      if (video?.videoWidth) {
        try {
          const result = detectHands(video, performance.now());
          if (result) {
            const hand = result.landmarks[0];
            latestFeaturesRef.current = hand ? landmarksToFeatures(hand) : null;
            setHandVisible(Boolean(hand));

            if (isRecordingClipRef.current) {
              clipFramesRef.current.push(twoHandLandmarksToFeatures(result));
              setClipFrameCount(clipFramesRef.current.length);
            }
          }
        } catch (err) {
          console.error("Falha ao detectar mãos neste quadro:", err);
        }
      }
      frameRef.current = requestAnimationFrame(processFrame);
    };

    frameRef.current = requestAnimationFrame(processFrame);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [isCapturing, handLandmarker, detectHands]);

  const persist = (next: TrainingSample[]) => {
    setSamples(next);
    saveDataset(next);
  };

  const persistDynamic = (next: DynamicTrainingSample[]) => {
    setDynamicSamples(next);
    saveDynamicDataset(next);
  };

  const startCapture = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      setStream(mediaStream);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
      setIsCapturing(true);
    } catch {
      toast.error("Erro ao acessar câmera. Verifique as permissões.");
    }
  };

  const stopCapture = () => {
    stream?.getTracks().forEach(track => track.stop());
    setStream(null);
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCapturing(false);
    setHandVisible(false);
    latestFeaturesRef.current = null;
    isRecordingClipRef.current = false;
    setIsRecordingClip(false);
    clipFramesRef.current = [];
    setClipFrameCount(0);
  };

  const captureSample = () => {
    const trimmed = label.trim().toUpperCase();
    if (!trimmed) {
      toast.error("Informe o rótulo do sinal antes de capturar.");
      return;
    }
    const features = latestFeaturesRef.current;
    if (!features) {
      toast.error("Nenhuma mão detectada no quadro.");
      return;
    }
    persist([...samples, { label: trimmed, features: Array.from(features) }]);
    toast.success(`Amostra de "${trimmed}" capturada`);
  };

  const startClipRecording = () => {
    const trimmed = label.trim().toUpperCase();
    if (!trimmed) {
      toast.error("Informe o rótulo do sinal antes de gravar.");
      return;
    }
    clipFramesRef.current = [];
    setClipFrameCount(0);
    isRecordingClipRef.current = true;
    setIsRecordingClip(true);
  };

  const stopClipRecording = () => {
    isRecordingClipRef.current = false;
    setIsRecordingClip(false);

    const trimmed = label.trim().toUpperCase();
    const frames = clipFramesRef.current;
    clipFramesRef.current = [];
    setClipFrameCount(0);

    if (frames.length < MIN_CLIP_FRAMES) {
      toast.error(
        `Clipe curto demais (${frames.length} quadros) — segure a gravação por mais tempo enquanto faz o sinal.`
      );
      return;
    }

    const resampled = resampleSequence(frames, SEQUENCE_LENGTH);
    persistDynamic([...dynamicSamples, { label: trimmed, frames: sequenceToArray(resampled) }]);
    toast.success(`Clipe de "${trimmed}" gravado (${frames.length} quadros originais)`);
  };

  const importDataset = async () => {
    setIsImporting(true);
    try {
      const imported = await importPretrainedAlphabetDataset();
      persist([...samples, ...imported]);
      toast.success(`${imported.length} amostras do alfabeto importadas`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao importar as amostras");
    } finally {
      setIsImporting(false);
    }
  };

  const train = async () => {
    setIsTraining(true);
    setProgress(null);
    try {
      const { labels: trained, finalAccuracy } = await trainClassifier(samples, {
        onProgress: setProgress,
      });
      toast.success(
        `Modelo treinado: ${trained.length} classes, acurácia ${(finalAccuracy * 100).toFixed(1)}%`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no treino");
    } finally {
      setIsTraining(false);
    }
  };

  const trainDynamic = async () => {
    setIsTrainingDynamic(true);
    setDynamicProgress(null);
    try {
      const { labels: trained, finalAccuracy } = await trainDynamicClassifier(dynamicSamples, {
        onProgress: setDynamicProgress,
      });
      toast.success(
        `Modelo dinâmico treinado: ${trained.length} sinais, acurácia ${(finalAccuracy * 100).toFixed(1)}%`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no treino dinâmico");
    } finally {
      setIsTrainingDynamic(false);
    }
  };

  const reset = async () => {
    persist([]);
    await deleteClassifier();
    toast.info("Amostras e modelo estático removidos — o modelo base volta a ser usado");
  };

  const resetDynamic = async () => {
    persistDynamic([]);
    await deleteDynamicClassifier();
    toast.info("Clipes e modelo dinâmico removidos");
  };

  return (
    <div className="workspace-page">
      <WorkspaceHeading title="Cada gesto, um novo aprendizado." description="Capture amostras e personalize o reconhecimento no seu navegador." backTo="/aluno" />

      <main id="conteudo" tabIndex={-1} className="container workspace-content grid lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Capturar amostras
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
              <button
                type="button"
                onClick={() => setKind("static")}
                aria-pressed={kind === "static"}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  kind === "static" ? "bg-background shadow-sm" : "text-muted-foreground"
                }`}
              >
                Sinal estático (foto)
              </button>
              <button
                type="button"
                onClick={() => setKind("dynamic")}
                aria-pressed={kind === "dynamic"}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  kind === "dynamic" ? "bg-background shadow-sm" : "text-muted-foreground"
                }`}
              >
                Sinal dinâmico (movimento)
              </button>
            </div>

            <div className="video-container bg-black">
              <video ref={videoRef} autoPlay playsInline muted className="video-mirror block w-full h-auto" />
              {!isCapturing && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <p className="text-muted-foreground text-sm">Câmera desligada</p>
                </div>
              )}
              {isRecordingClip && (
                <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded bg-destructive text-destructive-foreground text-xs font-medium">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  gravando — {clipFrameCount} quadros
                </div>
              )}
            </div>

            {isLandmarkerLoading && (
              <p className="text-sm text-muted-foreground text-center">Preparando reconhecimento…</p>
            )}
            {landmarkerError && (
              <p className="text-sm text-destructive text-center">Erro: {landmarkerError}</p>
            )}

            <div className="flex gap-2">
              {!isCapturing ? (
                <Button className="flex-1" onClick={startCapture}>
                  <Video className="w-4 h-4 mr-2" />
                  Iniciar câmera
                </Button>
              ) : (
                <Button variant="destructive" className="flex-1" onClick={stopCapture}>
                  <VideoOff className="w-4 h-4 mr-2" />
                  Parar câmera
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <input
                aria-label="Nome do gesto"
                value={label}
                onChange={event => setLabel(event.target.value)}
                placeholder={kind === "static" ? "Rótulo do sinal (ex.: A)" : "Rótulo do sinal (ex.: OBRIGADO)"}
                className="flex-1 h-10 rounded-md border border-border bg-background px-3 text-sm"
              />
              {kind === "static" ? (
                <Button onClick={captureSample} disabled={!isCapturing || !handVisible}>
                  Capturar
                </Button>
              ) : !isRecordingClip ? (
                <Button onClick={startClipRecording} disabled={!isCapturing}>
                  <Circle className="w-4 h-4 mr-2" />
                  Gravar
                </Button>
              ) : (
                <Button variant="destructive" onClick={stopClipRecording}>
                  <Square className="w-4 h-4 mr-2" />
                  Parar e salvar
                </Button>
              )}
            </div>
            {kind === "static" && isCapturing && (
              <p className="text-xs text-muted-foreground text-center">
                {handVisible ? "Mão detectada — pronto para capturar" : "Nenhuma mão no quadro"}
              </p>
            )}
            {kind === "dynamic" && isCapturing && (
              <p className="text-xs text-muted-foreground text-center">
                Clique em "Gravar", faça o sinal do início ao fim com calma e clique em "Parar e
                salvar". Grave o mesmo sinal várias vezes, em velocidades um pouco diferentes.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {kind === "static"
                  ? `Suas amostras (${samples.length})`
                  : `Seus clipes (${dynamicSamples.length})`}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {kind === "static" ? (
                <>
                  {labels.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                      Nenhuma amostra ainda. Capture na webcam ou importe as amostras do alfabeto.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {labels.map(lbl => (
                        <span key={lbl} className="px-2 py-1 rounded bg-primary/10 text-primary text-sm">
                          {lbl}: {counts[lbl]}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={importDataset} disabled={isImporting}>
                      <Download className="w-4 h-4 mr-2" />
                      {isImporting ? "Importando..." : "Importar amostras de 15 letras"}
                    </Button>
                    <Button onClick={train} disabled={isTraining || labels.length < 2}>
                      <Play className="w-4 h-4 mr-2" />
                      {isTraining ? "Treinando..." : "Treinar"}
                    </Button>
                    <Button variant="destructive" onClick={reset} disabled={isTraining}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Limpar
                    </Button>
                  </div>

                  {progress && (
                    <div className="space-y-1">
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${(progress.epoch / progress.totalEpochs) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Época {progress.epoch}/{progress.totalEpochs} — perda {progress.loss.toFixed(4)},
                        acurácia {(progress.accuracy * 100).toFixed(1)}%
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {dynamicLabels.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                      Nenhum clipe ainda. Grave alguns sinais com movimento na webcam.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {dynamicLabels.map(lbl => (
                        <span key={lbl} className="px-2 py-1 rounded bg-primary/10 text-primary text-sm">
                          {lbl}: {dynamicCounts[lbl]}
                        </span>
                      ))}
                    </div>
                  )}
                  {dynamicLabels.some(lbl => dynamicCounts[lbl] < 5) && dynamicLabels.length > 0 && (
                    <p className="text-xs text-amber-600">
                      Sinais com poucos clipes tendem a confundir o modelo com outros parecidos —
                      o ideal é pelo menos 8-10 repetições por sinal, gravadas em velocidades
                      diferentes.
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={trainDynamic} disabled={isTrainingDynamic || dynamicLabels.length < 2}>
                      <Play className="w-4 h-4 mr-2" />
                      {isTrainingDynamic ? "Treinando..." : "Treinar"}
                    </Button>
                    <Button variant="destructive" onClick={resetDynamic} disabled={isTrainingDynamic}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Limpar
                    </Button>
                  </div>

                  {dynamicProgress && (
                    <div className="space-y-1">
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{
                            width: `${(dynamicProgress.epoch / dynamicProgress.totalEpochs) * 100}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Época {dynamicProgress.epoch}/{dynamicProgress.totalEpochs} — perda{" "}
                        {dynamicProgress.loss.toFixed(4)}, acurácia{" "}
                        {(dynamicProgress.accuracy * 100).toFixed(1)}%
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-accent/50">
            <CardHeader>
              <CardTitle className="text-lg">Como treinar seus gestos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><strong>Sem movimento:</strong> dê um nome ao gesto, mantenha a mão parada e capture várias amostras da mesma posição.</p>
              <p><strong>Com movimento:</strong> grave o gesto do início ao fim. Repita algumas vezes para criar seus clipes de treino.</p>
              <p><strong>Depois de capturar:</strong> reúna pelo menos dois gestos diferentes e clique em Treinar. Seu modelo fica salvo neste navegador para usar no espaço do aluno.</p>
              <p className="text-muted-foreground">Limpar remove as amostras e o modelo apenas do tipo selecionado. Essa ação não pode ser desfeita.</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
