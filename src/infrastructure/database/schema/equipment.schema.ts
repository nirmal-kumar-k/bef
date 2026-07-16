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
  // Furnace-only: a persistent, never-auto-resetting count of heats ever run on
  // this furnace, used for the heat card's sequence badge. Unlike the heat
  // code's daily segment, this only changes when a heat is added or the user
  // explicitly resets it in Equipment Master.
  heatSequence: integer('heat_sequence').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
