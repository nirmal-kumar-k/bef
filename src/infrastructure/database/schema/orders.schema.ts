import { pgTable, uuid, text, integer, numeric, timestamp, pgEnum, unique } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const orderStatusEnum = pgEnum('order_status', ['Received', 'Completed'])

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerOrderNo: text('customer_order_no').notNull(),
  internalOrderNo: text('internal_order_no').default(''),
  customer: text('customer').default(''),
  orderDate: text('order_date').default(''),
  deliveryDate: text('delivery_date').default(''),
  status: orderStatusEnum('status').default('Received'),
  gstPercent: numeric('gst_percent').default('18'),
  subtotal: numeric('subtotal').default('0'),
  gstAmount: numeric('gst_amount').default('0'),
  grandTotal: numeric('grand_total').default('0'),
  // Optimistic locking: bumped on every write. A save carrying an older
  // version is refused (409) instead of silently overwriting someone
  // else's change. See src/infrastructure/audit.
  version: integer('version').default(1).notNull(),
  // Who last changed this row, from the server-side session. Name is a
  // snapshot so it survives the user being renamed or deleted.
  updatedById: uuid('updated_by_id'),
  updatedByName: text('updated_by_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Mirrors IOrder.cart
export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  // Cart position, 0-based and gap-free. production_plans.item_id is
  // `${orderId}-${position}`, and every screen resolves it as order.cart[idx],
  // so this ordering is load-bearing: the cart must always be read in
  // position order (CART_IN_ORDER), and an edit may never move a line that
  // has plans (enforced in PUT /api/orders/[id]).
  position: integer('position').notNull(),
  product: text('product').notNull(),
  productName: text('product_name').notNull(),
  quantity: integer('quantity').notNull(),
  deliveryQuantity: integer('delivery_quantity').default(0),
  weight: numeric('weight').notNull(),
  ratePerKg: numeric('rate_per_kg').notNull(),
  unitCost: numeric('unit_cost').notNull(),
}, (table) => [
  unique('order_items_order_position_unique').on(table.orderId, table.position),
])

// Use for every read of an order's cart: `with: { cart: CART_IN_ORDER }`.
// Without an ORDER BY, Postgres returns rows in physical order, which can
// change after an UPDATE or VACUUM - silently repointing every plan.
export const CART_IN_ORDER = {
  orderBy: (items: typeof orderItems._.columns, { asc }: { asc: (c: any) => any }) => [asc(items.position)],
} as const

export const ordersRelations = relations(orders, ({ many }) => ({
  cart: many(orderItems),
}))

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}))
