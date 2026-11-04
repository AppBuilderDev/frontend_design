import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pageSchema, type Page } from '../src/models/contracts.ts';
import { z } from 'zod';
export interface StoredPage {
  draft: Page;
  published?: Page;
}
export interface PageRepository {
  list(): Promise<StoredPage[]>;
  transact<T>(operation: (pages: StoredPage[]) => T): Promise<T>;
}
const storedSchema = z.array(z.object({ draft: pageSchema, published: pageSchema.optional() }));
export class JsonPageRepository implements PageRepository {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private file: string) {}
  private async read(): Promise<StoredPage[]> {
    try {
      return storedSchema.parse(JSON.parse(await readFile(this.file, 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }
  async list() {
    await this.queue;
    return this.read();
  }
  transact<T>(operation: (pages: StoredPage[]) => T): Promise<T> {
    const work = this.queue.then(async () => {
      const pages = await this.read();
      const result = operation(pages);
      await mkdir(dirname(this.file), { recursive: true });
      const temp = this.file + '.' + randomUUID() + '.tmp';
      await writeFile(temp, JSON.stringify(pages, null, 2), 'utf8');
      await rename(temp, this.file);
      return result;
    });
    this.queue = work.catch(() => {});
    return work;
  }
}
