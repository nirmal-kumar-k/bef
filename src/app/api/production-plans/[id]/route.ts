import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { productionPlans } from '@/infrastructure/database/schema'
import { syncScheduleFromPlans } from '../_schedule-sync'

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
    const [plan] = await db.update(productionPlans).set(updateData).where(eq(productionPlans.id, id)).returning()
    if (!plan) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await syncScheduleFromPlans(plan.orderId, plan.date)
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
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/production-plans/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 })
  }
}
