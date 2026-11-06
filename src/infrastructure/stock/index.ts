import { eq, sql } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { products, stockMovements } from '@/infrastructure/database/schema'
import { publishChange } from '@/infrastructure/realtime'
import type { Actor } from '@/infrastructure/audit'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Executor = typeof db | Tx

export type StockReason = 'opening' | 'inspection' | 'inspection_correction' | 'inspection_undo' | 'knockout' | 'adjustment'

// The ONLY way finished stock changes. Adds `delta` to products.stock in the
// database (so simultaneous changes cannot overwrite each other) and records
// the movement with the resulting balance - both in the caller's transaction,
// so the total and its ledger can never disagree. Also tells other screens.
export async function moveStock(ex: Executor, actor: Actor, m: {
  productId: string
  delta: number
  reason: StockReason
  planId?: string | null
  orderId?: string | null
  note?: string | null
}) {
  if (!Number.isInteger(m.delta) || m.delta === 0) return null
  const [p] = await ex.update(products)
    .set({ stock: sql`coalesce(${products.stock}, 0) + ${m.delta}` })
    .where(eq(products.id, m.productId))
    .returning({ id: products.id, name: products.name, stock: products.stock })
  if (!p) return null
  await ex.insert(stockMovements).values({
    at: new Date(),
    productId: p.id,
    productName: p.name,
    delta: m.delta,
    balanceAfter: p.stock ?? 0,
    reason: m.reason,
    planId: m.planId ?? null,
    orderId: m.orderId ?? null,
    note: m.note ?? null,
    userId: actor.id,
    userName: actor.name,
  })
  await publishChange(ex, actor, { type: 'product', action: 'update', id: p.id, label: p.name })
  return p
}
