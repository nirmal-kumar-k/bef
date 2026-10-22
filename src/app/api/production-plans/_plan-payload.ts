import { z } from 'zod'
import { productionPlanStageEnum } from '@/infrastructure/database/schema'

// The only fields a client may write on a production plan. Previously both
// routes copied every key of the request body into the insert/update, so a
// misspelt or stale field (actualMeltWeight) was silently swallowed for months
// and any client could write any column. Unknown keys are now rejected with a
// 400 that names them, instead of being dropped or passed through.
//
// Types were measured against the stored rows, not assumed: hourly maps hold
// numbers (hourlyEquipments holds equipment ids), allocations is always an
// array. Columns that are NOT NULL in the table accept no null here.

const int = z.number().int()
// numeric columns: callers send numbers, Drizzle types them as strings
const numeric = z.union([z.number(), z.string()]).transform(String)
const charge = z.object({
  pigIron: z.number().optional(),
  scrap: z.number().optional(),
  feMn: z.number().optional(),
  carburizer: z.number().optional(),
}).strict()

export const planFields = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD'),
  orderId: z.string().nullish(),
  itemId: z.string(),
  stage: z.enum(productionPlanStageEnum.enumValues),
  coreBoxCode: z.string().nullish(),
  patternRef: z.string().nullish(),
  quantityScheduled: int,
  laborersAssigned: int.nullish(),
  workersAssigned: int.nullish(),
  equipmentId: z.string().nullish(),
  shiftId: z.string().nullish(),
  heatNumber: int.nullish(),
  heatSequenceNumber: int.nullish(),
  mouldsScheduled: int.nullish(),
  isFirstHeat: z.boolean().nullish(),
  rejectedQuantity: int.nullish(),
  rejectionReason: z.string().nullish(),
  hourlyTargets: z.record(z.string(), z.number()).nullish(),
  hourlyWorkers: z.record(z.string(), z.number()).nullish(),
  hourlyEquipments: z.record(z.string(), z.string()).nullish(),
  hourlyActuals: z.record(z.string(), z.number()).nullish(),
  heatNo: z.string().nullish(),
  grade: z.string().nullish(),
  meltWeight: numeric.nullish(),
  actualQuantity: numeric.nullish(),
  actualPouredMoulds: numeric.nullish(),
  actuals: charge.nullish(),
  allocations: z.array(z.unknown()).nullish(),
  isPending: z.boolean().nullish(),
  varianceReason: z.string().nullish(),
  carriedForwardFromDate: z.string().nullish(),
  isConfirmed: z.boolean().nullish(),
  possibleQuantity: numeric.nullish(),
  plannedCharge: charge.nullish(),
  startTime: z.string().nullish(),
  endTime: z.string().nullish(),
}).strict()

// Sent by the planning modals alongside the real fields (row bookkeeping) or
// managed by the server itself - accepted and discarded, never written.
const IGNORED_KEYS = ['id', '_id', '_isNew', '_delete', 'createdAt', 'updatedAt']

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string }

function parse<S extends z.ZodTypeAny>(schema: S, body: unknown): ParseResult<z.output<S>> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Request body must be a JSON object' }
  }
  const rest: Record<string, unknown> = { ...(body as Record<string, unknown>) }
  for (const key of IGNORED_KEYS) delete rest[key]
  const result = schema.safeParse(rest)
  if (result.success) return { ok: true, data: result.data }
  const error = result.error.issues
    .map(i => i.code === 'unrecognized_keys'
      ? `unknown field(s): ${i.keys.join(', ')}`
      : `${i.path.join('.') || 'body'}: ${i.message}`)
    .join('; ')
  return { ok: false, error }
}

// POST creates a row, so the NOT NULL columns must be present.
export const parseCreate = (body: unknown) => parse(planFields, body)
// PUT updates only the fields supplied.
export const parseUpdate = (body: unknown) => parse(planFields.partial(), body)
