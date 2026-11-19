import { useState } from "react";
import { logoutMicrosoftSession } from "@/lib/microsoftAuth";
import { useLocation } from 'wouter';
import { GraduationCap, MapPin, MessageSquareText, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useClassroomConnection } from '@/contexts/ClassroomContext';

export function ClassroomPanel({ compact = false, embedded = false, showAutoSpeak = false }: { compact?: boolean; embedded?: boolean; showAutoSpeak?: boolean }) {
  const { room, status, error, professor, students, messages, sendStatus, leave, autoSpeak, setAutoSpeak } = useClassroomConnection();
  const [logoutError, setLogoutError] = useState("");
  const [, navigate] = useLocation();
  const newestFirst = [...messages].reverse();
  const formatTime = (timestamp: number) => new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
  const changeRoom = () => { leave(); navigate('/salas'); };
  const logout = async () => {
    try { await logoutMicrosoftSession(); leave(); navigate("/"); } catch { setLogoutError("Não foi possível sair da conta. Confira a conexão e tente novamente."); }
  };
  return <section className={`classroom-panel${embedded ? ' classroom-panel-embedded' : ' container'}`} aria-label="Comunicação da sala">
    {!compact && <div className="classroom-bar"><div className="classroom-room-info"><strong><MapPin size={18} aria-hidden="true" /> {room?.name}</strong>
      <p role="status"><i className="classroom-status-dot" data-connected={status === 'connected'} aria-hidden="true" />{status !== 'connected' ? 'Desconectado' : professor ? `Professor presente · ${students} aluno(s) conectado(s)` : 'Aguardando professor'}</p></div>
      <div className="room-actions"><Button variant="outline" onClick={changeRoom}>{status === 'disconnected' ? 'Entrar novamente' : 'Trocar sala'}</Button><Button variant="ghost" onClick={logout}>Sair da conta</Button></div></div>}
    {logoutError && <p className="room-error" role="alert">{logoutError}</p>}
    {error && <p className="room-error" role="alert">{error}</p>}
    <div className="classroom-inbox">
      <div className="classroom-inbox-heading">
        <div><span className="classroom-inbox-icon"><MessageSquareText size={18} aria-hidden="true" /></span><div><h2>Mensagens da sala</h2><p>As mensagens novas aparecem primeiro.</p></div></div>
        <div className="classroom-heading-actions"><span className="classroom-message-count">{messages.length} {messages.length === 1 ? 'mensagem' : 'mensagens'}</span></div>
      </div>
      <div className="classroom-messages" role="log" aria-label="Mensagens recebidas, mais recentes primeiro" aria-live="polite" aria-relevant="additions" tabIndex={0}>
      {!messages.length && <div className="classroom-empty"><GraduationCap size={22} aria-hidden="true" /><p>Quando alguém enviar uma mensagem nesta sala, ela aparecerá aqui.</p></div>}
      {newestFirst.map(message => <article key={message.id} data-role={message.role}>
        <div className="classroom-message-meta"><strong>{message.author}</strong><span>{message.role === 'professor' ? 'Professor' : 'Aluno'}</span><time dateTime={new Date(message.createdAt).toISOString()}>{formatTime(message.createdAt)}</time></div><p>{message.text}</p>
        {message.role === 'aluno' && <Button variant="ghost" onClick={() => {
          if (!('speechSynthesis' in window)) return;
          window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(message.text); utterance.lang = 'pt-BR'; window.speechSynthesis.speak(utterance);
        }}><Volume2 size={16} aria-hidden="true" /> Ouvir mensagem</Button>}
      </article>)}
      </div>
      {showAutoSpeak && <div className="classroom-inbox-footer"><label className="classroom-auto-speak"><input type="checkbox" role="switch" checked={autoSpeak} onChange={event => setAutoSpeak(event.target.checked)} /><Volume2 size={16} aria-hidden="true" /> Ler mensagens em voz alta</label></div>}
    </div>
    <p className="room-hint" role="status">{sendStatus || 'As mensagens ficam nesta tela até você sair ou trocar de sala.'}</p>
  </section>;
}
