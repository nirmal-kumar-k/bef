import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { productionPlans } from '@/infrastructure/database/schema'
import { syncInspectionStock } from '../_inspection-stock-sync'
import { parseUpdate } from '../_plan-payload'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // Only whitelisted fields are written; id/createdAt/updatedAt and the
    // modals' row bookkeeping (_id, _isNew) are discarded - see _plan-payload.
    const parsed = parseUpdate(await request.json())
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const updateData: Record<string, any> = { updatedAt: new Date() }
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) updateData[key] = value
    }
    const [existing] = await db.select().from(productionPlans).where(eq(productionPlans.id, id))
    const [plan] = await db.update(productionPlans).set(updateData).where(eq(productionPlans.id, id)).returning()
    if (!plan) return NextResponse.json({ error: 'Not found' }, { status: 404 })
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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const [deleted] = await db.delete(productionPlans).where(eq(productionPlans.id, id)).returning()
    if (deleted) {
      // Undoing a mistaken Inspection batch entirely must reverse the stock
      // it added - the deleted row's own quantity becomes available to
      // inspect fresh again automatically, since it's no longer counted in
      // the "already inspected" sum backlogData computes.
      if (deleted.stage === 'Inspection') await syncInspectionStock(deleted.itemId, deleted.orderId, deleted.quantityScheduled, 0)
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/production-plans/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 })
  }
}
