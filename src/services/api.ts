import { getProjectScope } from './projectScope';
import { platformRequest } from './platformHttp';
import { blockSchema, type SavedBlock } from '../models/blocks';
import { pageSchema, type Page } from '../models/contracts';
const base = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
async function request(path: string, init?: RequestInit) {
  const project = getProjectScope();
  if (project) return platformRequest('/projects/' + project.id + path.replace(/^\/api/, ''), init);
  const response = await fetch(base + path, init);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error de conexión' }));
    throw new Error(error.message ?? 'No se pudo completar la operación');
  }
  return response.status === 204 ? undefined : response.json();
}
export const pagesApi = {
  list: async (): Promise<Page[]> => pageSchema.array().parse(await request('/api/pages')),
  get: async (id: string): Promise<Page> => pageSchema.parse(await request('/api/pages/' + id)),
  save: async (
    page: Pick<Page, 'name' | 'code' | 'components' | 'status'> & { revision?: number },
    id?: string,
  ): Promise<Page> =>
    pageSchema.parse(
      await request('/api/pages' + (id ? '/' + id : ''), {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(page),
      }),
    ),
  remove: async (id: string, revision?: number) => {
    await request('/api/pages/' + id + (getProjectScope() ? '?revision=' + revision : ''), {
      method: 'DELETE',
    });
  },
};
// Keep loopback hosts consistent so Design and Runtime share the session cookie.
const runtimeAddress = new URL(import.meta.env.VITE_RUNTIME_URL ?? 'http://localhost:5174');
if (
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1', '[::1]'].includes(runtimeAddress.hostname) &&
  ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
)
  runtimeAddress.hostname = window.location.hostname;
export const runtimeUrl = runtimeAddress.toString().replace(/\/$/, '');

export const blocksApi = {
  list: async (): Promise<SavedBlock[]> => blockSchema.array().parse(await request('/api/blocks')),
  save: async (name: string, components: SavedBlock['components']): Promise<SavedBlock> =>
    blockSchema.parse(
      await request('/api/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, components }),
      }),
    ),
  remove: async (id: string) => {
    await request('/api/blocks/' + id, { method: 'DELETE' });
  },
};
