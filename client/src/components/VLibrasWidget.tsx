import { useEffect, useRef, useState } from "react";
import { Languages } from "lucide-react";
import { createPortal } from "react-dom";
import "./VLibrasWidget.css";

declare global {
  interface Window {
    VLibras?: {
      Widget: new (appUrl: string) => unknown;
    };
  }
}

const SCRIPT_ID = "vlibras-plugin-script";
const APP_URL = "https://vlibras.gov.br/app";
let widgetInitialized = false;

/** Pede ao widget que traduza um texto. O player não é uma API estável do VLibras. */
export function translateWithVLibras(text: string): boolean {
  try {
    const player = (window as unknown as { plugin?: { player?: { translate?: (value: string) => void } } }).plugin?.player;
    if (typeof player?.translate !== "function") return false;
    player.translate(text);
    return true;
  } catch {
    return false;
  }
}

/** O controle visual próprio aciona o botão documentado pelo widget oficial. */
export default function VLibrasWidget() {
  const [isReady, setIsReady] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const desiredOpen = useRef(false);

  useEffect(() => {
    let nativeAccessRoot: HTMLElement | null = null;
    let previousAccessDisplay = "";
    let pluginRoot: HTMLElement | null = null;

    const syncOpenState = () => {
      if (pluginRoot) {
        pluginRoot.style.display = desiredOpen.current ? "" : "none";
        pluginRoot.style.zIndex = "2147483646";
        pluginRoot.setAttribute("data-active", String(desiredOpen.current));
      }
      if (nativeAccessRoot) nativeAccessRoot.style.display = "none";
      setIsOpen(desiredOpen.current);
    };

    const initializeAndConnect = () => {
      if (window.VLibras && !widgetInitialized) {
        new window.VLibras.Widget(APP_URL);
        widgetInitialized = true;
      }

      // O atalho original vive em uma shadow root separada da aplicação.
      const accessRoot = document.getElementById("vlibras-access-wrapper");
      if (accessRoot && accessRoot !== nativeAccessRoot) {
        nativeAccessRoot = accessRoot;
        previousAccessDisplay = nativeAccessRoot.style.display;
        nativeAccessRoot.style.display = "none";
      }
      const root = document.getElementById("vlibras-app-root");
      if (!accessRoot && !root) return false;
      setLoadError(false);
      setIsReady(true);

      // A raiz contém o painel, o avatar e o atalho "Interagir" do widget.
      if (!root) return false;
      if (root !== pluginRoot) {
        pluginRoot = root;
        root.style.zIndex = "2147483646";
      }
      syncOpenState();
      return true;
    };

    const rootObserver = new MutationObserver(() => {
      if (initializeAndConnect()) {
        rootObserver.disconnect();
        window.clearInterval(retryTimer);
      }
    });
    rootObserver.observe(document.body, { childList: true, subtree: true });

    const retryTimer = window.setInterval(() => {
      const connected = initializeAndConnect();
      if (document.getElementById("vlibras-access-wrapper")) window.clearInterval(retryTimer);
      if (connected) {
        rootObserver.disconnect();
      }
    }, 400);

    const existingScript = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      initializeAndConnect();
      existingScript.addEventListener("error", () => setLoadError(true), { once: true });
    } else {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = `${APP_URL}/vlibras-plugin.js`;
      script.async = true;
      script.onload = initializeAndConnect;
      script.onerror = () => setLoadError(true);
      document.body.appendChild(script);
    }

    return () => {
      rootObserver.disconnect();
      window.clearInterval(retryTimer);
      if (nativeAccessRoot) nativeAccessRoot.style.display = previousAccessDisplay;
    };
  }, []);

  const toggleWidget = () => {
    const nextOpen = !desiredOpen.current;
    desiredOpen.current = nextOpen;
    const pluginRoot = document.getElementById("vlibras-app-root");
    if (pluginRoot) {
      pluginRoot.setAttribute("data-active", String(nextOpen));
      pluginRoot.style.display = nextOpen ? "" : "none";
      pluginRoot.style.zIndex = "2147483646";
      setIsOpen(nextOpen);
      return;
    }
    if (!nextOpen) return;
    const nativeButton = document
      .getElementById("vlibras-access-wrapper")
      ?.shadowRoot?.querySelector<HTMLButtonElement>("#vlibras-button");
    nativeButton?.click();
    setIsOpen(true);
  };

  return (
    <>
      <div
        // O VLibras exige este contêiner e seus atributos customizados.
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: `
            <div vw class="enabled">
              <div vw-access-button class="active"></div>
              <div vw-plugin-wrapper>
                <div class="vw-plugin-top-wrapper"></div>
              </div>
            </div>
          `,
        }}
      />
      {createPortal(
        <>
          <button
            type="button"
            className="teachli-vlibras-toggle"
            data-active={isOpen}
            aria-pressed={isOpen}
            aria-label={isOpen ? "Fechar VLibras" : "Abrir VLibras"}
            onClick={toggleWidget}
            disabled={!isReady}
          >
            <Languages size={18} aria-hidden="true" />
            <span>{loadError ? "VLibras indisponível" : isReady ? "VLibras" : "Carregando Libras"}</span>
            <i aria-hidden="true" />
            <span className="teachli-vlibras-state">{isOpen ? "Ativo" : "Inativo"}</span>
          </button>
          <span className="teachli-vlibras-status" role="status" aria-live="polite">
            {loadError ? "Não foi possível carregar o VLibras." : isOpen ? "VLibras ativado." : "VLibras desativado."}
          </span>
        </>,
        document.body,
      )}
    </>
  );
}
