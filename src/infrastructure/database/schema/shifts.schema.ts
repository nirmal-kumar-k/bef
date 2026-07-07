import { pgTable, uuid, text, boolean, timestamp, integer } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const shifts = pgTable('shifts', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const shiftBreaks = pgTable('shift_breaks', {
  id: uuid('id').primaryKey().defaultRandom(),
  shiftId: uuid('shift_id').notNull().references(() => shifts.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(0),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
})

export const shiftsRelations = relations(shifts, ({ many }) => ({
  breaks: many(shiftBreaks),
}))

export const shiftBreaksRelations = relations(shiftBreaks, ({ one }) => ({
  shift: one(shifts, { fields: [shiftBreaks.shiftId], references: [shifts.id] }),
}))
