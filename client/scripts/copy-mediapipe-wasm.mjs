import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Copia o runtime wasm do @mediapipe/tasks-vision instalado para public/.
 *
 * O glue JS e o .wasm precisam ser da MESMA versão: servir o wasm de um CDN com
 * versão fixa enquanto o npm resolve outra quebra a inicialização de formas
 * silenciosas. Copiando do node_modules, a versão acompanha o package.json
 * automaticamente.
 */
const clientDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const from = path.join(clientDir, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const to = path.join(clientDir, "public", "mediapipe", "wasm");

await mkdir(path.dirname(to), { recursive: true });
await cp(from, to, { recursive: true });
console.log(`wasm do MediaPipe copiado para ${path.relative(clientDir, to)}`);
