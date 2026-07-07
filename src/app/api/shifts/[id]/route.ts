import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { shifts, shiftBreaks } from '@/infrastructure/database/schema'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json()
    const { id, _id, createdAt, updatedAt, breaks, ...updateData } = body
    const { id: paramId } = await params

    const result = await db.transaction(async (tx) => {
      const [shift] = await tx.update(shifts).set(updateData).where(eq(shifts.id, paramId)).returning()
      if (!shift) return null

      await tx.delete(shiftBreaks).where(eq(shiftBreaks.shiftId, paramId))
      const insertedBreaks = breaks?.length
        ? await tx.insert(shiftBreaks).values(
            breaks.map((b: { startTime: string; endTime: string }, i: number) => ({
              shiftId: paramId,
              position: i,
              startTime: b.startTime,
              endTime: b.endTime,
            }))
          ).returning()
        : []

      return { ...shift, breaks: insertedBreaks.map(b => ({ startTime: b.startTime, endTime: b.endTime })) }
    })

    if (!result) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error('PUT /api/shifts/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update shift' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paramId } = await params
    const [row] = await db.delete(shifts).where(eq(shifts.id, paramId)).returning()
    if (!row) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/shifts/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete shift' }, { status: 500 })
  }
}
