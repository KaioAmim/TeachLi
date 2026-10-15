import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppRole, MICROSOFT_ROLE_DOMAINS, isMicrosoftLoginConfigured, startMicrosoftLogin } from "@/lib/microsoftAuth";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function LoginRequired({ role }: { role: AppRole }) {
  const [, setLocation] = useLocation();
  const roleName = role === "aluno" ? "aluno" : "professor";

  const signIn = async () => {
    try {
      await startMicrosoftLogin(role);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível iniciar o login.");
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center space-y-4">
          <p className="text-lg font-semibold">Entre como {roleName}</p>
          <p className="text-sm text-muted-foreground">
            Use sua conta Microsoft @{MICROSOFT_ROLE_DOMAINS[role]} para acessar este modo.
          </p>
          {isMicrosoftLoginConfigured() ? (
            <Button className="w-full" onClick={signIn}>Continuar com Microsoft</Button>
          ) : (
            <p className="rounded-md bg-muted p-3 text-left text-sm text-muted-foreground">
              O login ainda precisa do Client ID Microsoft no ambiente do projeto.
            </p>
          )}
          <Button variant="ghost" onClick={() => setLocation("/")}>Voltar</Button>
        </CardContent>
      </Card>
    </main>
  );
}
