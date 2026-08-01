import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { shifts, shiftBreaks } from '@/infrastructure/database/schema'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const rows = await db.query.shifts.findMany({
      with: { breaks: true },
      orderBy: (shifts, { asc }) => [asc(shifts.name)],
    })
    const mapped = rows.map(s => ({
      ...s,
      breaks: s.breaks.map(b => ({ startTime: b.startTime, endTime: b.endTime })),
    }))
    return NextResponse.json(mapped)
  } catch (error) {
    console.error('GET /api/shifts error:', error)
    return NextResponse.json({ error: 'Failed to fetch shifts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { breaks, id, ...shiftData } = body

    const result = await db.transaction(async (tx) => {
      // A client-generated id (assigned the moment the shift is created in
      // the UI) makes this idempotent - a double-click or slow-network retry
      // of the same not-yet-confirmed create updates the same row instead
      // of creating a duplicate shift.
      const [shift] = id
        ? await tx.insert(shifts).values({ id, ...shiftData })
            .onConflictDoUpdate({ target: shifts.id, set: shiftData })
            .returning()
        : await tx.insert(shifts).values(shiftData).returning()

      // Same idempotency for the break rows tied to it.
      if (id) {
        await tx.delete(shiftBreaks).where(eq(shiftBreaks.shiftId, shift.id))
      }

      const insertedBreaks = breaks?.length
        ? await tx.insert(shiftBreaks).values(
            breaks.map((b: { startTime: string; endTime: string }, i: number) => ({
              shiftId: shift.id,
              position: i,
              startTime: b.startTime,
              endTime: b.endTime,
            }))
          ).returning()
        : []
      return { ...shift, breaks: insertedBreaks.map(b => ({ startTime: b.startTime, endTime: b.endTime })) }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('POST /api/shifts error:', error)
    return NextResponse.json({ error: 'Failed to create shift' }, { status: 500 })
  }
}
