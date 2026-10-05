import { useEffect, useRef } from "react";
import { useLocation, useParams, useSearchParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, LogOut, MicOff, VideoOff } from "lucide-react";
import { toast } from "sonner";
import { useClassroom } from "@/hooks/useClassroom";
import type { Role } from "@/lib/webrtc/signalingClient";

function VideoTile({
  stream,
  label,
  muted,
  highlight,
}: {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
  highlight?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div
      className={`relative rounded-lg overflow-hidden bg-muted aspect-video ${
        highlight ? "ring-2 ring-primary" : ""
      }`}
    >
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
          Conectando...
        </div>
      )}
      <span className="absolute bottom-1.5 left-1.5 text-xs bg-black/60 text-white px-2 py-0.5 rounded">
        {label}
      </span>
    </div>
  );
}

export default function Classroom() {
  const [, setLocation] = useLocation();
  const params = useParams<{ roomId: string }>();
  const [search] = useSearchParams();

  const roomId = (params.roomId ?? "").toUpperCase();
  const role = (search.get("role") === "professor" ? "professor" : "aluno") as Role;
  const name = search.get("name") || (role === "professor" ? "Professor(a)" : "Aluno(a)");

  const { status, errorMessage, localStream, peers } = useClassroom({ roomId, role, name });

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId).then(
      () => toast.success("Código da sala copiado"),
      () => toast.error("Não foi possível copiar — o código é: " + roomId)
    );
  };

  const leave = () => setLocation("/sala");

  if (status === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-destructive font-medium">{errorMessage ?? "Não foi possível entrar na sala."}</p>
            <Button onClick={leave}>Voltar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">
            Sala <span className="font-mono">{roomId}</span>{" "}
            {role === "professor" && (
              <button onClick={copyRoomCode} className="inline-flex items-center gap-1 text-primary text-xs align-middle">
                <Copy className="w-3 h-3" /> copiar código
              </button>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {status === "connecting"
              ? "Conectando..."
              : role === "professor"
                ? `${peers.length} aluno(s) na sala`
                : "Conectado à aula"}
          </p>
        </div>
        <Button variant="destructive" size="sm" onClick={leave}>
          <LogOut className="w-4 h-4 mr-2" />
          Sair
        </Button>
      </header>

      <main className="container py-6 max-w-6xl">
        {role === "professor" ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <VideoTile stream={localStream} label={`${name} (você)`} muted highlight />
            {peers.map(p => (
              <VideoTile key={p.id} stream={p.stream} label={p.name ?? "Aluno(a)"} />
            ))}
            {peers.length === 0 && (
              <Card className="sm:col-span-2 lg:col-span-2">
                <CardContent className="pt-6 text-center text-sm text-muted-foreground">
                  Nenhum aluno entrou ainda. Compartilhe o código <strong>{roomId}</strong> com a
                  turma.
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {peers.length > 0 ? (
              peers.map(p => <VideoTile key={p.id} stream={p.stream} label={p.name ?? "Professor(a)"} highlight />)
            ) : (
              <Card>
                <CardContent className="pt-6 text-center text-sm text-muted-foreground">
                  Aguardando o professor entrar na sala...
                </CardContent>
              </Card>
            )}
            <VideoTile stream={localStream} label={`${name} (você)`} muted />
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center mt-6 flex items-center justify-center gap-4">
          <span className="inline-flex items-center gap-1">
            <VideoOff className="w-3 h-3" /> câmera e <MicOff className="w-3 h-3" /> microfone ficam
            só com você e com quem está na sala — nada é gravado ou enviado a um servidor além da
            conexão direta entre os participantes.
          </span>
        </p>
      </main>
    </div>
  );
}
