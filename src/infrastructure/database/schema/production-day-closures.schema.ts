import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

// Marks a date as finalized in Production Tracking's Close Day flow - once a
// date has a row here, Close Day can't be re-run for it and further actuals
// edits for that date are locked in the UI.
export const productionDayClosures = pgTable('production_day_closures', {
  date: text('date').primaryKey(), // YYYY-MM-DD
  closedAt: timestamp('closed_at').defaultNow().notNull(),
})
