import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core'
import { products } from './products.schema'

// The stock ledger: one row per change to a product's finished stock.
// products.stock is the running total and is only ever changed together with
// a row here, in the same transaction (src/infrastructure/stock), so
// products.stock always equals the sum of that product's movements.
export const stockMovements = pgTable('stock_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Written by the app as UTC (see the note on audit_events.at).
  at: timestamp('at').notNull(),
  // SET NULL so deleting a product keeps its history; productName is the
  // snapshot that keeps those rows readable.
  productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
  productName: text('product_name').notNull(),
  delta: integer('delta').notNull(),
  // products.stock straight after this movement - reads as a bank statement.
  balanceAfter: integer('balance_after').notNull(),
  // 'opening' | 'inspection' | 'inspection_correction' | 'inspection_undo' | 'knockout' | 'adjustment'
  reason: text('reason').notNull(),
  // What caused it. Not foreign keys: the history must outlive the plan/order.
  planId: uuid('plan_id'),
  orderId: uuid('order_id'),
  note: text('note'),
  userId: uuid('user_id'),
  userName: text('user_name'),
}, (table) => [
  index('stock_movements_product_idx').on(table.productId, table.at),
])
