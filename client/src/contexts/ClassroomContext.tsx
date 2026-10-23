import { useLocation } from "wouter";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { CLASSROOM_WS_URL } from '@/lib/classroomApi';
import { loadMicrosoftSession } from '@/lib/microsoftAuth';

export interface Room { id: string; name: string }
export interface RoomMessage { id: string; text: string; author: string; role: 'aluno' | 'professor'; createdAt: number }
type Status = 'idle' | 'connecting' | 'connected' | 'disconnected';
interface ClassroomState {
  room: Room | null; status: Status; error: string; professor: boolean; students: number;
  messages: RoomMessage[]; sendStatus: string;
  join: (room: Room) => Promise<void>; leave: () => void; send: (text: string) => boolean;
}
const Context = createContext<ClassroomState | null>(null);

export function ClassroomProvider({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [room, setRoom] = useState<Room | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [professor, setProfessor] = useState(false);
  const [students, setStudents] = useState(0);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [sendStatus, setSendStatus] = useState('');
  const socket = useRef<WebSocket | null>(null);
  const role = useRef<'aluno' | 'professor'>('aluno');
  const pending = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const clearPending = () => { for (const timer of pending.current.values()) clearTimeout(timer); pending.current.clear(); };
  const leave = useCallback(() => {
    socket.current?.close(); socket.current = null; clearPending();
    setRoom(null); setStatus('idle'); setError(''); setMessages([]); setSendStatus(''); setProfessor(false); setStudents(0);
    window.speechSynthesis?.cancel();
  }, []);
  useEffect(() => {
    if (!["/aluno", "/professor", "/aluno/treinar"].includes(location)) leave();
  }, [location, leave]);
  useEffect(() => () => { socket.current?.close(); socket.current = null; clearPending(); }, []);
  const join = useCallback((selected: Room) => new Promise<void>((resolve, reject) => {
    const session = loadMicrosoftSession('aluno') || loadMicrosoftSession('professor');
    if (!session?.token) { reject(new Error('Escolha a sala novamente para continuar.')); return; }
    leave(); setStatus('connecting'); role.current = session.role;
    const url = new URL(CLASSROOM_WS_URL); url.searchParams.set('room', selected.id);
    const ws = new WebSocket(url, ['teachli-session', session.token]); socket.current = ws;
    let joined = false;
    let failure = '';
    const timeout = setTimeout(() => { failure = 'A conexão demorou demais. Tente entrar novamente.'; ws.close(); reject(new Error(failure)); }, 12000);
    ws.onmessage = event => {
      if (socket.current !== ws) return;
      let data; try { data = JSON.parse(event.data); } catch { return; }
      if (data.type === 'joined') {
        clearTimeout(timeout); joined = true; setRoom(data.room); setStatus('connected'); resolve();
      } else if (data.type === 'presence') { setProfessor(data.professor); setStudents(data.students); }
      else if (data.type === 'student.message' || data.type === 'caption.final') {
        setMessages(previous => [...previous, data].slice(-100));
      } else if (data.type === 'message.ack' || data.type === 'message.rejected') {
        clearTimeout(pending.current.get(data.id)); pending.current.delete(data.id);
        setSendStatus(data.type === 'message.ack' ? `Encaminhada a ${data.recipients} conexão(ões) na sala.` : data.message);
      } else if (data.type === 'error') { failure = data.message; setError(failure); }
    };
    ws.onerror = () => { failure ||= 'Não foi possível conectar ao servidor. Confira a conexão e tente novamente.'; };
    ws.onclose = () => {
      clearTimeout(timeout);
      if (!joined) reject(new Error(failure || 'Não foi possível entrar na sala.'));
      if (socket.current !== ws) return;
      clearPending(); setStatus('disconnected'); setProfessor(false); setStudents(0);
      setError(failure || 'Conexão encerrada. Entre novamente na sala para continuar.');
      setSendStatus(''); window.speechSynthesis?.cancel();
    };
  }), [leave]);
  const send = useCallback((text: string) => {
    if (!text.trim() || text.length > 2000) { setSendStatus('Escreva uma mensagem de até 2.000 caracteres.'); return false; }
    if (status !== 'connected' || socket.current?.readyState !== WebSocket.OPEN) { setSendStatus('Entre novamente na sala para enviar.'); return false; }
    const id = crypto.randomUUID();
    socket.current.send(JSON.stringify({ type: role.current === 'aluno' ? 'student.message' : 'caption.final', id, text }));
    setSendStatus('Enviando…');
    pending.current.set(id, setTimeout(() => { pending.current.delete(id); setSendStatus('Sem confirmação de envio. Confira com o destinatário antes de reenviar.'); }, 8000));
    return true;
  }, [status]);
  return <Context.Provider value={{ room, status, error, professor, students, messages, sendStatus, join, leave, send }}>{children}</Context.Provider>;
}
export function useClassroomConnection() {
  const context = useContext(Context);
  if (!context) throw new Error('ClassroomProvider ausente.');
  return context;
}
