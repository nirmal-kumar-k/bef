import { NextRequest, NextResponse } from 'next/server'
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
    const { cart, ...orderData } = body

    const result = await db.transaction(async (tx) => {
      const [order] = await tx.insert(orders).values(orderData).returning()

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
