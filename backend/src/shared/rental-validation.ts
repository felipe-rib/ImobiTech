import { z } from 'zod';
export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use uma data válida.')
  .refine((v) => {
    const date = new Date(`${v}T12:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === v;
  }, 'Data inexistente.')
  .refine((v) => v >= '1900-01-01', 'Informe uma data a partir de 1900.');
export const businessToday = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
const money = z.number().positive().max(9999999999.99).multipleOf(0.01);
export const rentalList = z.object({
  search: z.string().trim().max(100).default(''),
  page: z.coerce.number().int().min(1).default(1),
  status: z.string().optional(),
});
export const contractCreate = z
  .object({
    property_id: z.uuid(),
    owner_id: z.uuid(),
    tenant_id: z.uuid(),
    start_date: dateOnly,
    end_date: dateOnly,
    monthly_rent: money,
    due_day: z.number().int().min(1).max(31),
    generate_installments: z.boolean().optional(),
  })
  .strict()
  .refine((v) => v.end_date >= v.start_date, {
    path: ['end_date'],
    message: 'O término deve ser igual ou posterior ao início.',
  });
export const contractPatch = z
  .object({
    start_date: dateOnly.optional(),
    end_date: dateOnly.optional(),
    monthly_rent: money.optional(),
    due_day: z.number().int().min(1).max(31).optional(),
    status: z.literal('closed').optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Informe uma alteração.');
export const paymentCreate = z
  .object({
    competence: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use ano e mês válidos.'),
    amount: money,
    due_date: dateOnly,
    paid_at: dateOnly.nullable().default(null),
  })
  .strict();
export const paymentPatch = paymentCreate
  .omit({ paid_at: true })
  .extend({ paid_at: dateOnly.nullable() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Informe uma alteração.');
export const visitCreate = z
  .object({
    property_id: z.uuid(),
    participant_name: z.string().trim().min(3).max(120),
    starts_at: z.iso.datetime({ offset: true }),
    ends_at: z.iso.datetime({ offset: true }),
  })
  .strict();
export const visitPatch = z
  .object({
    participant_name: z.string().trim().min(3).max(120).optional(),
    starts_at: z.iso.datetime({ offset: true }).optional(),
    ends_at: z.iso.datetime({ offset: true }).optional(),
    status: z.enum(['confirmed', 'cancelled']).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Informe uma alteração.');
