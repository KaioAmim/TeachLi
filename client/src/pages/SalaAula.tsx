import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, GraduationCap, LogIn } from "lucide-react";

/** Gera um código de sala curto e fácil de ditar/digitar (sem caracteres ambíguos como 0/O, 1/I). */
function generateRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export default function SalaAula() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const startAsTeacher = () => {
    const roomId = generateRoomCode();
    const params = new URLSearchParams({ role: "professor", name: name.trim() || "Professor(a)" });
    setLocation(`/sala/${roomId}?${params.toString()}`);
  };

  const joinAsStudent = () => {
    const roomId = joinCode.trim().toUpperCase();
    if (!roomId) return;
    const params = new URLSearchParams({ role: "aluno", name: name.trim() || "Aluno(a)" });
    setLocation(`/sala/${roomId}?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-16 max-w-xl">
        <Button variant="ghost" className="mb-6" onClick={() => setLocation("/")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        <div className="text-center mb-8">
          <GraduationCap className="w-12 h-12 text-primary mx-auto mb-3" />
          <h1 className="text-3xl font-bold mb-2">Sala de Aula</h1>
          <p className="text-muted-foreground text-sm">
            Videochamada em tempo real entre professor e alunos, direto no navegador — sem instalar
            nada. A conexão é ponto a ponto (WebRTC): funciona bem em redes abertas, mas pode falhar
            em redes escolares/corporativas com firewall restritivo.
          </p>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <label className="text-sm font-medium mb-1.5 block">Seu nome</label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Como os outros vão te ver na sala"
            />
          </CardContent>
        </Card>

        <div className="grid sm:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sou professor(a)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Cria uma sala nova agora e gera um código para compartilhar com a turma.
              </p>
              <Button className="w-full" onClick={startAsTeacher}>
                Iniciar aula
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <LogIn className="w-4 h-4" />
                Sou aluno(a)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                className="w-full rounded-md border bg-background px-3 py-2 text-sm uppercase tracking-widest text-center font-mono"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value)}
                placeholder="CÓDIGO DA SALA"
                maxLength={6}
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={joinAsStudent}
                disabled={!joinCode.trim()}
              >
                Entrar na aula
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
