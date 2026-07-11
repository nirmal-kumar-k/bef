import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { orders, orderItems, productionPlans } from '@/infrastructure/database/schema'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: { cart: true },
    })
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(order)
  } catch (error) {
    console.error('GET /api/orders/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { cart, id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = body
    const orderData: Record<string, any> = {}
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) orderData[key] = value
    }

    const result = await db.transaction(async (tx) => {
      const [order] = await tx.update(orders).set(orderData).where(eq(orders.id, id)).returning()
      if (!order) return null

      if (cart !== undefined) {
        await tx.delete(orderItems).where(eq(orderItems.orderId, id))
        const insertedItems = cart?.length
          ? await tx.insert(orderItems).values(
              cart.map((item: any) => ({
                orderId: id,
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
      }

      const existingItems = await tx.select().from(orderItems).where(eq(orderItems.orderId, id))
      return { ...order, cart: existingItems }
    })

    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(result)
  } catch (error) {
    console.error('PUT /api/orders/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const force = new URL(request.url).searchParams.get('force') === 'true'

    const existingPlans = await db.select({ id: productionPlans.id }).from(productionPlans).where(eq(productionPlans.orderId, id))
    if (existingPlans.length > 0 && !force) {
      return NextResponse.json(
        {
          error: 'This order has active production plans.',
          hasProductionPlans: true,
          planCount: existingPlans.length,
        },
        { status: 409 }
      )
    }

    // production_plans has no FK to orders (orderId is a plain text column), so
    // it won't cascade on its own - clean it up explicitly before the order goes.
    // schedules/order_items do have real FKs with ON DELETE CASCADE, so those
    // clean up automatically once the order row is deleted.
    if (existingPlans.length > 0) {
      await db.delete(productionPlans).where(eq(productionPlans.orderId, id))
    }

    await db.delete(orders).where(eq(orders.id, id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/orders/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 })
  }
}
