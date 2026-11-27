import "@/classroom.css";
import { ClassroomProvider, useClassroomConnection } from "@/contexts/ClassroomContext";
import RoomSelection from "@/pages/RoomSelection";
import { AppHeader, AppFooter } from "@/components/AppShell";
import VLibrasWidget from "@/components/VLibrasWidget";
import { Suspense, lazy } from "react";
import { Link, Route, Switch } from "wouter";
import { Toaster } from "sonner";
import Home from "@/pages/Home";
// Telas pesadas (câmera, TensorFlow.js, MediaPipe) só são baixadas quando a rota é aberta.
const StudentMode = lazy(() => import("@/pages/StudentMode"));
const TrainMode = lazy(() => import("@/pages/TrainMode"));
const ProfessorMode = lazy(() => import("@/pages/ProfessorMode"));
const EadMode = lazy(() => import("@/pages/EadMode"));
import LoginRequired from "@/pages/LoginRequired";
import MicrosoftCallback from "@/pages/MicrosoftCallback";
import { loadMicrosoftSession } from "@/lib/microsoftAuth";

function StudentRoute() {
  const { room } = useClassroomConnection();
  return loadMicrosoftSession("aluno") ? (
    room ? <StudentMode /> : <RoomSelection />
  ) : (
    <LoginRequired role="aluno" />
  );
}

function ProfessorRoute() {
  const { room } = useClassroomConnection();
  return loadMicrosoftSession("professor") ? (
    room ? <ProfessorMode /> : <RoomSelection />
  ) : (
    <LoginRequired role="professor" />
  );
}

function TrainRoute() {
  return loadMicrosoftSession("aluno") ? (
    <TrainMode />
  ) : (
    <LoginRequired role="aluno" />
  );
}

function ProfessorTrainRoute() {
  return loadMicrosoftSession("professor") ? (
    <TrainMode />
  ) : (
    <LoginRequired role="professor" />
  );
}

function EadRoute() {
  const session = loadMicrosoftSession();
  const { room } = useClassroomConnection();
  if (!session) return <LoginRequired role="aluno" />;
  return room ? <EadMode role={session.role} /> : <RoomSelection />;
}

export default function App() {
  return (
    <ClassroomProvider><div className="app-frame">
      <AppHeader />
      <VLibrasWidget />
      <Toaster richColors position="top-center" />
      <Suspense fallback={<main id="conteudo" className="auth-page" aria-busy="true"><p role="status">Carregando…</p></main>}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/entrar" component={MicrosoftCallback} />
        <Route path="/salas" component={RoomSelection} />
        <Route path="/aluno" component={StudentRoute} />
        <Route path="/aluno/treinar" component={TrainRoute} />
        <Route path="/professor" component={ProfessorRoute} />
        <Route path="/professor/treinar" component={ProfessorTrainRoute} />
        <Route path="/ead" component={EadRoute} />
        <Route>
          <main id="conteudo" tabIndex={-1} className="auth-page">
            <div className="auth-card">
              <h1>Página não encontrada</h1>
              <p>
                Este endereço não está disponível. Volte ao início para escolher
                seu espaço.
              </p>
              <Link href="/" className="auth-back">
                Voltar ao início
              </Link>
            </div>
          </main>
        </Route>
      </Switch>
      </Suspense>
      <AppFooter />
    </div></ClassroomProvider>
  );
}
