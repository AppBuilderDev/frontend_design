import { pageSchema, type Page } from '../models/contracts';
const base = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
async function request(path: string, init?: RequestInit) {
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
    page: Pick<Page, 'name' | 'code' | 'components' | 'status'>,
    id?: string,
  ): Promise<Page> =>
    pageSchema.parse(
      await request('/api/pages' + (id ? '/' + id : ''), {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(page),
      }),
    ),
  remove: async (id: string) => {
    await request('/api/pages/' + id, { method: 'DELETE' });
  },
};
export const runtimeUrl = (import.meta.env.VITE_RUNTIME_URL ?? 'http://localhost:5174').replace(
  /\/$/,
  '',
);
