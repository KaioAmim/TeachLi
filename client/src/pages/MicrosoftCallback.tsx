import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { TeachLiBrand } from "@/components/Brand";
import { Loader2, ShieldAlert } from "lucide-react";
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
      .then(() => {
        if (active)
          setLocation("/salas", { replace: true });
      })
      .catch(reason => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível concluir o login."
          );
      });
    return () => {
      active = false;
    };
  }, [setLocation]);

  return (
    <main id="conteudo" tabIndex={-1} className="auth-page">
      <div className="auth-card" aria-live="polite">
        <TeachLiBrand large />
        {error ? (
          <>
            <ShieldAlert
              className="mx-auto mb-4 text-destructive"
              size={28}
              aria-hidden="true"
            />
            <h1>Não foi possível entrar.</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => setLocation("/")}>Voltar ao início</Button>
          </>
        ) : (
          <>
            <Loader2
              className="mx-auto mb-4 animate-spin text-primary"
              size={28}
              aria-hidden="true"
            />
            <h1>Preparando seu espaço…</h1>
            <p className="text-sm text-muted-foreground">
              Depois do login, escolha sua sala de aula.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
