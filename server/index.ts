import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApi } from './app.ts';
import { JsonPageRepository } from './repository.ts';
const file = process.env.PAGES_FILE
  ? resolve(process.env.PAGES_FILE)
  : fileURLToPath(new URL('./data/pages.json', import.meta.url));
const origins = (
  process.env.CORS_ORIGINS ??
  'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174'
)
  .split(',')
  .map((v) => v.trim());
const port = Number(process.env.API_PORT ?? 3001);
const host = process.env.API_HOST ?? '127.0.0.1';
createApi(new JsonPageRepository(file), origins).listen(port, host, () =>
  console.log(`API de desarrollo: http://${host}:${port}`),
);
