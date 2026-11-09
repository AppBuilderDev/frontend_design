import { z } from 'zod';
export const endpointFieldSchema = z.object({
  key: z
    .string()
    .regex(/^[a-z][a-z0-9_]{0,39}$/)
    .refine((v) => !['constructor', 'prototype', '__proto__', 'id', 'revision'].includes(v)),
  label: z.string().min(1).max(80),
  type: z.enum(['text', 'integer', 'boolean']).default('text'),
  required: z.boolean().default(false),
});
export const endpointInputSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
    path: z
      .string()
      .min(1)
      .max(500)
      .regex(
        /^\/api\/v1\/projects\/\{projectId\}\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*(?:\/:id)?$/,
        'Usa una ruta del backend del proyecto con {projectId} y :id opcional',
      ),
    fields: z.array(endpointFieldSchema).max(30).default([]),
    itemsPath: z
      .string()
      .regex(/^[a-zA-Z0-9_.]*$/)
      .default('items'),
  })
  .superRefine((v, ctx) => {
    if (new Set(v.fields.map((f) => f.key)).size !== v.fields.length)
      ctx.addIssue({ code: 'custom', message: 'Campos duplicados' });
    if (['PUT', 'PATCH', 'DELETE'].includes(v.method) && !v.path.endsWith('/:id'))
      ctx.addIssue({ code: 'custom', message: 'La ruta requiere :id' });
    if (v.method === 'POST' && v.path.endsWith('/:id'))
      ctx.addIssue({ code: 'custom', message: 'POST requiere una ruta de coleccion' });
  });
export const endpointSchema = endpointInputSchema.safeExtend({
  id: z.string(),
  projectId: z.string(),
  revision: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Endpoint = z.infer<typeof endpointSchema>;
export type EndpointInput = z.infer<typeof endpointInputSchema>;
