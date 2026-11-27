import { useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  MessageSquare,
  Home,
  PhoneCall,
  MapPin,
  CircleUserRound,
  DoorOpen,
  LogOut,
} from "lucide-react";
import { UniversityBrand, TeachLiBrand } from "@/components/Brand";
import { useClassroomConnection } from "@/contexts/ClassroomContext";
import { loadMicrosoftSession, logoutMicrosoftSession } from "@/lib/microsoftAuth";

export function RoomStatus() {
  const { room, status } = useClassroomConnection();
  return <span className="room-status" role="status"><i data-connected={status === "connected"} aria-hidden="true" /><MapPin size={15} aria-hidden="true" />{room?.name} · {status === "connected" ? "Conectado" : "Desconectado"}</span>;
}

export function AppHeader() {
  const [location, navigate] = useLocation();
  const { leave } = useClassroomConnection();
  const session = loadMicrosoftSession();
  const profileLabel = session?.role === "professor" ? "Professor" : "Aluno";
  const profilePath = session?.role === "professor" ? "/professor" : "/aluno";
  const trainingPath = session?.role === "professor" ? "/professor/treinar" : "/aluno/treinar";
  const [accountError, setAccountError] = useState("");
  const accountMenuRef = useRef<HTMLDetailsElement>(null);
  const home = location === "/";
  const changeRoom = () => { if (accountMenuRef.current) accountMenuRef.current.open = false; setAccountError(""); leave(); navigate("/salas"); };
  const logout = async () => {
    if (accountMenuRef.current) accountMenuRef.current.open = false;
    try { await logoutMicrosoftSession(); leave(); navigate("/"); }
    catch { setAccountError("Não foi possível sair da conta. Confira a conexão e tente novamente."); }
  };
  return (
    <>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="app-header">
        <div className="container header-inner">
          <Link
            href="/"
            className="university-link"
            aria-label="UniBarretos, página inicial"
          >
            <UniversityBrand />
          </Link>
          <nav aria-label="Navegação principal" className="header-nav">
            {home ? (
              <>
                <a href="#acesso">
                  Acessar plataforma{" "}
                  <ArrowUpRight size={15} aria-hidden="true" />
                </a>
                <a href="#como-funciona">Como funciona</a>
              </>
            ) : (
              <>
                <Link href={session ? "/salas" : "/"} aria-label="Início">
                  <Home size={17} aria-hidden="true" />
                  <span>Início</span>
                </Link>
                <Link href={profilePath} aria-current={location === profilePath ? "page" : undefined}>
                  <MessageSquare size={17} aria-hidden="true" />
                  {profileLabel}
                </Link>
                <Link href={trainingPath} aria-current={location === trainingPath ? "page" : undefined}>
                  <BookOpen size={17} aria-hidden="true" />
                  Treinar Gestos
                </Link>
                <Link href="/ead" aria-current={location === "/ead" ? "page" : undefined}>
                  <PhoneCall size={17} aria-hidden="true" />
                  EAD
                </Link>
              </>
            )}
          </nav>
          {!home && <details ref={accountMenuRef} className="account-menu">
            <summary><CircleUserRound size={17} aria-hidden="true" /><span>Conta</span></summary>
            <div className="account-menu-panel">
              <button type="button" onClick={changeRoom}><DoorOpen size={16} aria-hidden="true" /> Trocar sala</button>
              <button type="button" onClick={() => void logout()}><LogOut size={16} aria-hidden="true" /> Sair da conta</button>
              {accountError && <p role="alert">{accountError}</p>}
            </div>
          </details>}
          <Link
            href="/"
            className="product-brand"
            aria-label="TeachLi, página inicial"
          >
            <TeachLiBrand />
          </Link>
        </div>
      </header>
    </>
  );
}

export function AppFooter() {
  return (
    <footer className="app-footer container">
      <p>
        <strong>TeachLi</strong> <span>Comunicação que aproxima.</span>
      </p>
      <p>
        UniBarretos{" "}
        <span className="footer-divider" aria-hidden="true">
          /
        </span>{" "}
        Apoio à comunicação em sala de aula
      </p>
    </footer>
  );
}

export function WorkspaceHeading({
  title,
  description,
  backTo = "/",
  children,
}: {
  title: string;
  description: string;
  backTo?: string;
  children?: ReactNode;
}) {
  return (
    <section className="workspace-heading container">
      <Link href={backTo} className="back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        {backTo === "/" ? "Página inicial" : backTo === "/professor" ? "Voltar ao professor" : "Voltar ao aluno"}
      </Link>
      <div className="workspace-heading-row">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {children}
      </div>
    </section>
  );
}
