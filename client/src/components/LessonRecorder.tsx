import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, CircleStop, Cloud, Download, FolderOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useClassroomConnection } from "@/contexts/ClassroomContext";
import {
  MAX_ENTRIES, chooseFolder, deleteRecording, downloadRecording, getSavedFolder, listRecordings, recordingDuration,
  saveRecording, saveRecordingToFolder, supportsFolderSave, type FolderSaveResult, type LessonRecording,
} from "@/lib/lessonRecordings";

/** Gravação do conteúdo da aula (falas e mensagens), com lista das aulas já gravadas. */
export function LessonRecorder() {
  const { messages: received, sentMessages, room, status, lessonEndedAt } = useClassroomConnection();
  // Falas enviadas pelo professor + mensagens recebidas dos alunos, na ordem do horário.
  const messages = useMemo(() => [...received, ...sentMessages].sort((a, b) => a.createdAt - b.createdAt), [received, sentMessages]);
  const [recording, setRecording] = useState<LessonRecording | null>(null);
  const [saved, setSaved] = useState<LessonRecording[]>(() => listRecordings());
  const recordingRef = useRef<LessonRecording | null>(null);
  const seenRef = useRef(new Set<string>());
  const warnedStorageRef = useRef(false);
  const [folder, setFolder] = useState<string | null>(null);
  const folderRef = useRef<string | null>(null);
  folderRef.current = folder;
  const canSaveToFolder = supportsFolderSave();

  useEffect(() => {
    getSavedFolder().then(saved => setFolder(saved?.name ?? null));
  }, []);

  const report = (result: FolderSaveResult, silent: boolean) => {
    if (result === "saved") toast.success(`Aula salva na pasta "${folderRef.current ?? "escolhida"}"`);
    else if (silent) {
      if (result === "needs-permission") toast.info('Clique em "Salvar no OneDrive" para gravar a aula na pasta (o navegador pede permissão de novo).');
    } else if (result === "needs-permission") toast.error("Permissão da pasta negada. Tente de novo e permita o acesso.");
    else if (result === "no-folder") toast.error("Escolha primeiro a pasta do OneDrive.");
    else toast.error("Não foi possível salvar na pasta. Baixe o arquivo como alternativa.");
  };

  /** Escolhe a pasta (ex.: a do OneDrive); as próximas aulas são salvas nela automaticamente. */
  const pickFolder = async () => {
    const chosen = await chooseFolder();
    if (chosen) {
      setFolder(chosen.name);
      folderRef.current = chosen.name;
      toast.success(`Pasta "${chosen.name}" escolhida. As aulas serão salvas nela ao terminar.`);
    }
    return chosen;
  };

  const saveToFolder = async (item: LessonRecording) => {
    if (!folder && !(await pickFolder())) return;
    report(await saveRecordingToFolder(item, true), false);
  };

  const persist = (next: LessonRecording) => {
    recordingRef.current = next;
    setRecording(next);
    if (!saveRecording(next) && !warnedStorageRef.current) {
      warnedStorageRef.current = true;
      toast.error("Não foi possível guardar a gravação neste navegador. Baixe o arquivo para não perder o conteúdo.");
    }
    setSaved(listRecordings());
  };

  const finish = (endedAt: number) => {
    const current = recordingRef.current;
    if (!current) return;
    const finished = { ...current, endedAt };
    persist(finished);
    recordingRef.current = null;
    // Salvamento automático na pasta escolhida; sem permissão ativa, avisa para salvar pelo botão.
    if (folderRef.current) saveRecordingToFolder(finished, false).then(result => report(result, true));
    setRecording(null);
  };

  const start = () => {
    if (!room || status !== "connected" || lessonEndedAt) return;
    // Mensagens que já estavam na sala não fazem parte desta gravação.
    seenRef.current = new Set(messages.map(message => message.id));
    warnedStorageRef.current = false;
    persist({ id: crypto.randomUUID(), roomName: room.name, startedAt: Date.now(), endedAt: null, entries: [] });
    toast.success("Gravação da aula iniciada");
  };

  // Acrescenta à gravação cada mensagem nova (fala do professor ou mensagem de aluno).
  useEffect(() => {
    const current = recordingRef.current;
    if (!current) return;
    const fresh = messages.filter(message => !seenRef.current.has(message.id));
    if (fresh.length === 0) return;
    fresh.forEach(message => seenRef.current.add(message.id));
    const entries = [
      ...current.entries,
      ...fresh.map(message => ({ id: message.id, at: message.createdAt || Date.now(), role: message.role, author: message.author, text: message.text })),
    ].slice(-MAX_ENTRIES);
    persist({ ...current, entries });
  }, [messages]);

  // A aula terminou, a conexão caiu ou o professor trocou de sala: a gravação é encerrada e guardada.
  useEffect(() => {
    if (!recordingRef.current) return;
    if (lessonEndedAt) finish(lessonEndedAt);
    else if (status !== "connected") finish(Date.now());
  }, [lessonEndedAt, status]);

  useEffect(() => {
    if (recordingRef.current && room?.name !== recordingRef.current.roomName) finish(Date.now());
  }, [room?.id]);

  // Ao sair da tela, o que já foi gravado fica guardado como gravação interrompida.
  useEffect(() => () => {
    const current = recordingRef.current;
    if (current) saveRecording({ ...current, endedAt: Date.now() });
  }, []);

  const remove = (id: string) => {
    deleteRecording(id);
    setSaved(listRecordings());
  };

  const disabled = status !== "connected" || !!lessonEndedAt;

  return (
    <section className="lesson-recorder" aria-labelledby="lesson-recorder-title">
      <div className="lesson-recorder-heading">
        <div>
          <p className="professor-section-label">Registro da aula</p>
          <h2 id="lesson-recorder-title">Gravar aula</h2>
        </div>
        {recording ? (
          <Button type="button" variant="destructive" onClick={() => finish(Date.now())}>
            <CircleStop size={17} aria-hidden="true" /> Parar gravação
          </Button>
        ) : (
          <Button type="button" variant="outline" disabled={disabled} onClick={start}>
            <Circle size={17} aria-hidden="true" /> Gravar aula
          </Button>
        )}
      </div>
      <p className="lesson-recorder-note" role="status">
        {recording
          ? <><span className="lesson-recorder-dot" aria-hidden="true" /> Gravando: {recording.entries.length} registro{recording.entries.length === 1 ? "" : "s"} (falas e mensagens dos alunos).</>
          : "Registra o texto da aula (suas falas e as mensagens dos alunos) com horário. Fica guardado só neste navegador. Avise a turma de que a aula está sendo gravada."}
      </p>

      {canSaveToFolder ? (
        <div className="lesson-recorder-folder">
          <Cloud size={16} aria-hidden="true" />
          <span>{folder ? <>Pasta de destino: <strong>{folder}</strong>. Use a pasta do OneDrive para sincronizar com a nuvem.</> : "Escolha a pasta do OneDrive para salvar as aulas e sincronizá-las com a nuvem."}</span>
          <Button type="button" variant="outline" size="sm" onClick={pickFolder}>
            <FolderOpen size={15} aria-hidden="true" /> {folder ? "Trocar pasta" : "Escolher pasta"}
          </Button>
        </div>
      ) : (
        <p className="lesson-recorder-note">Para salvar direto na pasta do OneDrive, use o Chrome ou o Edge. Neste navegador, baixe o arquivo e mova-o para a pasta.</p>
      )}

      {saved.length > 0 && (
        <ul className="lesson-recorder-list" aria-label="Aulas gravadas">
          {saved.map(item => (
            <li key={item.id}>
              <div>
                <strong>{item.roomName}</strong>
                <span>{new Date(item.startedAt).toLocaleString("pt-BR")} · {recordingDuration(item)} · {item.entries.length} registro{item.entries.length === 1 ? "" : "s"}{item.endedAt ? "" : " · em andamento"}</span>
              </div>
              <div className="lesson-recorder-actions">
                {canSaveToFolder && (
                  <Button type="button" variant="outline" size="sm" onClick={() => saveToFolder(item)} disabled={item.id === recording?.id}>
                    <Cloud size={15} aria-hidden="true" /> Salvar no OneDrive
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => downloadRecording(item, "txt")}>
                  <Download size={15} aria-hidden="true" /> Baixar texto
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => downloadRecording(item, "json")}>JSON</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(item.id)} disabled={item.id === recording?.id} aria-label={`Excluir gravação de ${item.roomName}`}>
                  <Trash2 size={15} aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
