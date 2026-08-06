import { pgTable, uuid, text, integer, numeric, boolean, jsonb, timestamp, pgEnum, index } from 'drizzle-orm/pg-core'
import { orders } from './orders.schema'
import { equipment } from './equipment.schema'
import { shifts } from './shifts.schema'

export const productionPlanStageEnum = pgEnum('production_plan_stage', [
  'Core',
  'Mould',
  'Melt',
  'Knockout',
  'Inspection',
])

// Mirrors IProductionPlan. Dynamic-keyed maps (hourlyTargets/hourlyWorkers/hourlyEquipments/
// hourlyActuals) and small nested cost breakdowns (actuals/plannedCharge/allocations) are kept
// as jsonb — they're record<string, T> shapes keyed by hour, not relational entities.
export const productionPlans = pgTable('production_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: text('date').notNull(), // YYYY-MM-DD
  // Real referential integrity as of the 2026-08-06 migration. Deleting an
  // order cascades to its plans at the database level - the order-delete route
  // already did this by hand, this makes it guaranteed rather than dependent
  // on every future code path remembering to.
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'cascade' }),
  // NOT a foreign key: this is `${orderId}-${cartIndex}`, a positional pointer
  // into the cart array rather than a reference to a row. See
  // docs/MIGRATION-PLAN-cart-ordering.md - order_items already has real uuid
  // keys, so this can eventually point at them properly.
  itemId: text('item_id').notNull(),
  stage: productionPlanStageEnum('stage').notNull(),
  coreBoxCode: text('core_box_code').default(''),
  patternRef: text('pattern_ref'),
  quantityScheduled: integer('quantity_scheduled').notNull(),
  laborersAssigned: integer('laborers_assigned').default(1),
  workersAssigned: integer('workers_assigned'),
  // SET NULL rather than cascade: retiring a machine must never erase the
  // record of what it produced.
  equipmentId: uuid('equipment_id').references(() => equipment.id, { onDelete: 'set null' }),
  // Which shift (Day/Night) this plan belongs to - was previously read/written
  // by Core/Mould/Melt planning code but never actually had a column to
  // persist to, so it silently dropped on every save and every plan looked
  // shift-less on reload.
  shiftId: uuid('shift_id').references(() => shifts.id, { onDelete: 'set null' }),
  // Melt-specific heat identity - same story as shiftId: read/written by
  // melt-planning-modal.tsx but never persisted, so heats collapsed into one
  // on reload and mould counts were lost.
  heatNumber: integer('heat_number'),
  heatSequenceNumber: integer('heat_sequence_number'),
  mouldsScheduled: integer('moulds_scheduled'),
  // Manual override of which heat was this furnace's first heat of the day
  // (longer startup duration) - a real record instead of re-deriving it from
  // heatNumber === 1 on every reload, since the user can move it after
  // deleting/reordering heats.
  isFirstHeat: boolean('is_first_heat').default(false),
  // Inspection-specific: quantityScheduled holds the ACCEPTED quantity for
  // this batch (same "scheduled = completed" convention as every other
  // stage) - these two hold the rejected side of the same batch, with the
  // reason mandatory whenever rejectedQuantity > 0.
  rejectedQuantity: integer('rejected_quantity').default(0),
  rejectionReason: text('rejection_reason'),
  hourlyTargets: jsonb('hourly_targets').$type<Record<string, number>>(),
  hourlyWorkers: jsonb('hourly_workers').$type<Record<string, number>>(),
  hourlyEquipments: jsonb('hourly_equipments').$type<Record<string, string>>(),
  hourlyActuals: jsonb('hourly_actuals').$type<Record<string, number>>(),

  // Melt-specific fields
  heatNo: text('heat_no'),
  grade: text('grade'),
  meltWeight: numeric('melt_weight'),
  actualQuantity: numeric('actual_quantity'),
  actualPouredMoulds: numeric('actual_poured_moulds'),
  actuals: jsonb('actuals').$type<{ pigIron?: number; scrap?: number; feMn?: number; carburizer?: number }>(),
  allocations: jsonb('allocations').$type<unknown[]>().default([]),
  isPending: boolean('is_pending').default(false),
  // Why this row's actual output fell short of what was planned (machine
  // breakdown, power cut, ...). Written only by Production Tracking, and only
  // meaningful when actual < planned. This is what turns a bare shortfall
  // into something reportable - the plan itself is never rewritten to match
  // reality, so the variance stays visible and Close Day can still carry the
  // unmade quantity forward.
  varianceReason: text('variance_reason'),
  // Set only on rows created by the Close Day carry-forward process (Production
  // Tracking) - the origin date this row's shortfall came from, purely for
  // display ("Carried forward from Jul 31"). Never set by Production Planning.
  carriedForwardFromDate: text('carried_forward_from_date'),
  isConfirmed: boolean('is_confirmed').default(false),
  possibleQuantity: numeric('possible_quantity').default('0'),
  plannedCharge: jsonb('planned_charge').$type<{ pigIron?: number; scrap?: number; feMn?: number; carburizer?: number }>(),
  startTime: text('start_time'),
  endTime: text('end_time'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  // Declared here, not just created in SQL: drizzle-kit push treats anything
  // absent from the schema as drift and drops it - which is exactly what
  // happened to these two the first time round.
  //
  // Every screen filters plans by date and stage, and the order_id index backs
  // the new foreign key (Postgres does not index FK columns automatically).
  index('production_plans_date_stage_idx').on(table.date, table.stage),
  index('production_plans_order_id_idx').on(table.orderId),
])
