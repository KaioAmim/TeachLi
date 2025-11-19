import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { Mic, Video, History, LogOut } from "lucide-react";
import { useLocation } from "wouter";

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
        <div className="text-center max-w-2xl">
          <div className="mb-8">
            {APP_LOGO && <img src={APP_LOGO} alt="Logo" className="h-20 mx-auto mb-4" />}
            <h1 className="text-4xl font-bold text-foreground mb-4">
              {APP_TITLE}
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              Sistema de interpretação bidirecional entre português falado e Libras. 
              Facilitando a comunicação entre professores e alunos surdos.
            </p>
          </div>
          
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Como funciona?</CardTitle>
            </CardHeader>
            <CardContent className="text-left space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mic className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Modo Professor</h3>
                  <p className="text-sm text-muted-foreground">
                    Fale no microfone e suas palavras serão traduzidas para Libras em vídeo, 
                    exibido em tempo real para os alunos.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Video className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Modo Aluno</h3>
                  <p className="text-sm text-muted-foreground">
                    Use a câmera para fazer gestos em Libras e o sistema converterá 
                    para português falado, reproduzido em áudio.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button size="lg" onClick={() => window.location.href = getLoginUrl()}>
            Entrar para Começar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary">
      <header className="bg-card border-b border-border">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {APP_LOGO && <img src={APP_LOGO} alt="Logo" className="h-10" />}
            <h1 className="text-2xl font-bold text-foreground">{APP_TITLE}</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Olá, {user?.name || 'Usuário'}
            </span>
            <Button variant="ghost" size="sm" onClick={() => logout()}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Selecione o Modo de Interpretação
          </h2>
          <p className="text-lg text-muted-foreground">
            Escolha como você deseja usar o sistema de interpretação
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-12">
          <Card 
            className="mode-card"
            onClick={() => setLocation('/professor')}
          >
            <CardHeader>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 mx-auto">
                <Mic className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-center text-2xl">Modo Professor</CardTitle>
              <CardDescription className="text-center">
                Fala para Libras
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-6">
                Fale no microfone e suas palavras serão automaticamente traduzidas 
                para Libras e exibidas em vídeo para os alunos.
              </p>
              <Button className="w-full">
                Iniciar Modo Professor
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="mode-card"
            onClick={() => setLocation('/aluno')}
          >
            <CardHeader>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 mx-auto">
                <Video className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-center text-2xl">Modo Aluno</CardTitle>
              <CardDescription className="text-center">
                Libras para Fala
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-6">
                Use a câmera para fazer gestos em Libras e o sistema converterá 
                automaticamente para português falado em áudio.
              </p>
              <Button className="w-full">
                Iniciar Modo Aluno
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Button 
            variant="outline" 
            size="lg"
            onClick={() => setLocation('/historico')}
          >
            <History className="w-5 h-5 mr-2" />
            Ver Histórico de Traduções
          </Button>
        </div>
      </main>
    </div>
  );
}
