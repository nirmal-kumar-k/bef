import { NextRequest, NextResponse } from 'next/server'
import { asc, eq, sql } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { orders, orderItems, productionPlans, CART_IN_ORDER } from '@/infrastructure/database/schema'
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
      with: { cart: CART_IN_ORDER },
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
      const existingCart = await tx.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(asc(orderItems.position))
      const before = orderSnapshot(locked, existingCart)

      // Plans point at cart lines by position (item_id = `${orderId}-${n}`).
      // A line with plans must keep its position and its product, or those
      // plans silently move to a different product. Quantities and prices
      // may change; lines may be added at the end; unplanned lines removed.
      if (cart !== undefined) {
        const planned = await tx.select({ itemId: productionPlans.itemId }).from(productionPlans).where(eq(productionPlans.orderId, id))
        const usedPositions = [...new Set(planned.map(p => Number(p.itemId.match(/-(\d+)$/)?.[1])).filter(n => Number.isInteger(n)))].sort((a, b) => a - b)
        const incoming: any[] = Array.isArray(cart) ? cart : []
        const broken = usedPositions.filter(n => !incoming[n] || !existingCart[n] || incoming[n].product !== existingCart[n].product)
        if (broken.length > 0) {
          const lines = broken.map(n => `line ${n + 1} (${existingCart[n]?.product ?? 'unknown'})`).join(', ')
          return { cartLocked: `This order has production plans against ${lines}. Those lines can't be removed, moved, or changed to a different product - that would attach their planned quantities to the wrong product. You can still change quantities and prices, add new lines at the end, or remove lines that have no plans.` }
        }
      }

      const [order] = await tx.update(orders)
        .set({ ...orderData, updatedAt: new Date(), version: sql`${orders.version} + 1`, updatedById: actor.id, updatedByName: actor.name })
        .where(eq(orders.id, id)).returning()

      if (cart !== undefined) {
        await tx.delete(orderItems).where(eq(orderItems.orderId, id))
        const insertedItems = cart?.length
          ? await tx.insert(orderItems).values(
              cart.map((item: any, index: number) => ({
                orderId: id,
                // Cart position = the line's place in the submitted list; the
                // guard above guarantees planned lines keep theirs.
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
        await recordAudit(tx, actor, { entityType: 'order', entityId: id, action: 'update', before, after: orderSnapshot(order, insertedItems), version: order.version })
        return { ...order, cart: insertedItems }
      }

      const existingItems = await tx.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(asc(orderItems.position))
      await recordAudit(tx, actor, { entityType: 'order', entityId: id, action: 'update', before, after: orderSnapshot(order, existingItems), version: order.version })
      return { ...order, cart: existingItems }
    })

    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if ('cartLocked' in result && result.cartLocked) {
      return NextResponse.json({ error: result.cartLocked }, { status: 409 })
    }
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
      const before = orderSnapshot(locked, await tx.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(asc(orderItems.position)))
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
