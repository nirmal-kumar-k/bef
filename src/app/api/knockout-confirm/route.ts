import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray, ne, or } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { productionPlans, orders, products } from '@/infrastructure/database/schema'

export async function POST(request: NextRequest) {
  try {
    const { planIds } = await request.json()

    if (!planIds || !Array.isArray(planIds) || planIds.length === 0) {
      return NextResponse.json({ error: 'No plan IDs provided' }, { status: 400 })
    }

    const plans = await db.select().from(productionPlans).where(
      and(
        inArray(productionPlans.id, planIds),
        eq(productionPlans.stage, 'Knockout'),
        ne(productionPlans.isConfirmed, true)
      )
    )

    let processed = 0
    await db.transaction(async (tx) => {
      for (const plan of plans) {
        if (!plan.actualQuantity || Number(plan.actualQuantity) <= 0) continue

        const order = await tx.query.orders.findFirst({
          where: eq(orders.id, plan.orderId),
          with: { cart: true },
        })
        if (!order || !order.cart) continue

        const parts = plan.itemId.split('-')
        const idx = parseInt(parts[parts.length - 1], 10)
        const cartItem = order.cart[idx]
        if (!cartItem) continue

        const productName = cartItem.productName
        const productCode = cartItem.product

        const [product] = await tx.select().from(products).where(
          or(eq(products.name, productName), eq(products.code, productCode))
        ).limit(1)

        if (product) {
          const cavities = product.cavities || 1
          const piecesToGenerate = Number(plan.actualQuantity) * cavities

          await tx.update(products).set({ stock: (product.stock || 0) + piecesToGenerate }).where(eq(products.id, product.id))
          await tx.update(productionPlans).set({ isConfirmed: true }).where(eq(productionPlans.id, plan.id))
          processed++
        }
      }
    })

    return NextResponse.json({ success: true, message: `Generated products for ${processed} knockout plans.` })
  } catch (error) {
    console.error('POST /api/knockout-confirm error:', error)
    return NextResponse.json({ error: 'Failed to confirm knockout' }, { status: 500 })
  }
}