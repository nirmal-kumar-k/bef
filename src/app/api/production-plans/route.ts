import { NextRequest, NextResponse } from 'next/server'
import { asc } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { productionPlans } from '@/infrastructure/database/schema'
import { syncScheduleFromPlans } from './_schedule-sync'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const rows = await db.select().from(productionPlans).orderBy(asc(productionPlans.date))
    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET /api/production-plans error:', error)
    return NextResponse.json({ error: 'Failed to fetch production plans' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, createdAt: _createdAt, updatedAt: _updatedAt, ...insertData } = body
    // A client-generated id (assigned the moment a row is added in the UI,
    // before it's ever round-tripped to the server) makes this insert
    // idempotent: if the same not-yet-confirmed row gets submitted twice -
    // e.g. a double-click on Save before the first response updates local
    // state to reflect "this row now exists" - the second attempt safely
    // updates the same row instead of creating a duplicate. Callers that
    // don't supply an id fall back to the column's defaultRandom(), exactly
    // as before.
    const [row] = id
      ? await db.insert(productionPlans).values({ id, ...insertData })
          .onConflictDoUpdate({ target: productionPlans.id, set: insertData })
          .returning()
      : await db.insert(productionPlans).values(insertData).returning()
    await syncScheduleFromPlans(row.orderId, row.date)
    return NextResponse.json(row, { status: 201 })
  } catch (error) {
    console.error('POST /api/production-plans error:', error)
    return NextResponse.json({ error: 'Failed to create production plan' }, { status: 500 })
  }
}
