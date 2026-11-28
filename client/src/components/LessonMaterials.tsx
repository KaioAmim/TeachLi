import { useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, Download, FileText, Link2, Paperclip, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClassroomConnection } from "@/contexts/ClassroomContext";
import { downloadMaterial, uploadMaterial, type LessonMaterial } from "@/lib/classroomApi";

/** Mesmas extensões aceitas pelo servidor (server/classrooms.mjs, MATERIAL_FILE_TYPES). */
const ACCEPTED_FILES = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.odt,.odp,.ods,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp";
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
const formatTime = (timestamp: number) =>
  new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));

export function LessonMaterials({ role }: { role: "aluno" | "professor" }) {
  const { status, lessonEndedAt, materials, materialStatus, roomSessionToken, shareLink, removeMaterial } = useClassroomConnection();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [fileStatus, setFileStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const isProfessor = role === "professor";
  const canShare = isProfessor && status === "connected" && !lessonEndedAt;

  const submitLink = (event: FormEvent) => {
    event.preventDefault();
    const value = url.trim();
    if (!/^https?:\/\/\S+$/i.test(value)) { setFileStatus("Informe o endereço completo, começando com http:// ou https://."); return; }
    setFileStatus("");
    if (shareLink(title.trim(), value)) { setTitle(""); setUrl(""); }
  };

  const sendFile = async (file: File | undefined) => {
    if (!file) return;
    if (fileInput.current) fileInput.current.value = "";
    if (file.size > MAX_FILE_BYTES) { setFileStatus("O arquivo passa de 10 MB."); return; }
    if (!roomSessionToken) { setFileStatus("Entre novamente na sala para compartilhar."); return; }
    setUploading(true);
    setFileStatus(`Enviando ${file.name}…`);
    try {
      await uploadMaterial(file, roomSessionToken);
      setFileStatus("");
    } catch (error) {
      setFileStatus(error instanceof Error ? error.message : "Não foi possível enviar o arquivo.");
    } finally {
      setUploading(false);
    }
  };

  const download = async (material: LessonMaterial) => {
    if (!roomSessionToken) { setFileStatus("Entre novamente na sala para baixar."); return; }
    setDownloading(material.id);
    setFileStatus("");
    try {
      const blob = await downloadMaterial(material.id, roomSessionToken);
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = material.name ?? material.title;
      link.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (error) {
      setFileStatus(error instanceof Error ? error.message : "Não foi possível baixar o arquivo.");
    } finally {
      setDownloading(null);
    }
  };

  const note = fileStatus || materialStatus;

  return (
    <section className="lesson-materials" aria-labelledby="lesson-materials-title">
      <div className="lesson-materials-heading">
        <span className="lesson-materials-icon" aria-hidden="true"><Paperclip size={18} /></span>
        <div>
          <p className="professor-section-label">{isProfessor ? "Compartilhar com a sala" : "Do professor"}</p>
          <h2 id="lesson-materials-title">Materiais da aula</h2>
        </div>
      </div>

      {isProfessor && (
        <div className="lesson-materials-forms">
          <form className="lesson-materials-link" onSubmit={submitLink}>
            <label>
              <span>Título (opcional)</span>
              <input type="text" value={title} maxLength={120} onChange={event => setTitle(event.target.value)} placeholder="Ex.: Slides da aula" disabled={!canShare} />
            </label>
            <label>
              <span>Link</span>
              <input type="url" value={url} maxLength={2000} onChange={event => setUrl(event.target.value)} placeholder="https://" required disabled={!canShare} />
            </label>
            <Button type="submit" variant="outline" disabled={!canShare || !url.trim()}><Link2 size={16} aria-hidden="true" /> Compartilhar link</Button>
          </form>
          <div className="lesson-materials-file">
            <input ref={fileInput} id="lesson-material-file" type="file" accept={ACCEPTED_FILES} className="sr-only" disabled={!canShare || uploading} onChange={event => sendFile(event.target.files?.[0])} />
            <Button type="button" variant="outline" disabled={!canShare || uploading} onClick={() => fileInput.current?.click()}>
              <Upload size={16} aria-hidden="true" /> {uploading ? "Enviando…" : "Anexar arquivo"}
            </Button>
            <p>PDF, Word, PowerPoint, Excel, OpenDocument, texto, CSV ou imagem, até 10 MB.</p>
          </div>
        </div>
      )}

      {materials.length ? (
        <ul className="lesson-materials-list" aria-label="Materiais compartilhados">
          {materials.map(material => (
            <li key={material.id}>
              <span className="lesson-materials-kind" aria-hidden="true">{material.kind === "link" ? <Link2 size={16} /> : <FileText size={16} />}</span>
              <div>
                <strong>{material.title}</strong>
                <span>
                  {material.kind === "link" ? new URL(material.url!).hostname : formatSize(material.size ?? 0)}
                  {" · "}{material.author}{" · "}<time dateTime={new Date(material.createdAt).toISOString()}>{formatTime(material.createdAt)}</time>
                </span>
              </div>
              <div className="lesson-materials-actions">
                {material.kind === "link" ? (
                  <a className="lesson-materials-open" href={material.url} target="_blank" rel="noopener noreferrer">
                    Abrir link<ArrowUpRight size={14} aria-hidden="true" /><span className="sr-only"> (abre em nova aba)</span>
                  </a>
                ) : (
                  <Button type="button" variant="outline" size="sm" disabled={downloading === material.id} onClick={() => download(material)}>
                    <Download size={15} aria-hidden="true" /> {downloading === material.id ? "Baixando…" : "Baixar"}
                  </Button>
                )}
                {isProfessor && (
                  <Button type="button" variant="ghost" size="sm" disabled={status !== "connected"} onClick={() => removeMaterial(material.id)} aria-label={`Remover ${material.title}`}>
                    <Trash2 size={15} aria-hidden="true" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="lesson-materials-empty">{isProfessor ? "Links e arquivos que você compartilhar aparecem aqui e para os alunos da sala." : "Quando o professor compartilhar links ou arquivos, eles aparecem aqui."}</p>
      )}

      <p className="lesson-materials-note" role="status">
        {note || "Os materiais ficam disponíveis enquanto houver alguém na sala e são apagados quando todos saem."}
      </p>
    </section>
  );
}
