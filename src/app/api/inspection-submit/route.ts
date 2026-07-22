import { NextRequest, NextResponse } from 'next/server'
import { eq, or } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { productionPlans, orders, products } from '@/infrastructure/database/schema'
import { toLocalDateString } from '@/shared/lib/utils'

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

    const [row] = await db.transaction(async (tx) => {
      const inserted = await tx.insert(productionPlans).values({
        date: toLocalDateString(new Date()),
        orderId,
        itemId,
        stage: 'Inspection',
        patternRef,
        quantityScheduled: accepted,
        rejectedQuantity: rejected,
        rejectionReason: rejected > 0 ? reason.trim() : null,
        laborersAssigned: 1,
      }).returning()

      if (product && accepted > 0) {
        await tx.update(products).set({ stock: (product.stock || 0) + accepted }).where(eq(products.id, product.id))
      }

      return inserted
    })

    return NextResponse.json({ success: true, row, accepted, rejected })
  } catch (error) {
    console.error('POST /api/inspection-submit error:', error)
    return NextResponse.json({ error: 'Failed to submit inspection' }, { status: 500 })
  }
}
