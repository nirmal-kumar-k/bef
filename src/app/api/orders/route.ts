import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { orders, orderItems } from '@/infrastructure/database/schema'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const rows = await db.query.orders.findMany({
      with: { cart: true },
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
    const { cart, id, ...orderData } = body

    const result = await db.transaction(async (tx) => {
      // A client-generated id (assigned the moment the order is created in
      // the UI, before it's ever round-tripped to the server) makes this
      // whole create idempotent: if a double-click or slow-network retry
      // submits the same not-yet-confirmed order twice, the second attempt
      // updates the same row instead of creating a duplicate order.
      const [order] = id
        ? await tx.insert(orders).values({ id, ...orderData })
            .onConflictDoUpdate({ target: orders.id, set: orderData })
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
            cart.map((item: any) => ({
              orderId: order.id,
              product: item.product,
              productName: item.productName,
              quantity: item.quantity,
              deliveryQuantity: item.deliveryQuantity,
              weight: item.weight,
              ratePerKg: item.ratePerKg,
              unitCost: item.unitCost,
            }))
          ).returning()
        : []

      return { ...order, cart: insertedItems }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('POST /api/orders error:', error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
