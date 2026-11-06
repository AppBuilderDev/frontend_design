import { PlatformStore } from './platform/store.ts';
import { createPlatform } from './platform/http.ts';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApi } from './app.ts';
import { JsonBlockRepository } from './blocksRepository.ts';
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
const platformStore = new PlatformStore(
  process.env.PLATFORM_DB
    ? resolve(process.env.PLATFORM_DB)
    : fileURLToPath(new URL('./data/platform.sqlite', import.meta.url)),
);
const server = createApi(
  new JsonPageRepository(file),
  origins,
  new JsonBlockRepository(
    process.env.BLOCKS_FILE
      ? resolve(process.env.BLOCKS_FILE)
      : resolve(dirname(file), 'blocks.json'),
  ),
  createPlatform(platformStore),
  process.env.ENABLE_LEGACY_API === '1',
).listen(port, host, () => console.log(`API de desarrollo: http://${host}:${port}`));

server.requestTimeout = 15000;
server.headersTimeout = 10000;
function shutdown() {
  server.close(() => {
    platformStore.close();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
