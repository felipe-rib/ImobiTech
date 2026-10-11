import { z } from 'zod';
export const roles = ['admin', 'broker', 'owner', 'tenant'] as const;
export type Role = (typeof roles)[number];
export interface User {
  id: string;
  name: string;
  email: string;
  identifier: string | null;
  phone: string | null;
  role: Role;
  active: boolean;
  created_at: string;
  updated_at: string;
}
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
export const idSchema = z.uuid();
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => v || null);
export const passwordSchema = z.string().min(12, 'Use pelo menos 12 caracteres.').max(128);
export const userSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    identifier: optionalText(40),
    phone: optionalText(25),
    role: z.enum(roles),
    active: z.boolean().default(true),
    password: passwordSchema,
  })
  .strict();
export const userPatchSchema = userSchema
  .omit({ active: true })
  .extend({ active: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Informe uma alteração.');
export const propertySchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    type: z.enum(['apartment', 'house', 'commercial', 'land']),
    street: z.string().trim().min(2).max(180),
    number: z.string().trim().min(1).max(20),
    complement: optionalText(100),
    neighborhood: z.string().trim().min(2).max(100),
    city: z.string().trim().min(2).max(100),
    state: z.enum([
      'AC',
      'AL',
      'AP',
      'AM',
      'BA',
      'CE',
      'DF',
      'ES',
      'GO',
      'MA',
      'MT',
      'MS',
      'MG',
      'PA',
      'PB',
      'PR',
      'PE',
      'PI',
      'RJ',
      'RN',
      'RS',
      'RO',
      'RR',
      'SC',
      'SP',
      'SE',
      'TO',
    ]),
    postal_code: z.string().regex(/^\d{8}$/),
    description: optionalText(3000),
    rent: z.number().min(0).max(9999999999.99).multipleOf(0.01).nullable().optional(),
    owner_id: z.uuid(),
  })
  .strict();
export const propertyPatchSchema = propertySchema
  .extend({ status: z.enum(['available', 'unavailable']) })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Informe uma alteração.');
export const listSchema = z.object({
  search: z.string().max(100).default(''),
  page: z.coerce.number().int().min(1).default(1),
  role: z.enum(roles).optional(),
  active: z.enum(['true', 'false']).optional(),
  status: z.enum(['available', 'unavailable']).optional(),
  type: z.enum(['apartment', 'house', 'commercial', 'land']).optional(),
});
