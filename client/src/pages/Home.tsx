import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Hand, GraduationCap, Video, Users } from "lucide-react";

export default function Home() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-16 max-w-3xl">
        <div className="text-center mb-12">
          <Hand className="w-14 h-14 text-primary mx-auto mb-4" />
          <h1 className="text-4xl font-bold mb-3">Reconhecimento de Datilologia em Libras</h1>
          <p className="text-muted-foreground">
            Reconhece 15 letras estáticas do alfabeto manual a partir da webcam. Não interpreta
            Libras como língua — apenas configuração de mão, em um quadro parado.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Video className="w-5 h-5" />
                Modo Aluno
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Liga a câmera e reconhece os sinais em tempo real, com leitura em voz alta do texto.
              </p>
              <Button className="w-full" onClick={() => setLocation("/aluno")}>
                Abrir
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <GraduationCap className="w-5 h-5" />
                Treinar Gestos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Captura amostras próprias na webcam e treina um classificador que substitui o
                modelo base.
              </p>
              <Button variant="outline" className="w-full" onClick={() => setLocation("/aluno/treinar")}>
                Abrir
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="w-5 h-5" />
                Sala de Aula
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Videochamada em tempo real entre professor e alunos, direto no navegador.
              </p>
              <Button variant="outline" className="w-full" onClick={() => setLocation("/sala")}>
                Abrir
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
