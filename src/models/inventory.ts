import { z } from 'zod';
export const inventoryRoleSchema = z.enum(['admin', 'operator', 'viewer']);
export type InventoryRole = z.infer<typeof inventoryRoleSchema>;
export const inventoryConfigInput = z
  .object({
    entityId: z.string().min(1),
    nameField: z.string().min(1),
    skuField: z.string().optional(),
    unitField: z.string().optional(),
  })
  .strict();
export type InventoryConfig = z.infer<typeof inventoryConfigInput>;
export const movementInput = z
  .object({
    operationId: z.uuid(),
    productId: z.string().min(1),
    type: z.enum(['entry', 'exit', 'adjust']),
    quantity: z.number().int().safe(),
    reason: z.string().trim().min(3).max(500),
    expectedBalance: z.number().int().safe().nonnegative().optional(),
    referenceId: z.string().optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.quantity === 0 || (v.type !== 'adjust' && v.quantity < 0))
      ctx.addIssue({
        code: 'custom',
        message:
          'La cantidad debe ser un entero positivo; en ajustes puede ser negativa, pero nunca cero',
      });
    if (v.type === 'adjust' && v.expectedBalance === undefined)
      ctx.addIssue({ code: 'custom', message: 'El ajuste requiere el saldo observado' });
    if (v.type !== 'adjust' && v.referenceId)
      ctx.addIssue({
        code: 'custom',
        message: 'La referencia a una corrección solo se permite en ajustes',
      });
  });
export type MovementInput = z.infer<typeof movementInput>;
export interface StockItem {
  id: string;
  name: string;
  sku: string;
  unit: string;
  active: boolean;
  revision: number;
  balance: number;
  minimum: number;
  minimumRevision: number;
  belowMinimum: boolean;
}
export interface StockList {
  items: StockItem[];
  total: number;
  page: number;
  pageSize: number;
}
export interface Movement {
  id: string;
  operationId: string;
  productId: string;
  productName: string;
  sku: string;
  type: MovementInput['type'];
  quantity: number;
  delta: number;
  before: number;
  after: number;
  reason: string;
  referenceId: string | null;
  actorId: string;
  actorName: string;
  createdAt: string;
}
export interface MovementList {
  items: Movement[];
  total: number;
  page: number;
  pageSize: number;
}
export interface ApplicationAccess {
  id: string;
  name: string;
  organization: string;
  role: InventoryRole;
  archived: boolean;
}
