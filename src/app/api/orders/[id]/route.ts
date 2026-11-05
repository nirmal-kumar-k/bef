import { NextRequest, NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { orders, orderItems, productionPlans } from '@/infrastructure/database/schema'
import { conflictDetails, conflictMessage, currentActor, parseExpectedVersion, recordAudit } from '@/infrastructure/audit'
import { orderSnapshot } from '../_order-snapshot'

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
    // version/updatedBy* are server-managed: version is read as the
    // optimistic-lock check, who-changed-it always comes from the session.
    const { cart, id: _id, createdAt: _createdAt, updatedAt: _updatedAt, version, updatedById: _ubi, updatedByName: _ubn, ...rest } = body
    const expected = parseExpectedVersion(version)
    if (!expected.ok) return NextResponse.json({ error: expected.error }, { status: 400 })
    const orderData: Record<string, any> = {}
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) orderData[key] = value
    }
    const actor = await currentActor()

    const result = await db.transaction(async (tx) => {
      // Row lock, then version check: a concurrent edit of the same order
      // waits here and is refused instead of silently overwriting this one.
      const [locked] = await tx.select().from(orders).where(eq(orders.id, id)).for('update')
      if (!locked) return null
      if (expected.version !== undefined && locked.version !== expected.version) {
        return { conflict: await conflictDetails(tx, 'order', id, expected.version, locked) }
      }
      const before = orderSnapshot(locked, await tx.select().from(orderItems).where(eq(orderItems.orderId, id)))

      const [order] = await tx.update(orders)
        .set({ ...orderData, updatedAt: new Date(), version: sql`${orders.version} + 1`, updatedById: actor.id, updatedByName: actor.name })
        .where(eq(orders.id, id)).returning()

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
        await recordAudit(tx, actor, { entityType: 'order', entityId: id, action: 'update', before, after: orderSnapshot(order, insertedItems), version: order.version })
        return { ...order, cart: insertedItems }
      }

      const existingItems = await tx.select().from(orderItems).where(eq(orderItems.orderId, id))
      await recordAudit(tx, actor, { entityType: 'order', entityId: id, action: 'update', before, after: orderSnapshot(order, existingItems), version: order.version })
      return { ...order, cart: existingItems }
    })

    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if ('conflict' in result && result.conflict) {
      return NextResponse.json({ error: conflictMessage(result.conflict), conflict: result.conflict }, { status: 409 })
    }
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
    const expected = parseExpectedVersion(new URL(request.url).searchParams.get('version'))
    if (!expected.ok) return NextResponse.json({ error: expected.error }, { status: 400 })

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

    // One transaction: the order, its plans and their history rows go
    // together. Plans are deleted explicitly (rather than left to the
    // ON DELETE CASCADE foreign key) so each one gets a history row holding
    // its full contents - a mistaken order delete can then be rebuilt.
    const actor = await currentActor()
    const result = await db.transaction(async (tx) => {
      const [locked] = await tx.select().from(orders).where(eq(orders.id, id)).for('update')
      if (!locked) return { kind: 'gone' as const }
      if (expected.version !== undefined && locked.version !== expected.version) {
        return { kind: 'conflict' as const, conflict: await conflictDetails(tx, 'order', id, expected.version, locked) }
      }
      const before = orderSnapshot(locked, await tx.select().from(orderItems).where(eq(orderItems.orderId, id)))
      const plans = await tx.delete(productionPlans).where(eq(productionPlans.orderId, id)).returning()
      for (const plan of plans) {
        await recordAudit(tx, actor, { entityType: 'production_plan', entityId: plan.id, action: 'delete', before: plan })
      }
      await tx.delete(orders).where(eq(orders.id, id))
      await recordAudit(tx, actor, { entityType: 'order', entityId: id, action: 'delete', before })
      return { kind: 'ok' as const }
    })
    if (result.kind === 'conflict') {
      return NextResponse.json({ error: conflictMessage(result.conflict), conflict: result.conflict }, { status: 409 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/orders/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 })
  }
}
