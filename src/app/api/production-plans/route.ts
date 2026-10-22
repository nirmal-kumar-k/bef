import { NextRequest, NextResponse } from 'next/server'
import { and, asc, eq, gte, lte, type SQL } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { productionPlans, productionPlanStageEnum } from '@/infrastructure/database/schema'
import { parseCreate } from './_plan-payload'

export const dynamic = 'force-dynamic'

const DATE = /^\d{4}-\d{2}-\d{2}$/

// Optional ?from=YYYY-MM-DD&to=YYYY-MM-DD&stage=Core filters (all inclusive,
// backed by the (date, stage) index). With none supplied it still returns
// every plan - Planning's backlog sums every plan ever scheduled per item, so
// it must keep reading the full history and is deliberately left unfiltered.
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const from = params.get('from')
    const to = params.get('to')
    const stage = params.get('stage')
    if ((from && !DATE.test(from)) || (to && !DATE.test(to))) {
      return NextResponse.json({ error: 'from/to must be YYYY-MM-DD' }, { status: 400 })
    }
    const stages = productionPlanStageEnum.enumValues as readonly string[]
    if (stage && !stages.includes(stage)) {
      return NextResponse.json({ error: `stage must be one of: ${stages.join(', ')}` }, { status: 400 })
    }
    const filters: SQL[] = []
    // date is text, but YYYY-MM-DD compares correctly as a string
    if (from) filters.push(gte(productionPlans.date, from))
    if (to) filters.push(lte(productionPlans.date, to))
    if (stage) filters.push(eq(productionPlans.stage, stage as (typeof productionPlanStageEnum.enumValues)[number]))
    const rows = await db.select().from(productionPlans)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(asc(productionPlans.date))
    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET /api/production-plans error:', error)
    return NextResponse.json({ error: 'Failed to fetch production plans' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = parseCreate(body)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const insertData = parsed.data
    const id: string | undefined = typeof body?.id === 'string' && body.id ? body.id : undefined
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
    return NextResponse.json(row, { status: 201 })
  } catch (error) {
    console.error('POST /api/production-plans error:', error)
    return NextResponse.json({ error: 'Failed to create production plan' }, { status: 500 })
  }
}
