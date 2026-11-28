import { useLocation } from "wouter";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { CLASSROOM_WS_URL, type LessonMaterial } from '@/lib/classroomApi';
import { loadMicrosoftSession } from '@/lib/microsoftAuth';

// `capacity` e `students` vêm da lista de salas (lotação atual); o join só precisa de id e nome.
export interface Room { id: string; name: string; capacity?: number; students?: number }
export interface RoomMessage { id: string; text: string; author: string; role: 'aluno' | 'professor'; createdAt: number }
export interface Peer { id: string; role: 'aluno' | 'professor' }
export type SignalHandler = (from: string, data: Record<string, unknown>) => void;
type Status = 'idle' | 'connecting' | 'connected' | 'disconnected';
interface ClassroomState {
  room: Room | null; status: Status; error: string; professor: boolean; students: number;
  messages: RoomMessage[]; sentMessages: RoomMessage[]; lessonCaptions: RoomMessage[]; lessonEndedAt: number | null; roomSessionToken: string | null; sendStatus: string; selfId: string; peers: Peer[];
  materials: LessonMaterial[]; materialStatus: string; shareLink: (title: string, url: string) => boolean; removeMaterial: (id: string) => boolean;
  autoSpeak: boolean; setAutoSpeak: (enabled: boolean) => void;
  sendSignal: (to: string, data: Record<string, unknown>) => boolean; onSignal: (handler: SignalHandler) => () => void;
  join: (room: Room) => Promise<void>; leave: () => void; send: (text: string) => boolean; endLesson: () => boolean;
}
const MAX_LESSON_CAPTIONS = 500;
const MAX_SENT_MESSAGES = 200;
const MAX_LESSON_CAPTION_CHARS = 40000;
function keepLessonCaption(previous: RoomMessage[], message: RoomMessage) {
  const next = [...previous, message];
  let total = next.reduce((sum, item) => sum + item.text.length, 0);
  while (next.length > MAX_LESSON_CAPTIONS || total > MAX_LESSON_CAPTION_CHARS) {
    total -= next.shift()?.text.length ?? 0;
  }
  return next;
}
const isMaterial = (value: unknown): value is LessonMaterial => {
  const material = value as LessonMaterial;
  return !!material && typeof material === 'object' && typeof material.id === 'string' && typeof material.title === 'string' &&
    typeof material.author === 'string' && typeof material.createdAt === 'number' &&
    (material.kind === 'file' ? typeof material.name === 'string' && typeof material.size === 'number'
      : material.kind === 'link' && typeof material.url === 'string' && /^https?:\/\//i.test(material.url));
};
const Context = createContext<ClassroomState | null>(null);

export function ClassroomProvider({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [room, setRoom] = useState<Room | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [professor, setProfessor] = useState(false);
  const [students, setStudents] = useState(0);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  // Falas que o próprio professor enviou: o servidor não as devolve ao remetente.
  const [sentMessages, setSentMessages] = useState<RoomMessage[]>([]);
  const [lessonCaptions, setLessonCaptions] = useState<RoomMessage[]>([]);
  const [lessonEndedAt, setLessonEndedAt] = useState<number | null>(null);
  const [roomSessionToken, setRoomSessionToken] = useState<string | null>(null);
  const [sendStatus, setSendStatus] = useState('');
  const [selfId, setSelfId] = useState('');
  const [peers, setPeers] = useState<Peer[]>([]);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [materials, setMaterials] = useState<LessonMaterial[]>([]);
  const [materialStatus, setMaterialStatus] = useState('');
  const spokenMessageIds = useRef(new Set<string>());
  const signalHandlers = useRef(new Set<SignalHandler>());
  const socket = useRef<WebSocket | null>(null);
  const role = useRef<'aluno' | 'professor'>('aluno');
  const pending = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const clearPending = () => { for (const timer of pending.current.values()) clearTimeout(timer); pending.current.clear(); };
  const leave = useCallback(() => {
    socket.current?.close(); socket.current = null; clearPending();
    setRoom(null); setStatus('idle'); setError(''); setMessages([]); setSentMessages([]); setLessonCaptions([]); setLessonEndedAt(null); setRoomSessionToken(null); setSendStatus(''); setProfessor(false); setStudents(0); setSelfId(''); setPeers([]); setAutoSpeak(false); setMaterials([]); setMaterialStatus('');
    window.speechSynthesis?.cancel();
  }, []);
  useEffect(() => {
    if (!["/aluno", "/professor", "/aluno/treinar", "/professor/treinar", "/ead"].includes(location)) leave();
  }, [location, leave]);
  useEffect(() => {
    if (!autoSpeak) {
      messages.filter(message => message.role === 'aluno').forEach(message => spokenMessageIds.current.add(message.id));
      window.speechSynthesis?.cancel();
      return;
    }
    if (!("speechSynthesis" in window)) return;
    for (const message of messages) {
      if (message.role !== 'aluno' || spokenMessageIds.current.has(message.id)) continue;
      spokenMessageIds.current.add(message.id);
      const utterance = new SpeechSynthesisUtterance(message.text);
      utterance.lang = 'pt-BR';
      window.speechSynthesis.speak(utterance);
    }
  }, [autoSpeak, messages]);
  useEffect(() => () => { socket.current?.close(); socket.current = null; clearPending(); }, []);
  const join = useCallback((selected: Room) => new Promise<void>((resolve, reject) => {
    const session = loadMicrosoftSession('aluno') || loadMicrosoftSession('professor');
    if (!session?.token) { reject(new Error('Escolha a sala novamente para continuar.')); return; }
    leave(); setStatus('connecting'); setRoomSessionToken(session.token ?? null); role.current = session.role;
    const url = new URL(CLASSROOM_WS_URL); url.searchParams.set('room', selected.id);
    const ws = new WebSocket(url, ['teachli-session', session.token]); socket.current = ws;
    let joined = false;
    let failure = '';
    const timeout = setTimeout(() => { failure = 'A conexão demorou demais. Tente entrar novamente.'; ws.close(); reject(new Error(failure)); }, 12000);
    ws.onmessage = event => {
      if (socket.current !== ws) return;
      let data; try { data = JSON.parse(event.data); } catch { return; }
      if (data.type === 'joined') {
        clearTimeout(timeout); joined = true;
        // Grava a sala antes de liberar quem aguarda o join: sem isso, a navegação seguinte renderiza a
        // rota da aula com `room` ainda vazio e mostra (e executa) a tela de salas por um instante.
        flushSync(() => { setRoom(data.room); setSelfId(typeof data.selfId === 'string' ? data.selfId : ''); setStatus('connected'); });
        resolve();
      } else if (data.type === 'presence') { setProfessor(data.professor); setStudents(data.students); setPeers(Array.isArray(data.peers) ? data.peers : []); }
      else if (data.type === 'signal') { for (const handler of signalHandlers.current) handler(data.from, data.data); }
      else if (data.type === 'caption.history' && Array.isArray(data.captions)) {
        const captions = data.captions.filter((caption: unknown): caption is RoomMessage =>
          !!caption && typeof caption === 'object' &&
          typeof (caption as RoomMessage).id === 'string' &&
          typeof (caption as RoomMessage).text === 'string' &&
          typeof (caption as RoomMessage).author === 'string' &&
          (caption as RoomMessage).role === 'professor' &&
          typeof (caption as RoomMessage).createdAt === 'number',
        );
        setMessages(captions.slice(-500));
        setLessonCaptions(captions);
      }
      else if (data.type === 'material.history' && Array.isArray(data.materials)) setMaterials(data.materials.filter(isMaterial));
      else if (data.type === 'material.added' && isMaterial(data.material)) {
        const material = data.material;
        setMaterials(previous => previous.some(item => item.id === material.id) ? previous : [...previous, material]);
        setMaterialStatus(`Material compartilhado: ${material.title}`);
      } else if (data.type === 'material.removed' && typeof data.id === 'string') {
        setMaterials(previous => previous.filter(item => item.id !== data.id));
      }
      else if (data.type === 'material.rejected') setMaterialStatus(typeof data.message === 'string' ? data.message : 'Não foi possível compartilhar o material.');
      else if (data.type === 'student.message' || data.type === 'caption.final') {
        setMessages(previous => [...previous, data].slice(-500));
        if (data.type === 'caption.final' && data.role === 'professor' && typeof data.text === 'string') {
          setLessonCaptions(previous => keepLessonCaption(previous, data));
        }
      } else if (data.type === 'lesson.ended' && Number.isFinite(data.endedAt)) {
        setLessonEndedAt(data.endedAt);
      } else if (data.type === 'lesson.closed') {
        setSendStatus(typeof data.message === 'string' ? data.message : 'A aula foi finalizada.');
      } else if (data.type === 'message.ack' || data.type === 'message.rejected') {
        clearTimeout(pending.current.get(data.id)); pending.current.delete(data.id);
        setSendStatus(data.type === 'message.ack'
          ? data.archived && data.recipients === 0 ? 'Legenda salva; alunos que entrarem depois poderão vê-la.' : `Encaminhada a ${data.recipients} conexão(ões) na sala.`
          : data.message);
      } else if (data.type === 'error') { failure = data.message; setError(failure); }
    };
    ws.onerror = () => { failure ||= 'Não foi possível conectar ao servidor. Confira a conexão e tente novamente.'; };
    ws.onclose = () => {
      clearTimeout(timeout);
      if (!joined) reject(new Error(failure || 'Não foi possível entrar na sala.'));
      if (socket.current !== ws) return;
      clearPending(); setStatus('disconnected'); setProfessor(false); setStudents(0); setPeers([]);
      setError(failure || 'Conexão encerrada. Entre novamente na sala para continuar.');
      setSendStatus(''); window.speechSynthesis?.cancel();
    };
  }), [leave]);
  const send = useCallback((text: string) => {
    if (!text.trim() || text.length > 2000) { setSendStatus('Escreva uma mensagem de até 2.000 caracteres.'); return false; }
    if (lessonEndedAt !== null) { setSendStatus('A aula foi finalizada pelo professor.'); return false; }
    if (status !== 'connected' || socket.current?.readyState !== WebSocket.OPEN) { setSendStatus('Entre novamente na sala para enviar.'); return false; }
    const id = crypto.randomUUID();
    socket.current.send(JSON.stringify({ type: role.current === 'aluno' ? 'student.message' : 'caption.final', id, text }));
    setSendStatus('Enviando…');
    if (role.current === 'professor') setSentMessages(previous => [...previous, { id, text: text.trim(), author: 'Professor', role: 'professor' as const, createdAt: Date.now() }].slice(-MAX_SENT_MESSAGES));
    pending.current.set(id, setTimeout(() => { pending.current.delete(id); setSendStatus('Sem confirmação de envio. Confira com o destinatário antes de reenviar.'); }, 8000));
    return true;
  }, [status, lessonEndedAt]);
  const endLesson = useCallback(() => {
    if (role.current !== 'professor' || status !== 'connected' || socket.current?.readyState !== WebSocket.OPEN || lessonEndedAt !== null) return false;
    socket.current.send(JSON.stringify({ type: 'lesson.end' }));
    return true;
  }, [status, lessonEndedAt]);
  const shareLink = useCallback((title: string, url: string) => {
    if (role.current !== 'professor' || status !== 'connected' || socket.current?.readyState !== WebSocket.OPEN) { setMaterialStatus('Entre novamente na sala para compartilhar.'); return false; }
    if (lessonEndedAt !== null) { setMaterialStatus('A aula foi finalizada. Não é possível compartilhar novos materiais.'); return false; }
    socket.current.send(JSON.stringify({ type: 'material.link', title, url }));
    setMaterialStatus('Compartilhando link…');
    return true;
  }, [status, lessonEndedAt]);
  const removeMaterial = useCallback((id: string) => {
    if (role.current !== 'professor' || socket.current?.readyState !== WebSocket.OPEN) return false;
    socket.current.send(JSON.stringify({ type: 'material.remove', id }));
    return true;
  }, []);
  const sendSignal = useCallback((to: string, data: Record<string, unknown>) => {
    if (socket.current?.readyState !== WebSocket.OPEN) return false;
    socket.current.send(JSON.stringify({ type: 'signal', to, data })); return true;
  }, []);
  const onSignal = useCallback((handler: SignalHandler) => { signalHandlers.current.add(handler); return () => { signalHandlers.current.delete(handler); }; }, []);
  return <Context.Provider value={{ room, status, error, professor, students, messages, sentMessages, lessonCaptions, lessonEndedAt, roomSessionToken, sendStatus, selfId, peers, materials, materialStatus, shareLink, removeMaterial, autoSpeak, setAutoSpeak, sendSignal, onSignal, join, leave, send, endLesson }}>{children}</Context.Provider>;
}
export function useClassroomConnection() {
  const context = useContext(Context);
  if (!context) throw new Error('ClassroomProvider ausente.');
  return context;
}
