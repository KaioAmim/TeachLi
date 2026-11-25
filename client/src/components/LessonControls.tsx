import { useEffect, useState } from "react";
import { BookOpenText, Check, CircleStop, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useClassroomConnection } from "@/contexts/ClassroomContext";
import { classroomRequest } from "@/lib/classroomApi";

interface LessonSummary {
  topic: string;
  topics: string[];
  summary: string;
  keyPoints: string[];
  examples: string[];
  reviewQuestions: string[];
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
  const { lessonEndedAt, room, roomSessionToken } = useClassroomConnection();
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
    if (!roomSessionToken || !room?.id || !lessonEndedAt) {
      setSummaryError("Reconecte-se à sala finalizada para gerar o resumo.");
      setShowSummary(true);
      return;
    }
    setShowSummary(true);
    setSummaryError("");
    setSummarizing(true);
    try {
      const result = await classroomRequest(
        "/lessons/summary",
        roomSessionToken,
        { roomId: room.id, endedAt: lessonEndedAt },
        185000,
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
        <p>{lessonEndedAt ? roomSessionToken ? "A aula foi finalizada. Gere uma síntese do conteúdo a partir das legendas desta sessão." : "Sua sessão expirou. Entre novamente para gerar o resumo." : "O resumo fica disponível quando o professor finalizar a aula."}</p>
      </div>
      <Button type="button" onClick={generateSummary} disabled={!lessonEndedAt || !roomSessionToken || summarizing || Boolean(summary)}>
        {summarizing ? <Sparkles className="lesson-summary-ai-icon" size={17} aria-hidden="true" /> : <FileText size={17} aria-hidden="true" />}
        {summarizing ? <><span className="lesson-summary-loading-text">Gerando resumo</span><LoadingDots /></> : summary ? "Resumo gerado" : "Resumir aula"}
      </Button>
    </div>
    {showSummary && <div className="lesson-summary-result" aria-live="polite">
      {summarizing ? <p className="lesson-summary-loading" role="status"><Sparkles className="lesson-summary-ai-icon" size={19} aria-hidden="true" /><span className="lesson-summary-loading-text">Gerando resumo</span><LoadingDots /></p>
        : summaryError ? <p className="lesson-summary-empty" role="status">{summaryError}</p>
          : summary ? <>
            <p className="lesson-summary-note">Material didático gerado a partir da transcrição da aula. Confira os tópicos e pontos com o conteúdo apresentado pelo professor.</p>
            {summary.topic && <h3>{summary.topic}</h3>}
            {summary.summary && <p className="lesson-summary-overview">{summary.summary}</p>}
            {summary.topics.length > 0 && <>
              <h4>Tópicos identificados</h4>
              <ul>{summary.topics.map((topic, index) => <li key={`${index}-${topic}`}>{topic}</li>)}</ul>
            </>}
            {summary.keyPoints.length > 0 && <>
              <h4>Ideias principais</h4>
              <ul>{summary.keyPoints.map((point, index) => <li key={`${index}-${point}`}>{point}</li>)}</ul>
            </>}
            {summary.examples.length > 0 && <>
              <h4>Exemplos mencionados</h4>
              <ul>{summary.examples.map((example, index) => <li key={`${index}-${example}`}>{example}</li>)}</ul>
            </>}
            {summary.reviewQuestions.length > 0 && <>
              <h4>Para revisar</h4>
              <ul>{summary.reviewQuestions.map((question, index) => <li key={`${index}-${question}`}>{question}</li>)}</ul>
            </>}
          </> : null}
    </div>}
  </section>;
}

function LoadingDots() {
  return <span className="lesson-summary-loading-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>;
}
