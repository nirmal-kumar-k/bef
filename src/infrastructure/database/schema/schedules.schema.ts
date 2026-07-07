import { pgTable, uuid, text, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { orders } from './orders.schema'

export const scheduleShiftEnum = pgEnum('schedule_shift', ['Morning', 'Evening'])
export const schedulePriorityEnum = pgEnum('schedule_priority', ['High', 'Normal'])
export const scheduleStatusEnum = pgEnum('schedule_status', [
  'Planned',
  'In Progress',
  'Completed',
  'Delayed',
  'Rescheduled',
])
// Mirrors ISchedule.stages keys
export const scheduleStageNameEnum = pgEnum('schedule_stage_name', [
  'core',
  'melting',
  'moulding',
  'pouring',
  'knockout',
  'shotBlasting',
  'grinding',
  'inspection',
  'readyForDispatch',
])

export const schedules = pgTable('schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id),
  date: text('date').notNull(), // YYYY-MM-DD
  shift: scheduleShiftEnum('shift').default('Morning'),
  priority: schedulePriorityEnum('priority').default('Normal'),
  remarks: text('remarks').default(''),
  status: scheduleStatusEnum('status').default('Planned'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Mirrors ISchedule.stages.<stageName> (IStageData), one row per stage per schedule
export const scheduleStages = pgTable('schedule_stages', {
  id: uuid('id').primaryKey().defaultRandom(),
  scheduleId: uuid('schedule_id').notNull().references(() => schedules.id, { onDelete: 'cascade' }),
  stageName: scheduleStageNameEnum('stage_name').notNull(),
  planned: integer('planned').default(0),
  completed: integer('completed').default(0),
  pending: integer('pending').default(0),
  variance: integer('variance').default(0),
  unit: text('unit').default('units'),
  rejected: integer('rejected').default(0),
  rework: integer('rework').default(0),
  operator: text('operator').default(''),
  remarks: text('remarks').default(''),
  invoiceNumber: text('invoice_number').default(''),
  vehicleNumber: text('vehicle_number').default(''),
  driverName: text('driver_name').default(''),
})

export const schedulesRelations = relations(schedules, ({ one, many }) => ({
  order: one(orders, { fields: [schedules.orderId], references: [orders.id] }),
  stages: many(scheduleStages),
}))

export const scheduleStagesRelations = relations(scheduleStages, ({ one }) => ({
  schedule: one(schedules, { fields: [scheduleStages.scheduleId], references: [schedules.id] }),
}))
