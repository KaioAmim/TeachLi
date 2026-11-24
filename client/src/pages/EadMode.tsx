import { PhoneCall, ShieldCheck } from "lucide-react";
import { RoomStatus, WorkspaceHeading } from "@/components/AppShell";
import { CallPanel } from "@/components/CallPanel";
import type { AppRole } from "@/lib/microsoftAuth";
import { FinishLessonControl, StudentLessonSummary } from "@/components/LessonControls";
import { EadProfessorCaptions } from "@/components/EadProfessorCaptions";

export default function EadMode({ role }: { role: AppRole }) {
  return (
    <div className="workspace-page ead-workspace">
      <WorkspaceHeading
        title="Ensino remoto"
        description="Participe da chamada ao vivo da sua sala. A comunicação por texto continua disponível na página de aula."
      >
        <div className="lesson-heading-actions"><RoomStatus />{role === "professor" && <FinishLessonControl />}</div>
      </WorkspaceHeading>
      <main id="conteudo" tabIndex={-1} className="container ead-content">
        <div className="ead-intro">
          <span><PhoneCall size={20} aria-hidden="true" /></span>
          <div>
            <h2>Chamada da sala</h2>
            <p>{role === "professor" ? "Entre quando estiver pronto. A câmera e o microfone só são usados durante a chamada." : "Entre quando estiver pronto. A chamada usa sua câmera, sem transmitir áudio."}</p>
          </div>
          <ShieldCheck size={22} aria-hidden="true" className="ead-privacy-icon" />
        </div>
        {role === "professor" ? <EadProfessorCaptions /> : <StudentLessonSummary />}
        <CallPanel role={role} />
      </main>
    </div>
  );
}
