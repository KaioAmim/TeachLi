import "@/classroom.css";
import { ClassroomProvider, useClassroomConnection } from "@/contexts/ClassroomContext";
import RoomSelection from "@/pages/RoomSelection";
import { AppHeader, AppFooter } from "@/components/AppShell";
import { Link, Route, Switch } from "wouter";
import { Toaster } from "sonner";
import Home from "@/pages/Home";
import StudentMode from "@/pages/StudentMode";
import TrainMode from "@/pages/TrainMode";
import ProfessorMode from "@/pages/ProfessorMode";
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

export default function App() {
  return (
    <ClassroomProvider><div className="app-frame">
      <AppHeader />
      <Toaster richColors position="top-center" />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/entrar" component={MicrosoftCallback} />
        <Route path="/salas" component={RoomSelection} />
        <Route path="/aluno" component={StudentRoute} />
        <Route path="/aluno/treinar" component={TrainRoute} />
        <Route path="/professor" component={ProfessorRoute} />
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
      <AppFooter />
    </div></ClassroomProvider>
  );
}
