import { z } from 'zod';
export const keySchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,39}$/, 'Usa minúsculas, números y guiones bajos')
  .refine(
    (v) => !['constructor', 'prototype', '__proto__', 'id', 'active', 'revision'].includes(v),
    'Identificador reservado',
  );
export const fieldSchema = z.object({
  key: keySchema,
  label: z.string().trim().min(1).max(80),
  type: z.enum(['text', 'integer', 'money', 'boolean', 'date', 'select', 'relation']),
  required: z.boolean().default(false),
  unique: z.boolean().default(false),
  min: z.number().int().safe().optional(),
  max: z.number().int().safe().optional(),
  options: z.array(z.string().trim().min(1).max(80)).max(100).default([]),
  relationEntityId: z.string().optional(),
});
export const entityInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    key: keySchema,
    labelField: keySchema,
    fields: z.array(fieldSchema).min(1).max(30),
  })
  .superRefine((e, ctx) => {
    if (new Set(e.fields.map((f) => f.key)).size !== e.fields.length)
      ctx.addIssue({ code: 'custom', message: 'Hay campos repetidos' });
    if (!e.fields.some((f) => f.key === e.labelField))
      ctx.addIssue({ code: 'custom', message: 'El campo de etiqueta no existe' });
    e.fields.forEach((f) => {
      if (f.min !== undefined && f.max !== undefined && f.min > f.max)
        ctx.addIssue({ code: 'custom', message: 'Rango inválido: ' + f.label });
      if (f.type === 'relation' && !f.relationEntityId)
        ctx.addIssue({ code: 'custom', message: 'Selecciona la entidad relacionada' });
      if (
        f.type === 'select' &&
        (!f.options.length || new Set(f.options).size !== f.options.length)
      )
        ctx.addIssue({ code: 'custom', message: 'Define opciones únicas para ' + f.label });
    });
  });
export const entitySchema = entityInputSchema.safeExtend({
  id: z.string(),
  projectId: z.string(),
  revision: z.number().int(),
});
export type Entity = z.infer<typeof entitySchema>;
export type EntityInput = z.infer<typeof entityInputSchema>;
export type DataField = z.infer<typeof fieldSchema>;
export interface DataRecord {
  id: string;
  values: Record<string, string | number | boolean | null>;
  labels: Record<string, string>;
  active: boolean;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
export interface RecordList {
  items: DataRecord[];
  total: number;
  page: number;
  pageSize: number;
}
export type ProjectRole = 'owner' | 'editor' | 'reader';
export interface ProjectAccess {
  id: string;
  organizationId: string;
  organization: string;
  name: string;
  role: ProjectRole;
  archived: boolean;
}
export interface PlatformSession {
  user: { id: string; name: string; email: string };
  projects: ProjectAccess[];
}
export interface Invitation {
  id: string;
  email: string;
  role: 'editor' | 'reader';
  expiresAt: string;
}
export interface Member {
  userId: string;
  name: string;
  email: string;
  role: ProjectRole;
}
export const dataComponentTypes = ['DataForm', 'DataTable', 'DataDetail'] as const;
export function parseMoney(text: string): number {
  if (!/^-?\d+(?:[.,]\d{1,2})?$/.test(text))
    throw new Error('Usa un importe con hasta dos decimales');
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace('-', '').replace(',', '.').split('.');
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  const signed = negative ? -result : result;
  if (signed > BigInt(Number.MAX_SAFE_INTEGER) || signed < BigInt(Number.MIN_SAFE_INTEGER))
    throw new Error('Importe fuera de rango');
  return Number(signed);
}
export function formatMoney(cents: number): string {
  if (!Number.isSafeInteger(cents)) return 'Importe inválido';
  const value = BigInt(cents < 0 ? -cents : cents);
  return `${cents < 0 ? '-' : ''}S/ ${new Intl.NumberFormat('es-PE').format(value / 100n)}.${String(value % 100n).padStart(2, '0')}`;
}
export function moneyInput(cents: number): string {
  const value = BigInt(cents < 0 ? -cents : cents);
  return `${cents < 0 ? '-' : ''}${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
}
