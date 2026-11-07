import { z } from 'zod';
import { fieldSchema, keySchema } from './data';
export type ValueExpression =
  | { kind: 'input'; key: string }
  | { kind: 'record'; step: string; field: string }
  | { kind: 'actor' }
  | { kind: 'literal'; value: string | number | boolean | null }
  | { kind: 'add' | 'subtract'; left: ValueExpression; right: ValueExpression };
export const expressionSchema: z.ZodType<ValueExpression> = z.lazy(() =>
  z.union([
    z.object({ kind: z.literal('input'), key: keySchema }).strict(),
    z
      .object({
        kind: z.literal('record'),
        step: keySchema,
        field: z.union([keySchema, z.literal('id'), z.literal('revision')]),
      })
      .strict(),
    z.object({ kind: z.literal('actor') }).strict(),
    z
      .object({
        kind: z.literal('literal'),
        value: z.union([z.string().max(1000), z.number().int().safe(), z.boolean(), z.null()]),
      })
      .strict(),
    z
      .object({
        kind: z.enum(['add', 'subtract']),
        left: expressionSchema,
        right: expressionSchema,
      })
      .strict(),
  ]),
);
export const operationStepSchema = z.discriminatedUnion('kind', [
  z
    .object({
      id: keySchema,
      kind: z.literal('load'),
      entityId: z.string().min(1),
      recordId: expressionSchema,
    })
    .strict(),
  z
    .object({
      id: keySchema,
      kind: z.literal('assert'),
      left: expressionSchema,
      operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']),
      right: expressionSchema,
      message: z.string().trim().min(1).max(150),
    })
    .strict(),
  z
    .object({
      id: keySchema,
      kind: z.literal('create'),
      entityId: z.string().min(1),
      values: z
        .record(keySchema, expressionSchema)
        .refine((v) => Object.keys(v).length <= 30, 'Máximo 30 campos por paso'),
    })
    .strict(),
  z
    .object({
      id: keySchema,
      kind: z.literal('update'),
      record: keySchema,
      values: z
        .record(keySchema, expressionSchema)
        .refine(
          (v) => Object.keys(v).length > 0 && Object.keys(v).length <= 30,
          'Define de 1 a 30 campos',
        ),
    })
    .strict(),
]);
export const operationInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    key: keySchema,
    inputs: z.array(fieldSchema).max(20),
    allowOperators: z.boolean().default(false),
    steps: z.array(operationStepSchema).min(1).max(20),
    result: z
      .record(keySchema, expressionSchema)
      .refine((v) => Object.keys(v).length <= 20, 'Máximo 20 campos de resultado'),
  })
  .strict()
  .superRefine((o, ctx) => {
    if (new Set(o.inputs.map((f) => f.key)).size !== o.inputs.length)
      ctx.addIssue({ code: 'custom', message: 'Entradas repetidas' });
    if (o.inputs.some((f) => f.unique))
      ctx.addIssue({
        code: 'custom',
        message: 'La unicidad se valida en los registros, no en los parámetros',
      });
    if (new Set(o.steps.map((s) => s.id)).size !== o.steps.length)
      ctx.addIssue({ code: 'custom', message: 'Identificadores de pasos repetidos' });
    if (!o.steps.some((s) => s.kind === 'create' || s.kind === 'update'))
      ctx.addIssue({
        code: 'custom',
        message: 'El servicio debe crear o actualizar al menos un registro',
      });
  });
export type OperationDefinition = z.infer<typeof operationInputSchema>;
export type OperationStep = z.infer<typeof operationStepSchema>;
export const operationContractSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.number().int().positive(),
  inputs: z.array(fieldSchema),
  allowOperators: z.boolean(),
});
export type OperationContract = z.infer<typeof operationContractSchema>;
export interface OperationSummary {
  id: string;
  projectId: string;
  revision: number;
  active: boolean;
  publishedVersion: number;
  draft: OperationDefinition;
  versions: OperationContract[];
}
export const operationValuesSchema = z
  .unknown()
  .superRefine((value, context) => {
    if (value && typeof value === 'object' && !Array.isArray(value))
      for (const key of Object.keys(value))
        if (!keySchema.safeParse(key).success)
          context.addIssue({
            code: 'custom',
            message: 'Identificador de entrada no permitido: ' + key,
          });
  })
  .pipe(z.record(keySchema, z.unknown()));
export const executionInputSchema = z
  .object({
    operationId: z.uuid(),
    version: z.number().int().positive(),
    input: operationValuesSchema,
  })
  .strict();
export interface OperationResult {
  id: string;
  operationId: string;
  serviceId: string;
  version: number;
  output: Record<string, string | number | boolean | null>;
  createdAt: string;
  replayed: boolean;
  simulated?: boolean;
}
