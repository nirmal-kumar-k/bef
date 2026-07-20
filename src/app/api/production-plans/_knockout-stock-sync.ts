import { eq, or } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { orders, products } from '@/infrastructure/database/schema'

// Knockout plan rows are the point where WIP turns into stocked, sellable
// product - unlike Core/Mould/Melt, saving a Knockout row also needs to move
// product.stock by whatever the quantityScheduled delta is (it's already in
// pieces, so no cavity conversion needed here - that's baked into the
// backlog's required quantity, not into this delta).
export async function syncKnockoutStock(itemId: string | undefined | null, orderId: string | undefined | null, oldQty: number, newQty: number) {
  const delta = (newQty || 0) - (oldQty || 0)
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
