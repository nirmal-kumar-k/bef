import { NextRequest, NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { productionPlans } from '@/infrastructure/database/schema'
import { conflictDetails, conflictMessage, currentActor, parseExpectedVersion, recordAudit } from '@/infrastructure/audit'
import { syncInspectionStock } from '../_inspection-stock-sync'
import { parseUpdate } from '../_plan-payload'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    // Only whitelisted fields are written; id/createdAt/updatedAt and the
    // modals' row bookkeeping (_id, _isNew) are discarded - see _plan-payload.
    const parsed = parseUpdate(body)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    // The version the caller loaded. Sent -> refuse if someone saved since.
    // Not sent (older caller) -> no check, exactly the previous behaviour.
    const expected = parseExpectedVersion(body?.version)
    if (!expected.ok) return NextResponse.json({ error: expected.error }, { status: 400 })

    const updateData: Record<string, any> = { updatedAt: new Date() }
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) updateData[key] = value
    }
    const actor = await currentActor()

    const result = await db.transaction(async (tx) => {
      // Row lock: a concurrent save of the same plan waits here, then sees
      // this one's new version and gets the 409 below.
      const [existing] = await tx.select().from(productionPlans).where(eq(productionPlans.id, id)).for('update')
      if (!existing) return { kind: 'notFound' as const }
      if (expected.version !== undefined && existing.version !== expected.version) {
        return { kind: 'conflict' as const, conflict: await conflictDetails(tx, 'production_plan', id, expected.version, existing) }
      }
      const [plan] = await tx.update(productionPlans)
        .set({ ...updateData, version: sql`${productionPlans.version} + 1`, updatedById: actor.id, updatedByName: actor.name })
        .where(eq(productionPlans.id, id)).returning()
      await recordAudit(tx, actor, { entityType: 'production_plan', entityId: id, action: 'update', before: existing, after: plan, version: plan.version })
      return { kind: 'ok' as const, plan, existing }
    })

    if (result.kind === 'notFound') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (result.kind === 'conflict') {
      return NextResponse.json({ error: conflictMessage(result.conflict), conflict: result.conflict }, { status: 409 })
    }
    const { plan, existing } = result
    // Correcting a past Inspection batch's accepted quantity (e.g. fixing a
    // mistyped rejected count) must adjust product.stock by the difference -
    // that stock was already incremented once when the batch was submitted.
    if (plan.stage === 'Inspection') await syncInspectionStock(plan.itemId, plan.orderId, existing?.quantityScheduled || 0, plan.quantityScheduled)
    return NextResponse.json(plan)
  } catch (error) {
    console.error('PUT /api/production-plans/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // Optional ?version= - same rule as PUT: deleting a row someone else has
    // changed since you loaded it is refused rather than done blind.
    const expected = parseExpectedVersion(request.nextUrl.searchParams.get('version'))
    if (!expected.ok) return NextResponse.json({ error: expected.error }, { status: 400 })
    const actor = await currentActor()

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(productionPlans).where(eq(productionPlans.id, id)).for('update')
      if (!existing) return { kind: 'gone' as const }
      if (expected.version !== undefined && existing.version !== expected.version) {
        return { kind: 'conflict' as const, conflict: await conflictDetails(tx, 'production_plan', id, expected.version, existing) }
      }
      const [deleted] = await tx.delete(productionPlans).where(eq(productionPlans.id, id)).returning()
      await recordAudit(tx, actor, { entityType: 'production_plan', entityId: id, action: 'delete', before: deleted })
      return { kind: 'ok' as const, deleted }
    })

    if (result.kind === 'conflict') {
      return NextResponse.json({ error: conflictMessage(result.conflict), conflict: result.conflict }, { status: 409 })
    }
    if (result.kind === 'ok') {
      const { deleted } = result
      // Undoing a mistaken Inspection batch entirely must reverse the stock
      // it added - the deleted row's own quantity becomes available to
      // inspect fresh again automatically, since it's no longer counted in
      // the "already inspected" sum backlogData computes.
      if (deleted.stage === 'Inspection') await syncInspectionStock(deleted.itemId, deleted.orderId, deleted.quantityScheduled, 0)
    }
    // Deleting a row that is already gone stays a success, as before.
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/production-plans/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 })
  }
}
