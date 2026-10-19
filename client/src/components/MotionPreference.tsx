import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";

type Preference = "system" | "full" | "reduced";
const storageKey = "teachli.motion";
const MotionContext = createContext({ reduced: true, toggleMotion: () => { } });

function readPreference(): Preference {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved === "full" || saved === "reduced" ? saved : "system";
  } catch {
    return "system";
  }
}

export function MotionPreference({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState(readPreference);
  const [systemReduced, setSystemReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const reduced = preference === "system" ? systemReduced : preference === "reduced";

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateSystem = () => setSystemReduced(query.matches);
    const syncPreference = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) setPreference(readPreference());
    };
    query.addEventListener("change", updateSystem);
    window.addEventListener("storage", syncPreference);
    return () => {
      query.removeEventListener("change", updateSystem);
      window.removeEventListener("storage", syncPreference);
    };
  }, []);

  useLayoutEffect(() => {
    document.documentElement.dataset.motion = reduced ? "reduced" : "full";
  }, [reduced]);

  function toggleMotion() {
    const next = reduced ? "full" : "reduced";
    setPreference(next);
    try { localStorage.setItem(storageKey, next); } catch { /* Keep the session preference if storage is unavailable. */ }
  }

  return <MotionContext.Provider value={{ reduced, toggleMotion }}>{children}</MotionContext.Provider>;
}

export const useMotionPreference = () => useContext(MotionContext);
