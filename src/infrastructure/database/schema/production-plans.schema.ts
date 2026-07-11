import { pgTable, uuid, text, integer, numeric, boolean, jsonb, timestamp, pgEnum } from 'drizzle-orm/pg-core'

export const productionPlanStageEnum = pgEnum('production_plan_stage', [
  'Core',
  'Mould',
  'Melt',
  'Knockout',
])

// Mirrors IProductionPlan. Dynamic-keyed maps (hourlyTargets/hourlyWorkers/hourlyEquipments/
// hourlyActuals) and small nested cost breakdowns (actuals/plannedCharge/allocations) are kept
// as jsonb — they're record<string, T> shapes keyed by hour, not relational entities.
export const productionPlans = pgTable('production_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: text('date').notNull(), // YYYY-MM-DD
  orderId: text('order_id').notNull(),
  itemId: text('item_id').notNull(),
  stage: productionPlanStageEnum('stage').notNull(),
  coreBoxCode: text('core_box_code').default(''),
  patternRef: text('pattern_ref'),
  quantityScheduled: integer('quantity_scheduled').notNull(),
  laborersAssigned: integer('laborers_assigned').default(1),
  workersAssigned: integer('workers_assigned'),
  equipmentId: text('equipment_id'),
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
  isConfirmed: boolean('is_confirmed').default(false),
  possibleQuantity: numeric('possible_quantity').default('0'),
  plannedCharge: jsonb('planned_charge').$type<{ pigIron?: number; scrap?: number; feMn?: number; carburizer?: number }>(),
  startTime: text('start_time'),
  endTime: text('end_time'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
