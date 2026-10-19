import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppRole, startMicrosoftLogin } from "@/lib/microsoftAuth";

export function useMicrosoftSignIn() {
  const [pendingRole, setPendingRole] = useState<AppRole | null>(null);
  const pending = useRef(false);

  useEffect(() => {
    // Browsers can restore the pending screen when returning from Microsoft.
    const reset = () => {
      pending.current = false;
      setPendingRole(null);
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  const signIn = async (role: AppRole) => {
    if (pending.current) return;
    pending.current = true;
    setPendingRole(role);
    try {
      await startMicrosoftLogin(role);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar o login Microsoft."
      );
      pending.current = false;
      setPendingRole(null);
    }
  };

  return { pendingRole, signIn };
}
