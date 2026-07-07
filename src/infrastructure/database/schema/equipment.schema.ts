import { pgTable, uuid, text, integer, boolean, timestamp, pgEnum, jsonb } from 'drizzle-orm/pg-core'

export const equipmentTypeEnum = pgEnum('equipment_type', [
  'Furnace',
  'Moulding Machine',
  'Core Machine',
  'Knockout',
])

export const equipment = pgTable('equipment', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: equipmentTypeEnum('type').notNull(),
  weightCapacity: integer('weight_capacity'),
  firstHeatDurationMins: integer('first_heat_duration_mins').default(150),
  regularHeatDurationMins: integer('regular_heat_duration_mins').default(150),
  avgPiecesPerHour: integer('avg_pieces_per_hour'),
  restrictedCoreBoxes: jsonb('restricted_core_boxes').$type<string[]>().default([]),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
