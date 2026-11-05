import { blockSchema, type SavedBlock } from '../src/models/blocks.ts';
import { JsonRepository, type CollectionRepository } from './jsonRepository.ts';
export type BlockRepository = CollectionRepository<SavedBlock>;
export class JsonBlockRepository extends JsonRepository<SavedBlock> {
  constructor(file: string) {
    super(file, blockSchema.array());
  }
}
