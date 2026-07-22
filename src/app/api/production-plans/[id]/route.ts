import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { productionPlans } from '@/infrastructure/database/schema'
import { syncScheduleFromPlans } from '../_schedule-sync'
import { syncInspectionStock } from '../_inspection-stock-sync'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    // Callers commonly spread a previously-fetched plan back as the save payload
    // (production-planning/page.tsx handleSaveDayPlan) - strip system-managed
    // fields so stale/wrong-typed values (id, createdAt/updatedAt as JSON
    // strings) can't crash the timestamp columns or overwrite the id.
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = body
    const updateData: Record<string, any> = { updatedAt: new Date() }
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) updateData[key] = value
    }
    const [existing] = await db.select().from(productionPlans).where(eq(productionPlans.id, id))
    const [plan] = await db.update(productionPlans).set(updateData).where(eq(productionPlans.id, id)).returning()
    if (!plan) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await syncScheduleFromPlans(plan.orderId, plan.date)
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
      await syncScheduleFromPlans(deleted.orderId, deleted.date)
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
