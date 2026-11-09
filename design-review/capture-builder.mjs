/* global process, fetch, setTimeout, getComputedStyle, document, window, console */
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { chromium } from '@playwright/test';
const root = process.cwd(),
  phase = process.argv[2] ?? 'after',
  output = resolve('design-review', phase);
await mkdir(output, { recursive: true });
const scratch = await mkdtemp(join(tmpdir(), 'builder-visual-'));
const children = [];
let browser;
const errors = [];
function start(args, cwd, env) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  children.push(child);
  child.stderr.on('data', (chunk) => {
    const value = chunk.toString();
    if (!value.includes('NO_COLOR')) process.stderr.write(value);
  });
  return child;
}
async function wait(url) {
  for (let i = 0; i < 100; i++) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      // The development server may still be starting.
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw Error('No arranco ' + url);
}
try {
  start(['--import', 'tsx', 'tests/fixtures/api.ts'], resolve('../backend'), {
    API_PORT: '3141',
    PLATFORM_DB: join(scratch, 'visual.sqlite'),
    CORS_ORIGINS: 'http://127.0.0.1:5193',
  });
  start(
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5193', '--strictPort'],
    root,
    { PLATFORM_API_TARGET: 'http://127.0.0.1:3141' },
  );
  await Promise.all([
    wait('http://127.0.0.1:3141/api/v1/auth/session'),
    wait('http://127.0.0.1:5193'),
  ]);
  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5193/workspace');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).waitFor();
  await page.screenshot({ path: join(output, 'login-desktop.png'), fullPage: true });
  const api = 'http://127.0.0.1:5193/api/v1';
  const request = async (path, method = 'GET', data) => {
    const response = await context.request.fetch(api + path, {
      method,
      headers: { 'X-Requested-With': 'AppBuilderDev' },
      data,
    });
    if (!response.ok()) throw Error(await response.text());
    return response.status() === 204 ? null : response.json();
  };
  const session = await request('/auth/register', 'POST', {
      name: 'Andrea Torres',
      email: 'design-' + Date.now() + '@example.test',
      password: 'Visual-demo-123456',
      organization: 'Estudio Horizonte',
    }),
    projectId = session.projects[0].id,
    base = '/projects/' + projectId;
  const components = [
    {
      id: 'hero',
      type: 'Container',
      props: { padding: '32px', backgroundColor: '#f8fafc', borderRadius: '12px' },
      children: [
        {
          id: 'heading',
          type: 'Heading',
          props: {
            text: 'Todo tu equipo, en sintonía.',
            level: 'h1',
            color: '#172033',
            fontSize: '36px',
          },
        },
        {
          id: 'intro',
          type: 'Paragraph',
          props: {
            text: 'Organiza la información de tu negocio en una sola aplicación.',
            color: '#475569',
          },
        },
        { id: 'action', type: 'Button', props: { text: 'Ver productos', href: '#productos' } },
      ],
    },
    {
      id: 'card',
      type: 'Card',
      props: { title: 'Un espacio para tus ideas', marginTop: '24px' },
      children: [
        {
          id: 'text',
          type: 'Paragraph',
          props: { text: 'Construye, conecta tus servicios y comparte con tu equipo.' },
        },
      ],
    },
  ];
  const first = await request(base + '/pages', 'POST', {
    name: 'Panel principal',
    code: 'inicio',
    status: 'published',
    components,
  });
  await request(base + '/pages', 'POST', {
    name: 'Catálogo de productos',
    code: 'productos',
    status: 'draft',
    components: [],
  });
  await request(base + '/pages', 'POST', {
    name: 'Clientes',
    code: 'clientes',
    status: 'draft',
    components: [],
  });
  const fields = [{ key: 'nombre', label: 'Nombre', type: 'text', required: true }];
  await request(base + '/resources', 'POST', {
    name: 'Productos',
    key: 'productos',
    labelField: 'nombre',
    fields,
  });
  for (const method of ['GET', 'POST', 'PUT', 'DELETE'])
    await request(base + '/endpoints', 'POST', {
      name: {
        GET: 'Listar productos',
        POST: 'Crear producto',
        PUT: 'Editar producto',
        DELETE: 'Eliminar producto',
      }[method],
      method,
      path:
        '/api/v1/projects/{projectId}/resources/productos' +
        (['PUT', 'DELETE'].includes(method) ? '/:id' : ''),
      fields,
    });
  await page.reload();
  await page.getByRole('heading', { name: 'Mis páginas', exact: true }).waitFor();
  await page.getByRole('link', { name: 'Panel principal', exact: true }).waitFor();
  await page.screenshot({ path: join(output, 'pages-desktop.png'), fullPage: true });
  await page.goto('http://127.0.0.1:5193/workspace/routes');
  await page.getByRole('heading', { name: 'Rutas y endpoints', exact: true }).waitFor();
  await page.getByRole('cell', { name: 'Listar productos', exact: true }).waitFor();
  await page.screenshot({ path: join(output, 'routes-desktop.png'), fullPage: true });
  await page.goto('http://127.0.0.1:5193/workspace/editor/' + first.id);
  await page.locator('[data-component-id="heading"]').click();
  await page.getByRole('textbox', { name: 'Texto', exact: true }).waitFor();
  await page.screenshot({ path: join(output, 'editor-desktop.png'), fullPage: true });
  const headingColor = await page
    .locator('[data-component-id="heading"] h1')
    .evaluate((el) => getComputedStyle(el).color);
  if (headingColor !== 'rgb(23, 32, 51)')
    throw Error('El tema cambio el estilo del contenido: ' + headingColor);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:5193/workspace/pages');
  await page.getByRole('heading', { name: 'Mis páginas', exact: true }).waitFor();
  await page.screenshot({ path: join(output, 'pages-mobile.png'), fullPage: true });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  if (overflow) errors.push('Desbordamiento horizontal en workspace movil');
  await page.goto('http://127.0.0.1:5193/workspace/editor/' + first.id);
  await page.locator('[data-component-id="heading"]').waitFor();
  await page.screenshot({ path: join(output, 'editor-mobile.png'), fullPage: true });
  await writeFile(
    join(output, 'verification.json'),
    JSON.stringify({ phase, errors, headingColor, viewportMobile: 390 }, null, 2),
  );
  console.log(JSON.stringify({ phase, output, errors }));
} finally {
  if (browser) await browser.close();
  for (const child of children) child.kill();
}
