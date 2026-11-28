import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { DoorOpen, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorkspaceHeading } from '@/components/AppShell';
import { ClassroomRequestError, classroomRequest } from '@/lib/classroomApi';
import { loadMicrosoftSession, logoutMicrosoftSession, prepareClassroomSession } from '@/lib/microsoftAuth';
import { useClassroomConnection, type Room } from '@/contexts/ClassroomContext';

const ROOM_REFRESH_MS = 15000;

const isFull = (room: Room) => room.capacity !== undefined && room.students !== undefined && room.students >= room.capacity;
const roomLabel = (room: Room) => {
  if (room.capacity === undefined || room.students === undefined) return room.name;
  return `${room.name} (${room.students}/${room.capacity} alunos${isFull(room) ? ' · cheia' : ''})`;
};

export default function RoomSelection() {
  const [, navigate] = useLocation();
  const session = loadMicrosoftSession('aluno') || loadMicrosoftSession('professor');
  const { join, leave, status } = useClassroomConnection();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [attempt, retry] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    if (!session) { navigate('/'); return; }
    const loadRooms = async () => {
      const ready = await prepareClassroomSession();
      try { return await classroomRequest('/classrooms', ready.token); }
      catch (reason) {
        // Sessão guardada expirada, revogada ou perdida num reinício do servidor: faz um login novo.
        if (!(reason instanceof ClassroomRequestError) || reason.status !== 401) throw reason;
        return classroomRequest('/classrooms', (await prepareClassroomSession({ renew: true })).token);
      }
    };
    loadRooms().then(result => { if (active) setRooms(result.rooms); })
      .catch(reason => { if (active) setError(reason.message); }).finally(() => { if (active) setLoading(false); });
    // Atualiza a lotação enquanto a pessoa escolhe. Falhas aqui são silenciosas: a lista anterior continua.
    const refresh = setInterval(() => {
      prepareClassroomSession().then(ready => classroomRequest('/classrooms', ready.token))
        .then(result => { if (active) setRooms(result.rooms); }).catch(() => {});
    }, ROOM_REFRESH_MS);
    return () => { active = false; clearInterval(refresh); };
  }, [session?.idToken, attempt]);
  const enter = async (event: React.FormEvent) => {
    event.preventDefault(); const room = rooms.find(r => r.id === selected); if (!room) return;
    setError('');
    try { await join(room); navigate(session?.role === 'professor' ? '/professor' : '/aluno'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível entrar.'); }
  };
  const logout = async () => {
    leave();
    try { await logoutMicrosoftSession(); navigate('/'); }
    catch { setError('Não foi possível encerrar a sessão no servidor. Confira a conexão e tente sair novamente.'); }
  };
  return <div className="workspace-page">
    <WorkspaceHeading title="Em qual sala você está?" description="Escolha a mesma sala que sua turma para começar a conversar." />
    <main id="conteudo" tabIndex={-1} className="container room-selection">
      <form className="room-form" onSubmit={enter}>
        <div className="room-identity"><DoorOpen size={25} aria-hidden="true" /><div><strong>{session?.profile.name}</strong><p>{session?.role === 'professor' ? 'Professor' : 'Aluno'} · {session?.profile.email}</p></div></div>
        <label htmlFor="classroom-select">Sua sala de aula</label>
        <select id="classroom-select" value={selected} onChange={e => setSelected(e.target.value)} disabled={loading || status === 'connecting'} required>
          <option value="">{loading ? 'Carregando salas…' : 'Selecione uma sala'}</option>
          {/* O professor não conta na lotação, então só o aluno fica impedido de escolher uma sala cheia. */}
          {rooms.map(room => <option key={room.id} value={room.id} disabled={session?.role === 'aluno' && isFull(room) && room.id !== selected}>{roomLabel(room)}</option>)}
        </select>
        <p className="room-hint"><MapPin size={18} aria-hidden="true" /> As mensagens chegam somente a quem está na mesma sala.</p>
        {error && <p role="alert" className="room-error">{error}</p>}
        <div className="room-actions"><Button type="submit" disabled={!selected || loading || status === 'connecting'}>{status === 'connecting' ? 'Entrando…' : 'Entrar na sala'}</Button>
          {error && <Button type="button" variant="outline" onClick={() => retry(n => n + 1)}>Tentar novamente</Button>}
          <Button type="button" variant="ghost" onClick={logout}>Sair da conta</Button></div>
      </form>
      <aside className="room-explanation"><h2>Um espaço para a sua turma.</h2><p>Você pode entrar antes do professor. Quando ele chegar, a comunicação ficará disponível.</p><p>Não é necessário ligar câmera ou microfone para participar por texto.</p></aside>
    </main>
  </div>;
}
