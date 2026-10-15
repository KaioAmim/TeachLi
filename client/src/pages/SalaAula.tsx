import { FormEvent, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { clearProfessorDemoSession, loadProfessorDemoSession, signInProfessorDemo } from "@/lib/demoAuth";
import { ArrowLeft, GraduationCap, KeyRound, LogIn, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

function generateRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export default function SalaAula() {
  const [, setLocation] = useLocation();
  const [professorName, setProfessorName] = useState("");
  const [professorEmail, setProfessorEmail] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [session, setSession] = useState(() => loadProfessorDemoSession());
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const startAsTeacher = () => {
    if (!session) return;
    const roomId = generateRoomCode();
    setLocation(`/sala/${roomId}?role=professor&name=${encodeURIComponent(session.profile.name)}`);
  };

  const signInTeacher = async (event: FormEvent) => {
    event.preventDefault();
    setIsSigningIn(true);
    try {
      const nextSession = await signInProfessorDemo({
        name: professorName,
        email: professorEmail,
        accessCode,
      });
      setSession(nextSession);
      setAccessCode("");
      toast.success("Sessão demo de professor iniciada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível iniciar a sessão demo.");
    } finally {
      setIsSigningIn(false);
    }
  };

  const signOutTeacher = () => {
    clearProfessorDemoSession();
    setSession(null);
    toast.success("Sessão de professor encerrada.");
  };

  const joinAsStudent = () => {
    const roomId = joinCode.trim().toUpperCase();
    if (!roomId) return;
    const params = new URLSearchParams({ role: "aluno", name: studentName.trim() || "Aluno(a)" });
    setLocation(`/sala/${roomId}?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-12 max-w-4xl">
        <Button variant="ghost" className="mb-8" onClick={() => setLocation("/")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        <div className="max-w-2xl mb-9">
          <div className="flex items-center gap-3 mb-3">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <GraduationCap className="w-7 h-7" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Sala de Aula</h1>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Crie uma sala como professor ou entre com o código compartilhado pela turma. A chamada é
            direta entre os participantes e pede acesso à câmera e ao microfone ao entrar.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <Card className="border-primary/30 shadow-sm">
            <CardHeader className="border-b bg-primary/[0.03]">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Professor(a)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {session ? (
                <div className="space-y-5">
                  <div className="rounded-lg border bg-background px-4 py-3">
                    <p className="text-sm font-medium">{session.profile.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{session.profile.email}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Sua sessão demo está ativa neste navegador. Só uma sessão validada pode iniciar
                    uma aula.
                  </p>
                  <Button className="w-full" onClick={startAsTeacher}>
                    Criar sala de aula
                  </Button>
                  <Button variant="ghost" className="w-full" onClick={signOutTeacher}>
                    Sair da sessão demo
                  </Button>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={signInTeacher}>
                  <p className="text-sm text-muted-foreground">
                    Ambiente de demonstração. Use um e-mail de professor <strong>@unibarretos.com.br</strong>
                    e o código demo configurado no servidor.
                  </p>
                  <label className="block text-sm font-medium">
                    Seu nome
                    <input
                      className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={professorName}
                      onChange={event => setProfessorName(event.target.value)}
                      placeholder="Como aparecerá para a turma"
                      autoComplete="name"
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    E-mail institucional
                    <input
                      className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={professorEmail}
                      onChange={event => setProfessorEmail(event.target.value)}
                      placeholder="nome@unibarretos.com.br"
                      type="email"
                      autoComplete="email"
                      required
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Código de demonstração
                    <input
                      className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={accessCode}
                      onChange={event => setAccessCode(event.target.value)}
                      type="password"
                      autoComplete="one-time-code"
                      required
                    />
                  </label>
                  <Button className="w-full" type="submit" disabled={isSigningIn}>
                    <KeyRound className="w-4 h-4 mr-2" />
                    {isSigningIn ? "Validando..." : "Entrar como professor"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <LogIn className="w-5 h-5" />
                Aluno(a)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Peça o código de seis caracteres ao professor. Nesta demonstração, alunos entram sem
                conta para reduzir o atrito da turma.
              </p>
              <label className="block text-sm font-medium">
                Seu nome
                <input
                  className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={studentName}
                  onChange={event => setStudentName(event.target.value)}
                  placeholder="Como aparecerá na sala"
                />
              </label>
              <label className="block text-sm font-medium">
                Código da sala
                <input
                  className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm uppercase tracking-[0.24em] text-center font-mono"
                  value={joinCode}
                  onChange={event => setJoinCode(event.target.value)}
                  placeholder="ABC123"
                  maxLength={6}
                />
              </label>
              <Button variant="outline" className="w-full" onClick={joinAsStudent} disabled={!joinCode.trim()}>
                Entrar na aula
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
