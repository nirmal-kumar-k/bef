import { NextRequest, NextResponse } from 'next/server'
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
    const { breaks, ...shiftData } = body

    const result = await db.transaction(async (tx) => {
      const [shift] = await tx.insert(shifts).values(shiftData).returning()
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
