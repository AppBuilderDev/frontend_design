// Dedicated Playwright launcher. Production server/index.ts never imports this fixture.
import { PlatformStore } from '../../server/platform/store.ts';
import { createPlatform } from '../../server/platform/http.ts';
import { createApi } from '../../server/app.ts';
import { JsonPageRepository } from '../../server/repository.ts';
import { JsonBlockRepository } from '../../server/blocksRepository.ts';
import { resolve, dirname } from 'node:path';
import type { GatewayTransport } from '../../server/platform/externalGateway.ts';
const file = resolve(process.env.PLATFORM_DB!);
const store = new PlatformStore(file);
const transport: GatewayTransport = async (url, headers) => {
  let authorized = false;
  let name = '';
  if (url.hostname === 'catalog.example.test' && url.pathname === '/test/catalog') {
    authorized = headers['X-API-Key'] === 'e2e-test-credential';
    name = 'Producto de prueba';
  } else if (url.hostname === 'catalog.example.test' && url.pathname === '/production/catalog') {
    authorized = headers.Authorization === 'Bearer e2e-prod-credential';
    name = 'Producto de producción';
  } else if (url.hostname === 'catalog.example.test' && url.pathname === '/production/rotated') {
    authorized = headers.Authorization === 'Bearer e2e-rotated-credential';
    name = 'Producto actualizado';
  }
  if (!authorized)
    return {
      status: 401,
      contentType: 'application/json',
      body: Buffer.from('{"error":"not authorized"}'),
    };
  const query = url.searchParams.get('q');
  return {
    status: query === 'redirect' ? 302 : 200,
    contentType: 'application/json',
    body: Buffer.from(
      JSON.stringify({
        items:
          query === 'empty'
            ? []
            : [
                {
                  nombre: query === 'echo' ? (headers.Authorization ?? headers['X-API-Key']) : name,
                  precio: query === 'incompatible' ? 12.5 : 1990,
                  internal: 'not-public',
                },
              ],
      }),
    ),
  };
};
const server = createApi(
  new JsonPageRepository(resolve(dirname(file), 'pages.json')),
  (process.env.CORS_ORIGINS ?? '').split(','),
  new JsonBlockRepository(resolve(dirname(file), 'blocks.json')),
  createPlatform(store, {
    connections: {
      masterKey: Buffer.alloc(32, 7).toString('base64'),
      allowedHosts: ['catalog.example.test'],
      resolve: async () => [{ address: '1.1.1.1', family: 4 }],
      transport,
    },
  }),
  false,
).listen(Number(process.env.API_PORT ?? 3101), '127.0.0.1', () =>
  console.log('API aislada de Playwright'),
);
server.requestTimeout = 15000;
server.headersTimeout = 10000;
const close = () =>
  server.close(() => {
    store.close();
    process.exit(0);
  });
process.on('SIGTERM', close);
process.on('SIGINT', close);
