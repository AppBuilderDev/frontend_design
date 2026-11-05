import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rename, readdir, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { z } from 'zod';
import { JsonRepository } from '../server/jsonRepository';

vi.mock('node:fs/promises', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs/promises')>();
  return { ...fs, rename: vi.fn(fs.rename) };
});
const directories: string[] = [];
afterEach(async () => {
  vi.mocked(rename).mockReset();
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  vi.mocked(rename).mockImplementation(actual.rename);
  for (const dir of directories.splice(0)) {
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Invalid cleanup path');
    await rm(dir, { recursive: true, force: true });
  }
});
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'builder-retry-'));
  directories.push(dir);
  const file = join(dir, 'items.json');
  return { dir, file, repo: new JsonRepository(file, z.array(z.string())) };
}
it('reintenta bloqueos temporales de Windows y conserva la escritura atómica', async () => {
  const { dir, file, repo } = await setup();
  vi.mocked(rename)
    .mockRejectedValueOnce(Object.assign(new Error('Locked'), { code: 'EPERM' }))
    .mockRejectedValueOnce(Object.assign(new Error('Busy'), { code: 'EBUSY' }));
  await repo.transact((items) => {
    items.push('guardado');
  });
  expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(['guardado']);
  expect(rename).toHaveBeenCalledTimes(3);
  expect(await readdir(dir)).toEqual(['items.json']);
});
it('no pierde el archivo anterior al fallar un guardado y permite la siguiente transacción', async () => {
  const { dir, repo } = await setup();
  await repo.transact((items) => {
    items.push('original');
  });
  vi.mocked(rename).mockRejectedValueOnce(
    Object.assign(new Error('Disk full'), { code: 'ENOSPC' }),
  );
  await expect(
    repo.transact((items) => {
      items.push('fallido');
    }),
  ).rejects.toThrow('Disk full');
  expect(await repo.list()).toEqual(['original']);
  expect(await readdir(dir)).toEqual(['items.json']);
  await repo.transact((items) => {
    items.push('siguiente');
  });
  expect(await repo.list()).toEqual(['original', 'siguiente']);
});
