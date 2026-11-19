import { PhoneCall, ShieldCheck } from "lucide-react";
import { WorkspaceHeading } from "@/components/AppShell";
import { CallPanel } from "@/components/CallPanel";
import type { AppRole } from "@/lib/microsoftAuth";

export default function EadMode({ role }: { role: AppRole }) {
  return (
    <div className="workspace-page ead-workspace">
      <WorkspaceHeading
        title="Ensino remoto"
        description="Participe da chamada ao vivo da sua sala. A comunicação por texto continua disponível na página de aula."
      />
      <main id="conteudo" tabIndex={-1} className="container ead-content">
        <div className="ead-intro">
          <span><PhoneCall size={20} aria-hidden="true" /></span>
          <div>
            <h2>Chamada da sala</h2>
            <p>{role === "professor" ? "Entre quando estiver pronto. A câmera e o microfone só são usados durante a chamada." : "Entre quando estiver pronto. A chamada usa sua câmera, sem transmitir áudio."}</p>
          </div>
          <ShieldCheck size={22} aria-hidden="true" className="ead-privacy-icon" />
        </div>
        <CallPanel role={role} />
      </main>
    </div>
  );
}
