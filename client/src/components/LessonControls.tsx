import { useEffect, useState } from "react";
import { BookOpenText, Check, CircleStop, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useClassroomConnection } from "@/contexts/ClassroomContext";
import { summarizeLesson } from "@/lib/lessonSummary";

export function FinishLessonControl() {
  const { status, lessonEndedAt, endLesson } = useClassroomConnection();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    if (lessonEndedAt || status !== "connected") setEnding(false);
  }, [lessonEndedAt, status]);

  if (lessonEndedAt) {
    return <span className="lesson-ended-status" role="status"><Check size={16} aria-hidden="true" /> Aula finalizada</span>;
  }

  const finish = () => {
    if (!endLesson()) return;
    setEnding(true);
    setConfirmOpen(false);
  };

  return <>
    <Button type="button" variant="outline" className="lesson-finish-trigger" disabled={status !== "connected" || ending} onClick={() => setConfirmOpen(true)}>
      <CircleStop size={17} aria-hidden="true" /> {ending ? "Finalizando…" : "Finalizar aula"}
    </Button>
    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finalizar esta aula?</DialogTitle>
          <DialogDescription>
            Isso encerra o envio de conteúdo nesta sala. Os alunos poderão gerar um resumo com as legendas compartilhadas nesta sessão.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>Continuar aula</Button>
          <Button type="button" variant="destructive" onClick={finish}><CircleStop size={17} aria-hidden="true" /> Finalizar aula</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}

export function StudentLessonSummary() {
  const { lessonCaptions, lessonEndedAt, room } = useClassroomConnection();
  const [showSummary, setShowSummary] = useState(false);
  const summary = summarizeLesson(lessonCaptions);

  useEffect(() => setShowSummary(false), [room?.id, lessonEndedAt]);

  return <section className="lesson-summary" aria-labelledby="lesson-summary-title">
    <div className="lesson-summary-heading">
      <span className="lesson-summary-icon" aria-hidden="true"><BookOpenText size={20} /></span>
      <div>
        <h2 id="lesson-summary-title">Resumo da aula</h2>
        <p>{lessonEndedAt ? "A aula foi finalizada. Gere um resumo das falas do professor compartilhadas nesta sessão." : "O resumo fica disponível quando o professor finalizar a aula."}</p>
      </div>
      <Button type="button" onClick={() => setShowSummary(true)} disabled={!lessonEndedAt}>
        <FileText size={17} aria-hidden="true" /> Resumir aula
      </Button>
    </div>
    {showSummary && <div className="lesson-summary-result" aria-live="polite">
      {summary.length > 0 ? <>
        <p className="lesson-summary-note">Resumo automático com trechos das legendas disponíveis. Ele não acrescenta informações além do que foi dito.</p>
        <ul>{summary.map((sentence, index) => <li key={`${index}-${sentence}`}>{sentence}</li>)}</ul>
      </> : <p className="lesson-summary-empty" role="status">Não há legendas disponíveis nesta sessão para resumir. No EAD, o professor precisa ativar a transcrição antes de finalizar a aula.</p>}
    </div>}
  </section>;
}
