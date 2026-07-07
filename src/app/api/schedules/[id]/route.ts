import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { schedules } from '@/infrastructure/database/schema'
import { stageRowsToObject, replaceStages } from '../_stage-helpers'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { stages, ...updateData } = body

    const result = await db.transaction(async (tx) => {
      const [updated] = Object.keys(updateData).length
        ? await tx.update(schedules).set(updateData).where(eq(schedules.id, id)).returning()
        : await tx.select().from(schedules).where(eq(schedules.id, id))
      if (!updated) return null

      const stagesObj = stages !== undefined
        ? await replaceStages(tx, id, stages)
        : stageRowsToObject(await tx.query.scheduleStages.findMany({ where: (ss: any, { eq }: any) => eq(ss.scheduleId, id) }))

      return { ...updated, stages: stagesObj }
    })

    if (!result) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('PATCH /api/schedules/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.delete(schedules).where(eq(schedules.id, id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/schedules/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 })
  }
}
