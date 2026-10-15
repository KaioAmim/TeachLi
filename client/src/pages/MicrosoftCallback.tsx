import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { finishMicrosoftLogin } from "@/lib/microsoftAuth";

export default function MicrosoftCallback() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const login = useRef<ReturnType<typeof finishMicrosoftLogin> | null>(null);

  useEffect(() => {
    let active = true;
    // StrictMode runs effects twice in development; exchange each code only once.
    login.current ??= finishMicrosoftLogin(window.location.search);
    login.current
      .then(session => {
        if (active) setLocation(session.role === "aluno" ? "/aluno" : "/professor");
      })
      .catch(reason => {
        if (active) setError(reason instanceof Error ? reason.message : "Não foi possível concluir o login.");
      });
    return () => { active = false; };
  }, [setLocation]);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center space-y-4">
          {error ? (
            <>
              <p className="font-medium text-destructive">Não foi possível entrar.</p>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button onClick={() => setLocation("/")}>Voltar ao início</Button>
            </>
          ) : (
            <>
              <p className="font-medium">Concluindo o login Microsoft…</p>
              <p className="text-sm text-muted-foreground">Você será direcionado para o modo escolhido.</p>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
