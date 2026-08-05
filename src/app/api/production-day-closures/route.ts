import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { productionDayClosures, productionPlans } from '@/infrastructure/database/schema'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get('date')
    if (!date) return NextResponse.json({ error: 'date query param is required' }, { status: 400 })
    const [row] = await db.select().from(productionDayClosures).where(eq(productionDayClosures.date, date))
    return NextResponse.json({ closed: !!row })
  } catch (error) {
    console.error('GET /api/production-day-closures error:', error)
    return NextResponse.json({ error: 'Failed to fetch closure status' }, { status: 500 })
  }
}

// Reopens a closed day. Closing was previously a one-way door: it locks every
// actuals input for that date, so a mis-click - or simply needing to correct a
// figure after the fact - left no way back at all.
//
// Reopening also has to undo what closing created, or a close/reopen/close
// cycle would stack duplicate carry-forward rows onto tomorrow. Only rows this
// date generated (carriedForwardFromDate = date) are removed, and only while
// nothing has been recorded against them yet - once someone has entered
// actuals on a carried-forward row it represents real work, so it is left
// alone and reported back rather than silently deleted.
export async function DELETE(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get('date')
    if (!date) return NextResponse.json({ error: 'date query param is required' }, { status: 400 })

    const generated = await db
      .select()
      .from(productionPlans)
      .where(and(eq(productionPlans.carriedForwardFromDate, date), eq(productionPlans.isPending, true)))

    const hasActuals = (row: typeof generated[number]) => {
      const hourly = Object.values(row.hourlyActuals || {}).reduce((s, v) => s + (Number(v) || 0), 0)
      return hourly > 0 || (Number(row.actualQuantity) || 0) > 0
    }

    const removable = generated.filter(r => !hasActuals(r))
    const kept = generated.filter(hasActuals)

    for (const row of removable) {
      await db.delete(productionPlans).where(eq(productionPlans.id, row.id))
    }

    await db.delete(productionDayClosures).where(eq(productionDayClosures.date, date))

    return NextResponse.json({
      reopened: true,
      carryForwardsRemoved: removable.length,
      carryForwardsKept: kept.length,
    })
  } catch (error) {
    console.error('DELETE /api/production-day-closures error:', error)
    return NextResponse.json({ error: 'Failed to reopen day' }, { status: 500 })
  }
}
