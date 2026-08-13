import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Camera, Trash2, GraduationCap, Download } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useHandLandmarker } from "@/hooks/useHandLandmarker";
import { landmarksToFeatures } from "@/lib/handFeatures";
import {
  loadDataset,
  saveDataset,
  getSampleCountsByLabel,
  trainClassifier,
  deleteClassifier,
  hasTrainedClassifier,
  type TrainingSample,
} from "@/lib/gestureClassifier";
import { importPretrainedAlphabetDataset, type ImportProgress } from "@/lib/pretrainedDatasetImporter";
import { LIBRAS_GESTURES } from "@/lib/librasGestureDatabase";

const SAMPLES_PER_BURST = 20;
const BURST_INTERVAL_MS = 100;

export default function TrainGestures() {
  const [, setLocation] = useLocation();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isRecordingBurst, setIsRecordingBurst] = useState(false);
  const [label, setLabel] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [samples, setSamples] = useState<TrainingSample[]>(() => loadDataset());
  const [isTraining, setIsTraining] = useState(false);
  const [trainingStatus, setTrainingStatus] = useState("");
  const [hasModel, setHasModel] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const latestLandmarksRef = useRef<any[] | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const { handLandmarker, isLoading, error, detectHands } = useHandLandmarker();

  useEffect(() => {
    hasTrainedClassifier().then(setHasModel);
  }, []);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach(track => track.stop());
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [stream]);

  useEffect(() => {
    if (!isCapturing || !videoRef.current || !handLandmarker) return;

    const processFrame = () => {
      const video = videoRef.current;
      if (video && video.videoWidth) {
        const result = detectHands(video, performance.now());
        latestLandmarksRef.current = result?.landmarks?.[0] ?? null;
      }
      animationFrameRef.current = requestAnimationFrame(processFrame);
    };

    animationFrameRef.current = requestAnimationFrame(processFrame);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isCapturing, handLandmarker, detectHands]);

  const startCamera = async () => {
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

  const stopCamera = () => {
    stream?.getTracks().forEach(track => track.stop());
    setStream(null);
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCapturing(false);
  };

  const currentLabel = label === "__custom__" ? customLabel.trim().toUpperCase() : label;

  const addSample = () => {
    const landmarks = latestLandmarksRef.current;
    if (!currentLabel) {
      toast.error("Escolha ou digite um rótulo para o gesto.");
      return false;
    }
    if (!landmarks) {
      toast.error("Nenhuma mão detectada no momento.");
      return false;
    }

    const features = Array.from(landmarksToFeatures(landmarks));
    setSamples(prev => {
      const next = [...prev, { label: currentLabel, features }];
      saveDataset(next);
      return next;
    });
    return true;
  };

  const captureSingleSample = () => {
    if (addSample()) toast.success(`Amostra capturada para "${currentLabel}"`);
  };

  const captureBurst = () => {
    if (!currentLabel) {
      toast.error("Escolha ou digite um rótulo para o gesto.");
      return;
    }
    setIsRecordingBurst(true);
    let captured = 0;
    const interval = setInterval(() => {
      if (addSample()) captured++;
      if (captured >= SAMPLES_PER_BURST) {
        clearInterval(interval);
        setIsRecordingBurst(false);
        toast.success(`${captured} amostras capturadas para "${currentLabel}"`);
      }
    }, BURST_INTERVAL_MS);
  };

  const removeLabelSamples = (labelToRemove: string) => {
    setSamples(prev => {
      const next = prev.filter(s => s.label !== labelToRemove);
      saveDataset(next);
      return next;
    });
  };

  const clearAllSamples = () => {
    setSamples([]);
    saveDataset([]);
    toast.info("Dataset de treino limpo.");
  };

  const handleTrain = async () => {
    if (samples.length === 0) {
      toast.error("Colete amostras antes de treinar.");
      return;
    }
    setIsTraining(true);
    setTrainingStatus("Iniciando treinamento...");
    try {
      const { labels, finalAccuracy } = await trainClassifier(samples, {
        epochs: 60,
        onProgress: progress => {
          setTrainingStatus(
            `Época ${progress.epoch}/${progress.totalEpochs} — perda: ${progress.loss.toFixed(3)}, acurácia: ${(progress.accuracy * 100).toFixed(1)}%`
          );
        },
      });
      setHasModel(true);
      toast.success(
        `Modelo treinado com ${labels.length} gestos (acurácia final ~${(finalAccuracy * 100).toFixed(1)}%).`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao treinar modelo.");
    } finally {
      setIsTraining(false);
      setTrainingStatus("");
    }
  };

  const handleImportPretrainedDataset = async () => {
    setIsImporting(true);
    setImportProgress(null);
    try {
      const imported = await importPretrainedAlphabetDataset({
        maxPerLabel: 150,
        onProgress: setImportProgress,
      });
      if (imported.length === 0) {
        toast.error("Nenhuma amostra pôde ser extraída do dataset.");
        return;
      }
      setSamples(prev => {
        const next = [...prev, ...imported];
        saveDataset(next);
        return next;
      });
      toast.success(`${imported.length} amostras importadas do dataset nacional de Libras.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao importar dataset.");
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  const handleDeleteModel = async () => {
    await deleteClassifier();
    setHasModel(false);
    toast.info("Modelo treinado removido. O reconhecimento voltará a usar o modo de referência.");
  };

  const counts = getSampleCountsByLabel(samples);
  const knownLabels = Object.keys(LIBRAS_GESTURES);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="container py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setLocation("/aluno")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Treinar Reconhecimento de Gestos</h1>
          <div className="w-24"></div>
        </div>
      </header>

      <main className="container py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="w-5 h-5" />
                  Captura de Amostras
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="video-container bg-black relative">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  {!isCapturing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted">
                      <p className="text-muted-foreground">Clique em "Iniciar Câmera"</p>
                    </div>
                  )}
                </div>

                {!isCapturing ? (
                  <Button className="w-full" onClick={startCamera}>
                    Iniciar Câmera
                  </Button>
                ) : (
                  <Button variant="destructive" className="w-full" onClick={stopCamera}>
                    Parar Câmera
                  </Button>
                )}

                {isLoading && <p className="text-sm text-muted-foreground text-center">Carregando MediaPipe...</p>}
                {error && <p className="text-sm text-destructive text-center">Erro: {error}</p>}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Rótulo do gesto</label>
                  <Select value={label} onValueChange={setLabel}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione um gesto conhecido" />
                    </SelectTrigger>
                    <SelectContent>
                      {knownLabels.map(key => (
                        <SelectItem key={key} value={key}>
                          {LIBRAS_GESTURES[key].name}
                        </SelectItem>
                      ))}
                      <SelectItem value="__custom__">Outro (digitar)...</SelectItem>
                    </SelectContent>
                  </Select>
                  {label === "__custom__" && (
                    <Input
                      placeholder="Nome do gesto (ex: F)"
                      value={customLabel}
                      onChange={e => setCustomLabel(e.target.value)}
                    />
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={captureSingleSample}
                    disabled={!isCapturing || isRecordingBurst}
                  >
                    Capturar 1 amostra
                  </Button>
                  <Button
                    className="flex-1"
                    variant="secondary"
                    onClick={captureBurst}
                    disabled={!isCapturing || isRecordingBurst}
                  >
                    {isRecordingBurst ? "Gravando..." : `Capturar ${SAMPLES_PER_BURST} (rajada)`}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Faça o gesto e clique em "Capturar" várias vezes (ou use a rajada), variando levemente
                  o ângulo e a posição da mão, para gerar amostras diversas do mesmo gesto.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Dataset Nacional de Libras
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Importa amostras do{" "}
                  <a
                    href="https://github.com/biankatpas/Brazilian-Sign-Language-Alphabet-Dataset"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Brazilian Sign Language Alphabet Dataset
                  </a>{" "}
                  (licença MIT), com fotos reais de 15 letras do alfabeto Libras que não dependem de
                  movimento: A, B, C, D, E, I, L, M, N, O, R, S, U, V, W. As demais letras (que envolvem
                  movimento) continuam precisando de captura pela webcam acima.
                </p>
                <Button className="w-full" onClick={handleImportPretrainedDataset} disabled={isImporting}>
                  {isImporting ? "Importando..." : "Importar dataset público (15 letras)"}
                </Button>
                {importProgress && (
                  <div className="space-y-1">
                    <div className="w-full bg-muted-foreground/20 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${(importProgress.processed / importProgress.total) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      {importProgress.processed}/{importProgress.total} imagens — letra atual:{" "}
                      {importProgress.currentLabel}
                      {importProgress.skipped > 0 && ` (${importProgress.skipped} sem mão detectada)`}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Dataset Coletado ({samples.length} amostras)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.keys(counts).length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Nenhuma amostra coletada ainda.</p>
                ) : (
                  <div className="space-y-2 max-h-[240px] overflow-y-auto">
                    {Object.entries(counts).map(([lbl, count]) => (
                      <div key={lbl} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                        <span className="text-sm font-medium">{lbl}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{count} amostras</span>
                          <Button size="sm" variant="ghost" onClick={() => removeLabelSamples(lbl)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={clearAllSamples} disabled={samples.length === 0}>
                    Limpar Dataset
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5" />
                  Treinamento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {hasModel
                    ? "Já existe um modelo treinado salvo no navegador. Treinar novamente substitui o modelo atual."
                    : "Nenhum modelo treinado ainda. Colete amostras de pelo menos 2 gestos diferentes e treine."}
                </p>
                <Button className="w-full" onClick={handleTrain} disabled={isTraining || samples.length === 0}>
                  {isTraining ? "Treinando..." : "Treinar Modelo"}
                </Button>
                {trainingStatus && <p className="text-xs text-muted-foreground text-center">{trainingStatus}</p>}
                {hasModel && (
                  <Button variant="outline" className="w-full" onClick={handleDeleteModel} disabled={isTraining}>
                    Remover Modelo Treinado
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
