import { Route, Switch } from "wouter";
import { Toaster } from "sonner";
import Home from "@/pages/Home";
import StudentMode from "@/pages/StudentMode";
import TrainMode from "@/pages/TrainMode";
import ProfessorMode from "@/pages/ProfessorMode";
import LoginRequired from "@/pages/LoginRequired";
import MicrosoftCallback from "@/pages/MicrosoftCallback";
import { loadMicrosoftSession } from "@/lib/microsoftAuth";

function StudentRoute() {
  return loadMicrosoftSession("aluno") ? <StudentMode /> : <LoginRequired role="aluno" />;
}

function ProfessorRoute() {
  return loadMicrosoftSession("professor") ? <ProfessorMode /> : <LoginRequired role="professor" />;
}

function TrainRoute() {
  return loadMicrosoftSession("aluno") ? <TrainMode /> : <LoginRequired role="aluno" />;
}

export default function App() {
  return (
    <>
      <Toaster richColors position="top-center" />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/entrar" component={MicrosoftCallback} />
        <Route path="/aluno" component={StudentRoute} />
        <Route path="/aluno/treinar" component={TrainRoute} />
        <Route path="/professor" component={ProfessorRoute} />
        <Route>
          <div className="min-h-screen flex items-center justify-center text-muted-foreground">
            Página não encontrada
          </div>
        </Route>
      </Switch>
    </>
  );
}
