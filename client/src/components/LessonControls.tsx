import { useEffect, useState } from "react";
import { BookOpenText, Check, CircleStop, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useClassroomConnection } from "@/contexts/ClassroomContext";
import { classroomRequest } from "@/lib/classroomApi";
import { loadMicrosoftSession } from "@/lib/microsoftAuth";

interface LessonSummary {
  topic: string;
  summary: string;
  keyPoints: string[];
  examples: string[];
}

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
  const [summary, setSummary] = useState<LessonSummary | null>(null);
  const [summaryError, setSummaryError] = useState("");
  const [summarizing, setSummarizing] = useState(false);

  useEffect(() => {
    setShowSummary(false);
    setSummary(null);
    setSummaryError("");
    setSummarizing(false);
  }, [room?.id, lessonEndedAt]);

  const generateSummary = async () => {
    const session = loadMicrosoftSession("aluno");
    if (!session?.token) {
      setSummaryError("Sua sessão expirou. Entre novamente para gerar o resumo.");
      setShowSummary(true);
      return;
    }
    setShowSummary(true);
    setSummaryError("");
    setSummarizing(true);
    try {
      const result = await classroomRequest(
        "/lessons/summary",
        session.token,
        { captions: lessonCaptions.map(caption => caption.text) },
        35000,
      );
      setSummary(result as LessonSummary);
    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : "Não foi possível gerar o resumo. Tente novamente.");
    } finally {
      setSummarizing(false);
    }
  };

  return <section className="lesson-summary" aria-labelledby="lesson-summary-title">
    <div className="lesson-summary-heading">
      <span className="lesson-summary-icon" aria-hidden="true"><BookOpenText size={20} /></span>
      <div>
        <h2 id="lesson-summary-title">Resumo da aula</h2>
        <p>{lessonEndedAt ? "A aula foi finalizada. Gere uma síntese do conteúdo a partir das legendas desta sessão." : "O resumo fica disponível quando o professor finalizar a aula."}</p>
      </div>
      <Button type="button" onClick={generateSummary} disabled={!lessonEndedAt || summarizing}>
        <FileText size={17} aria-hidden="true" /> {summarizing ? "Resumindo…" : summary ? "Gerar novamente" : "Resumir aula"}
      </Button>
    </div>
    {showSummary && <div className="lesson-summary-result" aria-live="polite">
      {summarizing ? <p className="lesson-summary-empty" role="status">Organizando os conceitos e as ideias principais da aula…</p>
        : summaryError ? <p className="lesson-summary-empty" role="status">{summaryError}</p>
          : summary ? <>
            <p className="lesson-summary-note">Síntese gerada por IA com as legendas desta aula. Confira os pontos com o conteúdo apresentado pelo professor.</p>
            {summary.topic && <h3>{summary.topic}</h3>}
            {summary.summary && <p className="lesson-summary-overview">{summary.summary}</p>}
            {summary.keyPoints.length > 0 && <>
              <h4>Ideias principais</h4>
              <ul>{summary.keyPoints.map((point, index) => <li key={`${index}-${point}`}>{point}</li>)}</ul>
            </>}
            {summary.examples.length > 0 && <>
              <h4>Exemplos mencionados</h4>
              <ul>{summary.examples.map((example, index) => <li key={`${index}-${example}`}>{example}</li>)}</ul>
            </>}
          </> : null}
    </div>}
  </section>;
}
