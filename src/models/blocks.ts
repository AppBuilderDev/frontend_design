import { z } from 'zod';
import { nodeSchema, validTree } from './contracts';
export const blockInputSchema = z.object({
  name: z.string().trim().min(1, 'Escribe un nombre').max(80),
  components: z.array(nodeSchema).min(1).max(500).refine(validTree, 'Árbol de bloque inválido'),
});
export const blockSchema = blockInputSchema.extend({ id: z.string(), createdAt: z.string() });
export type SavedBlock = z.infer<typeof blockSchema>;
