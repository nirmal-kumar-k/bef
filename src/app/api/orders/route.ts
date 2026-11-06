import { NextRequest, NextResponse } from 'next/server'
import { asc, eq, sql } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { orders, orderItems, CART_IN_ORDER } from '@/infrastructure/database/schema'
import { currentActor, recordAudit } from '@/infrastructure/audit'
import { orderSnapshot } from './_order-snapshot'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const rows = await db.query.orders.findMany({
      with: { cart: CART_IN_ORDER },
      orderBy: (orders, { desc }) => [desc(orders.createdAt)],
    })
    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET /api/orders error:', error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // updatedBy*/version are server-managed and never taken from the body.
    const { cart, id, version: _v, updatedById: _ubi, updatedByName: _ubn, createdAt: _ca, updatedAt: _ua, ...fields } = body
    const actor = await currentActor()
    const orderData = { ...fields, updatedById: actor.id, updatedByName: actor.name }

    const result = await db.transaction(async (tx) => {
      const [existing] = id ? await tx.select().from(orders).where(eq(orders.id, id)) : []
      const before = existing ? orderSnapshot(existing, await tx.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(asc(orderItems.position))) : null
      // A client-generated id (assigned the moment the order is created in
      // the UI, before it's ever round-tripped to the server) makes this
      // whole create idempotent: if a double-click or slow-network retry
      // submits the same not-yet-confirmed order twice, the second attempt
      // updates the same row instead of creating a duplicate order.
      const [order] = id
        ? await tx.insert(orders).values({ id, ...orderData })
            .onConflictDoUpdate({ target: orders.id, set: { ...orderData, updatedAt: new Date(), version: sql`${orders.version} + 1` } })
            .returning()
        : await tx.insert(orders).values(orderData).returning()

      // Same idempotency for the cart lines: if a prior attempt at this
      // exact create already inserted them, clear those out before writing
      // the current set instead of adding a second copy of every item.
      if (id) {
        await tx.delete(orderItems).where(eq(orderItems.orderId, order.id))
      }

      const insertedItems = cart?.length
        ? await tx.insert(orderItems).values(
            cart.map((item: any, index: number) => ({
              orderId: order.id,
              // Cart position = the line's place in the submitted list.
              position: index,
              product: item.product,
              productName: item.productName,
              quantity: item.quantity,
              deliveryQuantity: item.deliveryQuantity,
              weight: item.weight,
              ratePerKg: item.ratePerKg,
              unitCost: item.unitCost,
            }))
          ).returning().then(rows => rows.sort((a, b) => a.position - b.position))
        : []

      await recordAudit(tx, actor, before
        ? { entityType: 'order', entityId: order.id, action: 'update', before, after: orderSnapshot(order, insertedItems), version: order.version }
        : { entityType: 'order', entityId: order.id, action: 'create', after: orderSnapshot(order, insertedItems), version: order.version })
      return { ...order, cart: insertedItems }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('POST /api/orders error:', error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
