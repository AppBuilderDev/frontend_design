import { entitySchema, type Entity } from './data';
import { z } from 'zod';
export interface ComponentNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: ComponentNode[];
}
export interface Page {
  id: string;
  name: string;
  code: string;
  status: 'draft' | 'published';
  components: ComponentNode[];
  createdAt: string;
  updatedAt: string;
  revision?: number;
  projectId?: string;
  entities?: Entity[];
  publicationVersion?: number;
}
export const CONTRACT_VERSION = 1;
const jsonValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValue),
    z.record(z.string(), jsonValue),
  ]),
);
export const nodeSchema: z.ZodType<ComponentNode> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    type: z.string().min(1).max(100),
    props: z.record(z.string(), jsonValue),
    children: z.array(nodeSchema).optional(),
  }),
);
export const reservedPaths = ['api', 'admin', 'editor', 'preview', 'assets'];
export const pageCodeSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/,
    'Usa segmentos en minúsculas, números y guiones, sin barra inicial o final',
  )
  .refine((v) => !reservedPaths.includes(v.split('/')[0]), 'Ruta reservada');
export const pageInputSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
  code: pageCodeSchema,
  components: z.array(nodeSchema).max(500),
  status: z.enum(['draft', 'published']),
});
export const pageSchema = pageInputSchema.extend({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  revision: z.number().int().optional(),
  projectId: z.string().optional(),
  entities: z.array(entitySchema).optional(),
  publicationVersion: z.number().int().optional(),
});
export function validTree(nodes: ComponentNode[]): boolean {
  const ids = new Set<string>();
  let count = 0;
  function visit(items: ComponentNode[], depth: number): boolean {
    return (
      depth <= 20 &&
      items.every((n) => {
        if (ids.has(n.id) || ++count > 500) return false;
        ids.add(n.id);
        return visit(n.children ?? [], depth + 1);
      })
    );
  }
  return visit(nodes, 0);
}
