import { pgTable, uuid, text, integer, numeric, jsonb, timestamp } from 'drizzle-orm/pg-core'

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  customer: text('customer').default(''),
  weight: text('weight').default('-'),
  cavities: integer('cavities').default(0),
  ratePerKg: numeric('rate_per_kg'),
  unitPrice: numeric('unit_price'),
  grade: text('grade'),
  remarks: text('remarks'),
  images: jsonb('images').$type<string[]>().default([]),
  linkedPattern: text('linked_pattern'),
  stock: integer('stock').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
