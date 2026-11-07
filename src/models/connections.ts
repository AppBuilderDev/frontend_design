import { z } from 'zod';
import { fieldSchema, keySchema } from './data';
import { inventoryRoleSchema } from './inventory';
import { operationValuesSchema } from './operations';
export const environmentSchema = z.enum(['test', 'production']);
export type ConnectionEnvironment = z.infer<typeof environmentSchema>;
const segment = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9_-]+$/)
  .refine(
    (v) => !['__proto__', 'prototype', 'constructor'].includes(v),
    'Ruta de respuesta no permitida',
  );
export const responseFieldSchema = z
  .object({
    key: keySchema,
    label: z.string().trim().min(1).max(80),
    type: z.enum(['text', 'integer', 'money', 'boolean', 'date']),
    path: z.array(segment).max(6),
    required: z.boolean().default(true),
  })
  .strict();
export const connectionDefinitionSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    key: keySchema,
    inputs: z.array(fieldSchema).max(10),
    parameters: z
      .record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/), keySchema)
      .refine((v) => Object.keys(v).length <= 10, 'Máximo diez parámetros'),
    responseMode: z.enum(['list', 'object']),
    responsePath: z.array(segment).max(6),
    fields: z.array(responseFieldSchema).min(1).max(12),
    allowedRoles: z.array(inventoryRoleSchema).min(1).max(3).default(['admin']),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (!d.allowedRoles.includes('admin') || new Set(d.allowedRoles).size !== d.allowedRoles.length)
      ctx.addIssue({
        code: 'custom',
        message: 'Administradores deben conservar acceso y los permisos no se repiten',
      });
    if (
      new Set(d.inputs.map((f) => f.key)).size !== d.inputs.length ||
      new Set(d.fields.map((f) => f.key)).size !== d.fields.length
    )
      ctx.addIssue({ code: 'custom', message: 'Hay identificadores repetidos' });
    for (const f of d.inputs) {
      if (f.unique || f.type === 'relation')
        ctx.addIssue({
          code: 'custom',
          message:
            'Las consultas externas no admiten unicidad o relaciones locales en sus entradas',
        });
      if (f.min !== undefined && f.max !== undefined && f.min > f.max)
        ctx.addIssue({ code: 'custom', message: 'Rango inválido: ' + f.label });
      if (
        f.type === 'select' &&
        (!f.options.length || new Set(f.options).size !== f.options.length)
      )
        ctx.addIssue({ code: 'custom', message: 'Define opciones únicas para ' + f.label });
    }
    for (const key of Object.values(d.parameters))
      if (!d.inputs.some((f) => f.key === key))
        ctx.addIssue({ code: 'custom', message: 'Un parámetro usa una entrada inexistente' });
  });
export type ConnectionDefinition = z.infer<typeof connectionDefinitionSchema>;
export type ResponseField = z.infer<typeof responseFieldSchema>;
export const environmentInputSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    origin: z.string().max(250),
    path: z
      .string()
      .min(1)
      .max(500)
      .refine(
        (v) =>
          /^\/(?!\/)/.test(v) &&
          !/[\\?#]/.test(v) &&
          [...v].every((char) => char.charCodeAt(0) > 32),
        'Usa una ruta fija sin consulta, espacios ni credenciales',
      ),
    auth: z.enum(['none', 'bearer', 'apiKey']),
    headerName: z
      .string()
      .regex(/^X-[A-Za-z0-9-]{1,60}$/i)
      .refine(
        (v) => !/^X-(?:Forwarded|Real|Original|Rewrite|HTTP|Method|Host|Proxy)(?:-|$)/i.test(v),
        'La cabecera no puede controlar enrutamiento o cambiar el método HTTP',
      )
      .default('X-API-Key'),
    secret: z
      .string()
      .trim()
      .min(1)
      .max(4096)
      .regex(/^[\x20-\x7e]+$/, 'La credencial debe ser texto de cabecera válido')
      .optional(),
  })
  .strict();
export type ConnectionEnvironmentInput = z.infer<typeof environmentInputSchema>;
export interface EnvironmentSummary {
  environment: ConnectionEnvironment;
  revision: number;
  origin: string;
  path: string;
  auth: ConnectionEnvironmentInput['auth'];
  headerName: string;
  secretConfigured: boolean;
}
export const connectionContractSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.number().int().positive(),
  inputs: z.array(fieldSchema),
  fields: z.array(responseFieldSchema.omit({ path: true })),
});
export type ConnectionContract = z.infer<typeof connectionContractSchema>;
export interface ConnectionSummary {
  id: string;
  revision: number;
  active: boolean;
  publishedVersion: number;
  draft: ConnectionDefinition;
  versions: ConnectionContract[];
}
export const queryInputSchema = z
  .object({ version: z.number().int().positive(), input: operationValuesSchema })
  .strict();
export interface ConnectionResult {
  connectionId: string;
  version: number;
  items: Record<string, string | number | boolean | null>[];
  checkedAt: string;
}
