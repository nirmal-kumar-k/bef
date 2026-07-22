import { eq, or } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { orders, products } from '@/infrastructure/database/schema'

// Correcting or deleting a past Inspection batch (accepted quantity lives in
// quantityScheduled) must adjust product.stock by the same delta, since that
// stock was already incremented when the batch was first submitted via
// /api/inspection-submit - otherwise a fixed typo would leave stock wrong.
export async function syncInspectionStock(itemId: string | undefined | null, orderId: string | undefined | null, oldAccepted: number, newAccepted: number) {
  const delta = (newAccepted || 0) - (oldAccepted || 0)
  if (!itemId || !orderId || delta === 0) return

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: { cart: true },
  })
  if (!order || !order.cart) return

  const parts = itemId.split('-')
  const idx = parseInt(parts[parts.length - 1], 10)
  const cartItem = order.cart[idx]
  if (!cartItem) return

  const [product] = await db.select().from(products).where(
    or(eq(products.name, cartItem.productName), eq(products.code, cartItem.product))
  ).limit(1)
  if (!product) return

  await db.update(products).set({ stock: (product.stock || 0) + delta }).where(eq(products.id, product.id))
}
