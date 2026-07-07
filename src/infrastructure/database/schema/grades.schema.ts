import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'

export const grades = pgTable('grades', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  c: text('c').default(''),
  si: text('si').default(''),
  mn: text('mn').default(''),
  p: text('p').default(''),
  s: text('s').default(''),
  remarks: text('remarks'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
