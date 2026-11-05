import { NextRequest, NextResponse } from 'next/server'
import { and, asc, eq, gte, lte, sql, type SQL } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { productionPlans, productionPlanStageEnum } from '@/infrastructure/database/schema'
import { currentActor, recordAudit } from '@/infrastructure/audit'
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
    const actor = await currentActor()
    const who = { updatedById: actor.id, updatedByName: actor.name }
    const row = await db.transaction(async (tx) => {
      const [before] = id ? await tx.select().from(productionPlans).where(eq(productionPlans.id, id)) : []
      const [saved] = id
        ? await tx.insert(productionPlans).values({ id, ...insertData, ...who })
            .onConflictDoUpdate({ target: productionPlans.id, set: { ...insertData, ...who, updatedAt: new Date(), version: sql`${productionPlans.version} + 1` } })
            .returning()
        : await tx.insert(productionPlans).values({ ...insertData, ...who }).returning()
      await recordAudit(tx, actor, before
        ? { entityType: 'production_plan', entityId: saved.id, action: 'update', before, after: saved, version: saved.version }
        : { entityType: 'production_plan', entityId: saved.id, action: 'create', after: saved, version: saved.version })
      return saved
    })
    return NextResponse.json(row, { status: 201 })
  } catch (error) {
    console.error('POST /api/production-plans error:', error)
    return NextResponse.json({ error: 'Failed to create production plan' }, { status: 500 })
  }
}
