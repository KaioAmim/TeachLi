import { useCallback, useEffect, useRef, useState } from "react";
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
const WIDGET_STORAGE_KEY = "@vlibras-widget";
let widgetInitialized = false;

/**
 * O VLibras salva no localStorage se estava aberto e, ao carregar a página, se reabre sozinho
 * quando encontra `"isOpen":true`. O botão próprio sempre começa em "Inativo", então isso deixava
 * o widget ligado e escondido (cursor de tradução e cliques capturados) sem ninguém pedir.
 * Zera esse estado antes de o script do VLibras rodar.
 */
function forgetPersistedOpenState() {
  try {
    const raw = localStorage.getItem(WIDGET_STORAGE_KEY);
    if (!raw?.includes('"isOpen":true')) return;
    const saved = JSON.parse(raw);
    if (saved?.state && typeof saved.state === "object") {
      saved.state.isOpen = false;
      localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(saved));
    } else {
      localStorage.removeItem(WIDGET_STORAGE_KEY);
    }
  } catch {
    try { localStorage.removeItem(WIDGET_STORAGE_KEY); } catch { /* armazenamento indisponível */ }
  }
}

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

/** Controle visual próprio; o atalho nativo do widget fica oculto. */
export default function VLibrasWidget() {
  const [isReady, setIsReady] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const desiredOpen = useRef(false);

  const applyOpenState = useCallback((open: boolean) => {
    desiredOpen.current = open;
    const pluginRoot = document.getElementById("vlibras-app-root");
    if (pluginRoot) {
      // O widget observa `data-active` e liga/desliga a captura de texto da página a partir dele.
      pluginRoot.setAttribute("data-active", String(open));
      pluginRoot.style.display = open ? "" : "none";
      pluginRoot.style.zIndex = "2147483646";
    }
    setIsOpen(open);
  }, []);

  const toggleWidget = useCallback(() => {
    const nextOpen = !desiredOpen.current;
    if (document.getElementById("vlibras-app-root") || !nextOpen) {
      applyOpenState(nextOpen);
      return;
    }
    // Primeira abertura: o botão nativo carrega o app do VLibras e cria #vlibras-app-root.
    desiredOpen.current = true;
    document
      .getElementById("vlibras-access-wrapper")
      ?.shadowRoot?.querySelector<HTMLButtonElement>("#vlibras-button")
      ?.click();
    setIsOpen(true);
  }, [applyOpenState]);

  useEffect(() => {
    let nativeAccessRoot: HTMLElement | null = null;
    let previousAccessDisplay = "";
    let pluginRoot: HTMLElement | null = null;
    // O carregador do VLibras grava `data-active="true"` quando o app termina de carregar, sem saber se
    // o usuário desligou o widget nesse meio-tempo (ex.: clicou duas vezes durante o carregamento).
    // Com isso o widget fica ligado e escondido: cursor de tradução e cliques capturados com o botão
    // em "Inativo". Este observador mantém o atributo sempre igual à escolha do usuário.
    const activeObserver = new MutationObserver(() => {
      if (pluginRoot && pluginRoot.getAttribute("data-active") !== String(desiredOpen.current)) syncOpenState();
    });

    // Com o VLibras ativo, ele escuta cliques no <body> (fase de captura) e traduz o texto
    // clicado em vez de deixar o clique chegar ao elemento. O `document` recebe o evento
    // antes do <body>, então o botão próprio é tratado aqui e o VLibras nunca o vê.
    const isToggleEvent = (event: Event) =>
      event.target instanceof Element && event.target.closest(".teachli-vlibras-toggle") !== null;
    const captureToggleClick = (event: MouseEvent) => {
      if (!isToggleEvent(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      toggleWidget();
    };
    // Evita que o realce de "texto traduzível" do VLibras marque o botão.
    const captureToggleHover = (event: MouseEvent) => {
      if (isToggleEvent(event)) event.stopImmediatePropagation();
    };
    document.addEventListener("click", captureToggleClick, true);
    document.addEventListener("mouseover", captureToggleHover, true);
    document.addEventListener("mouseout", captureToggleHover, true);

    // O "X" do próprio widget fecha o painel sem alterar `data-active`; sincroniza o estado.
    const handleNativeClose = (event: Event) => {
      const closedByWidget = event
        .composedPath()
        .some(node => node instanceof Element && node.matches('#header-actions [aria-label="Fechar"]'));
      if (closedByWidget) applyOpenState(false);
    };

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
        pluginRoot?.shadowRoot?.removeEventListener("click", handleNativeClose);
        pluginRoot = root;
        root.style.zIndex = "2147483646";
        root.shadowRoot?.addEventListener("click", handleNativeClose);
        activeObserver.disconnect();
        activeObserver.observe(root, { attributes: true, attributeFilter: ["data-active"] });
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
    if (!existingScript) forgetPersistedOpenState();
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
      activeObserver.disconnect();
      window.clearInterval(retryTimer);
      document.removeEventListener("click", captureToggleClick, true);
      document.removeEventListener("mouseover", captureToggleHover, true);
      document.removeEventListener("mouseout", captureToggleHover, true);
      pluginRoot?.shadowRoot?.removeEventListener("click", handleNativeClose);
      if (nativeAccessRoot) nativeAccessRoot.style.display = previousAccessDisplay;
    };
  }, [applyOpenState, toggleWidget]);

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
            // `vlibras-ignore` é a classe que o VLibras usa para não realçar elementos.
            className="teachli-vlibras-toggle vlibras-ignore"
            data-active={isOpen}
            aria-pressed={isOpen}
            aria-label={isOpen ? "Fechar VLibras" : "Abrir VLibras"}
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
