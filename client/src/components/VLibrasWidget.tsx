import { useEffect } from "react";

declare global {
  interface Window {
    VLibras?: {
      Widget: new (appUrl: string) => unknown;
    };
  }
}

const SCRIPT_ID = "vlibras-plugin-script";
const APP_URL = "https://vlibras.gov.br/app";

/**
 * Embute o widget oficial do VLibras (avatar 3D que traduz texto da página
 * para Libras). O VLibras não expõe uma API REST de geração de vídeo para
 * terceiros — o widget client-side é a integração suportada oficialmente.
 * https://www.gov.br/governodigital/pt-br/vlibras
 */
export default function VLibrasWidget() {
  useEffect(() => {
    function init() {
      if (window.VLibras) {
        new window.VLibras.Widget(APP_URL);
      }
    }

    if (document.getElementById(SCRIPT_ID)) {
      init();
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `${APP_URL}/vlibras-plugin.js`;
    script.async = true;
    script.onload = init;
    document.body.appendChild(script);
  }, []);

  return (
    <div
      // eslint-disable-next-line react/no-danger -- VLibras requires this exact static markup with its custom `vw*` attributes
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
  );
}
