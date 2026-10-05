import { Route, Switch } from "wouter";
import { Toaster } from "sonner";
import Home from "@/pages/Home";
import StudentMode from "@/pages/StudentMode";
import TrainMode from "@/pages/TrainMode";
import SalaAula from "@/pages/SalaAula";
import Classroom from "@/pages/Classroom";

export default function App() {
  return (
    <>
      <Toaster richColors position="top-center" />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/aluno" component={StudentMode} />
        <Route path="/aluno/treinar" component={TrainMode} />
        <Route path="/sala" component={SalaAula} />
        <Route path="/sala/:roomId" component={Classroom} />
        <Route>
          <div className="min-h-screen flex items-center justify-center text-muted-foreground">
            Página não encontrada
          </div>
        </Route>
      </Switch>
    </>
  );
}
