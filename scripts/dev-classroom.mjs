import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const client = fileURLToPath(new URL('client/', root));
const copy = spawnSync(process.execPath, [fileURLToPath(new URL('client/scripts/copy-mediapipe-wasm.mjs', root))], { cwd: client, stdio: 'inherit' });
if (copy.error || copy.status !== 0) {
  console.error('Não foi possível preparar o cliente. Instale as dependências em client/ e server/ com npm ci.');
  process.exit(1);
}

const children = [];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  const deadline = setTimeout(() => {
    for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }, 3000);
  deadline.unref();
}

console.log('Iniciando TeachLi: site na porta 5173 e servidor de salas na porta 8787 (ou PORT).');
for (const [label, entry, cwd] of [
  ['Servidor de salas', 'server/index.mjs', fileURLToPath(new URL('server/', root))],
  ['Site', 'client/node_modules/vite/bin/vite.js', client],
]) {
  const child = spawn(process.execPath, [fileURLToPath(new URL(entry, root))], { cwd, stdio: 'inherit' });
  children.push(child);
  child.on('error', error => { console.error(`${label}: ${error.message}`); stop(1); });
  child.on('exit', code => {
    if (!stopping) {
      console.error(`${label} encerrou. Encerrando os dois serviços; confira as mensagens acima e se as portas já estão ocupadas.`);
      stop(code || 1);
    }
  });
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
