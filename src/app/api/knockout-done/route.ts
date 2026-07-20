import { NextRequest, NextResponse } from 'next/server'
import { and, eq, or } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { productionPlans, orders, products, patterns } from '@/infrastructure/database/schema'
import { toLocalDateString } from '@/shared/lib/utils'

// Marks a Knockout Planning item as done: adds `moulds` to that item's
// cumulative knocked-out total (creating its Knockout plan row if this is the
// first time), and adds the resulting product quantity (moulds x cavities)
// into Fettling stock. One click = the whole thing, no separate confirm step.
export async function POST(request: NextRequest) {
  try {
    const { itemId, orderId, patternRef, moulds } = await request.json()

    if (!itemId || !orderId || !moulds || moulds <= 0) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

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

    // Cavities come from the pattern's own mapping for this product (how many
    // of it one mould yields) - the standalone product catalog's cavities
    // field is only a fallback, same precedence used everywhere else this
    // number is computed (e.g. the planning backlog).
    let cavities = product?.cavities || 1
    if (patternRef) {
      const pattern = await db.query.patterns.findFirst({
        where: eq(patterns.code, patternRef),
        with: { mappedProducts: true },
      })
      const mapped = pattern?.mappedProducts?.find(mp => mp.name === cartItem.productName)
      if (mapped?.cavities) cavities = mapped.cavities
    }

    const piecesToAdd = moulds * cavities

    await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(productionPlans).where(
        and(eq(productionPlans.stage, 'Knockout'), eq(productionPlans.itemId, itemId))
      ).limit(1)

      if (existing) {
        await tx.update(productionPlans).set({
          quantityScheduled: (existing.quantityScheduled || 0) + moulds,
          updatedAt: new Date(),
        }).where(eq(productionPlans.id, existing.id))
      } else {
        await tx.insert(productionPlans).values({
          date: toLocalDateString(new Date()),
          orderId,
          itemId,
          stage: 'Knockout',
          patternRef,
          quantityScheduled: moulds,
          laborersAssigned: 1,
        })
      }

      if (product) {
        await tx.update(products).set({ stock: (product.stock || 0) + piecesToAdd }).where(eq(products.id, product.id))
      }
    })

    return NextResponse.json({ success: true, piecesAdded: piecesToAdd })
  } catch (error) {
    console.error('POST /api/knockout-done error:', error)
    return NextResponse.json({ error: 'Failed to mark knockout done' }, { status: 500 })
  }
}
