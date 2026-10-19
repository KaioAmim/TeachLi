import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  GraduationCap,
  MessageSquare,
  Home,
} from "lucide-react";
import { UniversityBrand, TeachLiBrand } from "@/components/Brand";

export function AppHeader() {
  const [location] = useLocation();
  const home = location === "/";
  const student = location.startsWith("/aluno");
  const professor = location === "/professor";
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
                <Link href="/" aria-label="Início">
                  <Home size={17} aria-hidden="true" />
                  <span>Início</span>
                </Link>
                {student && (
                  <>
                    <Link
                      href="/aluno"
                      aria-current={location === "/aluno" ? "page" : undefined}
                    >
                      <MessageSquare size={17} aria-hidden="true" />
                      Aluno
                    </Link>
                    <Link
                      href="/aluno/treinar"
                      aria-current={
                        location === "/aluno/treinar" ? "page" : undefined
                      }
                    >
                      <BookOpen size={17} aria-hidden="true" />
                      Treinar
                    </Link>
                  </>
                )}
                {professor && (
                  <Link href="/professor" aria-current="page">
                    <GraduationCap size={17} aria-hidden="true" />
                    Professor
                  </Link>
                )}
              </>
            )}
          </nav>
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
        {backTo === "/" ? "Página inicial" : "Voltar ao aluno"}
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
