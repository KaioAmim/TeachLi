import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('.', import.meta.url));
const envPath = fileURLToPath(new URL('./.env', import.meta.url));
if (existsSync(envPath)) loadEnvFile(envPath);

const configuredPython = process.env.PYTHON_BIN;
const candidates = configuredPython
  ? [[configuredPython, []]]
  : process.platform === 'win32'
    ? [['py', ['-3']], ['python', []]]
    : [['python3', []], ['python', []]];

for (const [executable, prefix] of candidates) {
  const result = spawnSync(executable, [...prefix, 'setup_ollama.py'], { cwd: directory, stdio: 'inherit' });
  if (!result.error) {
    process.exitCode = result.status ?? 1;
    process.exit();
  }
  if (result.error.code !== 'ENOENT') {
    console.error(`Não foi possível iniciar o Python: ${result.error.message}`);
    process.exit(1);
  }
}

console.error('Python 3 não foi encontrado. Instale-o ou configure PYTHON_BIN e tente novamente.');
process.exit(1);
