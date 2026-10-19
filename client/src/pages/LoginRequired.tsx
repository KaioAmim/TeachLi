import { Link } from "wouter";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeachLiBrand } from "@/components/Brand";
import {
  AppRole,
  MICROSOFT_ROLE_DOMAINS,
  isMicrosoftLoginConfigured,
} from "@/lib/microsoftAuth";
import { useMicrosoftSignIn } from "@/hooks/useMicrosoftSignIn";

export default function LoginRequired({ role }: { role: AppRole }) {
  const { pendingRole, signIn } = useMicrosoftSignIn();
  const isPending = pendingRole !== null;

  return (
    <main id="conteudo" tabIndex={-1} className="auth-page">
      <div className="auth-card">
        <TeachLiBrand large />
        <h1>Seu espaço de {role === "aluno" ? "aluno" : "professor"}</h1>
        <p>
          Entre com sua conta Microsoft institucional para continuar.
          <span className="auth-domain">@{MICROSOFT_ROLE_DOMAINS[role]}</span>
        </p>
        {isMicrosoftLoginConfigured() ? (
          <Button
            className="w-full gap-2"
            onClick={() => void signIn(role)}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="animate-spin" size={17} aria-hidden="true" />
            ) : (
              <ShieldCheck size={17} aria-hidden="true" />
            )}
            {isPending ? "Abrindo Microsoft…" : "Continuar com Microsoft"}
          </Button>
        ) : (
          <p role="status" className="rounded-md bg-muted p-3 text-left">
            O acesso institucional ainda não está disponível. Entre em contato
            com o responsável pelo TeachLi na instituição.
          </p>
        )}
        <Link href="/" className="auth-back">
          <ArrowLeft size={16} aria-hidden="true" />
          Escolher outro perfil
        </Link>
      </div>
    </main>
  );
}
