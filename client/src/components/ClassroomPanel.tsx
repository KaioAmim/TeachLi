import { useState } from "react";
import { logoutMicrosoftSession } from "@/lib/microsoftAuth";
import { useLocation } from 'wouter';
import { MapPin, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useClassroomConnection } from '@/contexts/ClassroomContext';

export function ClassroomPanel() {
  const { room, status, error, professor, students, messages, sendStatus, leave } = useClassroomConnection();
  const [logoutError, setLogoutError] = useState("");
  const [, navigate] = useLocation();
  const changeRoom = () => { leave(); navigate('/salas'); };
  const logout = async () => {
    try { await logoutMicrosoftSession(); leave(); navigate("/"); } catch { setLogoutError("Não foi possível sair da conta. Confira a conexão e tente novamente."); }
  };
  return <section className="container classroom-panel" aria-label="Comunicação da sala">
    <div className="classroom-bar"><div><strong><MapPin size={18} aria-hidden="true" /> {room?.name}</strong>
      <p role="status">{status !== 'connected' ? 'Desconectado' : professor ? `Professor presente · ${students} aluno(s) conectado(s)` : 'Aguardando professor'}</p></div>
      <div className="room-actions"><Button variant="outline" onClick={changeRoom}>{status === 'disconnected' ? 'Entrar novamente' : 'Trocar sala'}</Button><Button variant="ghost" onClick={logout}>Sair da conta</Button></div></div>
    {logoutError && <p className="room-error" role="alert">{logoutError}</p>}
    {error && <p className="room-error" role="alert">{error}</p>}
    <div className="classroom-messages" role="log" aria-label="Mensagens recebidas" aria-live="polite" aria-relevant="additions" tabIndex={0}>
      {!messages.length && <p className="room-hint">As mensagens e legendas recebidas nesta sala aparecerão aqui.</p>}
      {messages.map(message => <article key={message.id}><strong>{message.author} · {message.role === 'professor' ? 'Professor' : 'Aluno'}</strong><p>{message.text}</p>
        {message.role === 'aluno' && <Button variant="ghost" onClick={() => {
          if (!('speechSynthesis' in window)) return;
          window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(message.text); utterance.lang = 'pt-BR'; window.speechSynthesis.speak(utterance);
        }}><Volume2 size={16} aria-hidden="true" /> Ouvir mensagem</Button>}
      </article>)}
    </div>
    <p className="room-hint" role="status">{sendStatus || 'As mensagens ficam nesta tela até você sair ou trocar de sala.'}</p>
  </section>;
}
