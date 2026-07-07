import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  value: text('value').notNull().unique(),
  label: text('label').notNull(),
  email: text('email'),
  phone: text('phone'),
  contactPerson: text('contact_person'),
  address: text('address'),
  status: text('status').default('Active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
