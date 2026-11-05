import { NextRequest, NextResponse } from 'next/server'
import { and, eq, or, sql } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { productionPlans, orders, products } from '@/infrastructure/database/schema'
import { businessDateString } from '@/shared/lib/utils'
import { currentActor, recordAudit } from '@/infrastructure/audit'
import { publishChange } from '@/infrastructure/realtime'

// Inspects the entire currently-available fettled quantity for one item in a
// single batch: logs one new Inspection-stage plan row (accepted quantity in
// quantityScheduled, same "scheduled = completed" convention as every other
// stage, plus the rejected quantity/reason for this specific batch), and -
// since Inspection-Accepted is the point WIP actually becomes stocked,
// sellable product, not Knockout - adds the accepted quantity to
// product.stock (Finished Stock).
export async function POST(request: NextRequest) {
  try {
    const { itemId, orderId, patternRef, totalAvailable, rejectedQty, reason } = await request.json()

    if (!itemId || !orderId || !totalAvailable || totalAvailable <= 0) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const rejected = Math.max(0, Number(rejectedQty) || 0)
    if (rejected > totalAvailable) {
      return NextResponse.json({ error: 'Rejected quantity cannot exceed the available amount' }, { status: 400 })
    }
    if (rejected > 0 && !reason?.trim()) {
      return NextResponse.json({ error: 'A reason is required when rejecting pieces' }, { status: 400 })
    }
    const accepted = totalAvailable - rejected

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: { cart: true },
    })
    if (!order || !order.cart) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const parts = itemId.split('-')
    const idx = parseInt(parts[parts.length - 1], 10)
    const cartItem = order.cart[idx]
    if (!cartItem) {
      return NextResponse.json({ error: 'Cart item not found' }, { status: 404 })
    }

    const [product] = await db.select().from(products).where(
      or(eq(products.name, cartItem.productName), eq(products.code, cartItem.product))
    ).limit(1)

    const actor = await currentActor()
    const result = await db.transaction(async (tx) => {
      // One inspection per item at a time: a second submission for the same
      // item waits here until the first commits, then sees its batch below.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'inspection:' + itemId}))`)

      // The pieces waiting are computed here, not taken from the browser:
      // knocked out for this item, minus every batch already inspected
      // (accepted + rejected) - the same rule the Planning page displays.
      // If it no longer matches what the inspector was shown, someone else
      // inspected in between, and accepting would count those pieces twice.
      const [{ knockedOut }] = await tx.select({ knockedOut: sql<number>`coalesce(sum(${productionPlans.quantityScheduled}), 0)::int` })
        .from(productionPlans).where(and(eq(productionPlans.itemId, itemId), eq(productionPlans.stage, 'Knockout')))
      const [{ inspected }] = await tx.select({ inspected: sql<number>`coalesce(sum(coalesce(${productionPlans.quantityScheduled}, 0) + coalesce(${productionPlans.rejectedQuantity}, 0)), 0)::int` })
        .from(productionPlans).where(and(eq(productionPlans.itemId, itemId), eq(productionPlans.stage, 'Inspection')))
      const available = knockedOut - inspected
      if (available !== totalAvailable) return { stale: true as const, available }

      const inserted = await tx.insert(productionPlans).values({
        date: businessDateString(),
        orderId,
        itemId,
        stage: 'Inspection',
        patternRef,
        quantityScheduled: accepted,
        rejectedQuantity: rejected,
        rejectionReason: rejected > 0 ? reason.trim() : null,
        laborersAssigned: 1,
        updatedById: actor.id,
        updatedByName: actor.name,
      }).returning()
      await recordAudit(tx, actor, { entityType: 'production_plan', entityId: inserted[0].id, action: 'create', after: inserted[0], version: inserted[0].version })

      if (product && accepted > 0) {
        // Added in the database, not read-then-written here, so two
        // simultaneous additions to the same product cannot overwrite each other.
        await tx.update(products).set({ stock: sql`coalesce(${products.stock}, 0) + ${accepted}` }).where(eq(products.id, product.id))
        await publishChange(tx, actor, { type: 'product', action: 'update', id: product.id, label: product.name })
      }

      return { stale: false as const, row: inserted[0] }
    })

    if (result.stale) {
      return NextResponse.json({
        error: `Someone else has inspected pieces of this item since you opened it - ${result.available} piece(s) are now waiting. Reload and try again.`,
      }, { status: 409 })
    }
    return NextResponse.json({ success: true, row: result.row, accepted, rejected })
  } catch (error) {
    console.error('POST /api/inspection-submit error:', error)
    return NextResponse.json({ error: 'Failed to submit inspection' }, { status: 500 })
  }
}
