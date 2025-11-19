import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Mic, Video, Calendar } from "lucide-react";
import { useLocation } from "wouter";

export default function History() {
  const [, setLocation] = useLocation();

  // TODO: Implementar integração com tRPC para buscar histórico real
  // const { data: sessions, isLoading } = trpc.session.list.useQuery();
  
  // Dados de exemplo para demonstração
  const mockSessions = [
    {
      id: 1,
      title: "Aula de Matemática",
      type: "professor",
      startedAt: new Date("2024-01-15T10:00:00"),
      translationsCount: 45,
    },
    {
      id: 2,
      title: "Sessão de Perguntas",
      type: "aluno",
      startedAt: new Date("2024-01-15T11:30:00"),
      translationsCount: 12,
    },
    {
      id: 3,
      title: "Aula de História",
      type: "professor",
      startedAt: new Date("2024-01-14T14:00:00"),
      translationsCount: 38,
    },
  ];

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="container py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setLocation('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Histórico de Traduções</h1>
          <div className="w-24"></div>
        </div>
      </header>

      <main className="container py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sessões Recentes</CardTitle>
              <CardDescription>
                Visualize suas sessões anteriores de interpretação
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mockSessions.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Nenhuma sessão encontrada
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Inicie uma sessão de interpretação para ver o histórico aqui
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {mockSessions.map((session) => (
                    <Card key={session.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex gap-4 flex-1">
                            <div className="flex-shrink-0">
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                session.type === 'professor' 
                                  ? 'bg-primary/10' 
                                  : 'bg-chart-2/10'
                              }`}>
                                {session.type === 'professor' ? (
                                  <Mic className={`w-6 h-6 ${
                                    session.type === 'professor' 
                                      ? 'text-primary' 
                                      : 'text-chart-2'
                                  }`} />
                                ) : (
                                  <Video className={`w-6 h-6 ${
                                    session.type === 'professor' 
                                      ? 'text-primary' 
                                      : 'text-chart-2'
                                  }`} />
                                )}
                              </div>
                            </div>
                            
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg mb-1">
                                {session.title || `Sessão ${session.id}`}
                              </h3>
                              <p className="text-sm text-muted-foreground mb-2">
                                {session.type === 'professor' ? 'Modo Professor' : 'Modo Aluno'}
                              </p>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  {formatDate(session.startedAt)}
                                </span>
                                <span>
                                  {session.translationsCount} traduções
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <Button variant="outline" size="sm">
                            Ver Detalhes
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg">Estatísticas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-3xl font-bold text-foreground">
                    {mockSessions.length}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Sessões
                  </p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground">
                    {mockSessions.reduce((acc, s) => acc + s.translationsCount, 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Traduções
                  </p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground">
                    {mockSessions.filter(s => s.type === 'professor').length}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Modo Professor
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
