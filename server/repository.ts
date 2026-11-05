import { JsonRepository } from './jsonRepository.ts';
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
export class JsonPageRepository extends JsonRepository<StoredPage> {
  constructor(file: string) {
    super(file, storedSchema);
  }
}
