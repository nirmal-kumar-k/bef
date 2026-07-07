import { pgTable, uuid, text, integer, numeric, timestamp, pgEnum } from 'drizzle-orm/pg-core'
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
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Mirrors IOrder.cart
export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  product: text('product').notNull(),
  productName: text('product_name').notNull(),
  quantity: integer('quantity').notNull(),
  deliveryQuantity: integer('delivery_quantity').default(0),
  weight: numeric('weight').notNull(),
  ratePerKg: numeric('rate_per_kg').notNull(),
  unitCost: numeric('unit_cost').notNull(),
})

export const ordersRelations = relations(orders, ({ many }) => ({
  cart: many(orderItems),
}))

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}))
