import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Hand, GraduationCap, Video } from "lucide-react";
import { AppRole, MICROSOFT_ROLE_DOMAINS, startMicrosoftLogin } from "@/lib/microsoftAuth";
import { toast } from "sonner";

export default function Home() {
  const [, setLocation] = useLocation();
  const signIn = async (role: AppRole) => {
    try {
      await startMicrosoftLogin(role);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível iniciar o login Microsoft.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-16 max-w-3xl">
        <div className="text-center mb-12">
          <Hand className="w-14 h-14 text-primary mx-auto mb-4" />
          <h1 className="text-4xl font-bold mb-3">Reconhecimento de Datilologia em Libras</h1>
          <p className="text-muted-foreground">
            Reconhece 15 letras estáticas do alfabeto manual a partir da webcam. Não interpreta
            Libras como língua — apenas configuração de mão, em um quadro parado.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Video className="w-5 h-5" />
                Aluno
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Reconheça sinais pela câmera, escreva mensagens e use a leitura em voz alta.
              </p>
              <Button className="w-full" onClick={() => void signIn("aluno")}>
                Entrar como aluno
              </Button>
              <p className="text-xs text-muted-foreground">Conta @{MICROSOFT_ROLE_DOMAINS.aluno}</p>
            </CardContent>
          </Card>

          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <GraduationCap className="w-5 h-5" />
                Professor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Transforme a fala em texto para apoiar a comunicação com a turma.
              </p>
              <Button className="w-full" onClick={() => void signIn("professor")}>
                Entrar como professor
              </Button>
              <p className="text-xs text-muted-foreground">Conta @{MICROSOFT_ROLE_DOMAINS.professor}</p>
            </CardContent>
          </Card>
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Quer personalizar o reconhecimento?{" "}
          <button className="font-medium text-primary underline underline-offset-4" onClick={() => setLocation("/aluno/treinar")}>
            Treinar gestos
          </button>
        </p>
      </main>
    </div>
  );
}
