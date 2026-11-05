import { readFile, mkdir, writeFile, rename, unlink } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
export interface CollectionRepository<T> {
  list(): Promise<T[]>;
  transact<R>(operation: (items: T[]) => R): Promise<R>;
}
/** Serializes writes in this process and commits each collection by atomic rename. */
export class JsonRepository<T> implements CollectionRepository<T> {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private file: string,
    private schema: z.ZodType<T[]>,
  ) {}
  private async read(): Promise<T[]> {
    try {
      return this.schema.parse(JSON.parse(await readFile(this.file, 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }
  async list() {
    await this.queue;
    return this.read();
  }
  transact<R>(operation: (items: T[]) => R): Promise<R> {
    const work = this.queue.then(async () => {
      const items = await this.read();
      const result = operation(items);
      await mkdir(dirname(this.file), { recursive: true });
      const temp = this.file + '.' + randomUUID() + '.tmp';
      try {
        await writeFile(temp, JSON.stringify(items, null, 2), 'utf8');
        for (let attempt = 0; ; attempt++) {
          try {
            await rename(temp, this.file);
            break;
          } catch (error) {
            // Windows scanners can briefly hold the destination open.
            const code = (error as NodeJS.ErrnoException).code;
            if (attempt >= 4 || !['EPERM', 'EACCES', 'EBUSY'].includes(code ?? '')) throw error;
            await delay(15 * 2 ** attempt);
          }
        }
      } finally {
        await unlink(temp).catch(() => {});
      }
      return result;
    });
    this.queue = work.catch(() => {});
    return work;
  }
}
