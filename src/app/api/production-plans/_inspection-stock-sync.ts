import { eq, or } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { orders, products, CART_IN_ORDER } from '@/infrastructure/database/schema'
import type { Actor } from '@/infrastructure/audit'
import { moveStock } from '@/infrastructure/stock'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

// Correcting or deleting a past Inspection batch (accepted quantity lives in
// quantityScheduled) must adjust product.stock by the same delta, since that
// stock was already incremented when the batch was first submitted via
// /api/inspection-submit - otherwise a fixed typo would leave stock wrong.
// Runs inside the plan's own transaction, so the plan change and the stock
// change (and its ledger row) commit or roll back together.
export async function syncInspectionStock(tx: Tx, actor: Actor, plan: {
  id: string; itemId: string | null; orderId: string | null
}, oldAccepted: number, newAccepted: number, reason: 'inspection_correction' | 'inspection_undo') {
  const delta = (newAccepted || 0) - (oldAccepted || 0)
  if (!plan.itemId || !plan.orderId || delta === 0) return

  const order = await tx.query.orders.findFirst({
    where: eq(orders.id, plan.orderId),
    with: { cart: CART_IN_ORDER },
  })
  if (!order || !order.cart) return

  const parts = plan.itemId.split('-')
  const idx = parseInt(parts[parts.length - 1], 10)
  const cartItem = order.cart[idx]
  if (!cartItem) return

  const [product] = await tx.select().from(products).where(
    or(eq(products.name, cartItem.productName), eq(products.code, cartItem.product))
  ).limit(1)
  if (!product) return

  await moveStock(tx, actor, { productId: product.id, delta, reason, planId: plan.id, orderId: plan.orderId })
}
