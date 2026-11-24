import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// CSP só no build: o servidor de desenvolvimento do Vite injeta scripts inline para o HMR.
function contentSecurityPolicy(signalingUrl: string): Plugin {
  const signaling = new URL(signalingUrl);
  const http = signaling.protocol === "wss:" ? "https:" : "http:";
  const connect = [`${http}//${signaling.host}`, `${signaling.protocol}//${signaling.host}`];
  const policy = [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval' https://vlibras.gov.br",
    `connect-src 'self' ${connect.join(" ")} https://login.microsoftonline.com https://storage.googleapis.com https://vlibras.gov.br`,
    "img-src 'self' data: blob: https://vlibras.gov.br",
    "style-src 'self' 'unsafe-inline' https://vlibras.gov.br",
    "font-src 'self' data: https://vlibras.gov.br https://cdn.jsdelivr.net",
    "media-src 'self' blob: https://vlibras.gov.br",
    "worker-src 'self' blob:",
    "frame-src https://vlibras.gov.br",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  return {
    name: "teachli-csp",
    apply: "build",
    transformIndexHtml: () => [{ tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: policy }, injectTo: "head-prepend" }],
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), contentSecurityPolicy(loadEnv(mode, rootDir, "VITE_").VITE_SIGNALING_URL || "ws://localhost:8787")],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Bibliotecas grandes em arquivos próprios: o navegador as guarda em cache entre versões
        // do app e a tela inicial não precisa baixar TensorFlow.js nem MediaPipe.
        manualChunks(id) {
          if (id.includes("@tensorflow")) return "tfjs";
          if (id.includes("@mediapipe")) return "mediapipe";
          if (id.includes("node_modules/react") || id.includes("node_modules/wouter")) return "react";
        },
      },
    },
  },
  server: {
    // Microsoft requires the registered callback origin; never fall back to 5174.
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
}));
