import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { createClassroomServer } from './classrooms.mjs';

const envPath = fileURLToPath(new URL('./.env', import.meta.url));
if (existsSync(envPath)) loadEnvFile(envPath);

const { server } = createClassroomServer();
const port = Number(process.env.PORT ?? 8787);
server.listen(port, () => console.log(`Servidor TeachLi ouvindo na porta ${port}`));
