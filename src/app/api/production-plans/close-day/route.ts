import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { productionPlans, productionDayClosures } from '@/infrastructure/database/schema'
import { computeCarryForwards, type PlanRow } from '../_close-day'

export async function POST(request: NextRequest) {
  try {
    const { date } = await request.json()
    if (!date) return NextResponse.json({ error: 'date is required' }, { status: 400 })

    const [existingClosure] = await db.select().from(productionDayClosures).where(eq(productionDayClosures.date, date))
    if (existingClosure) {
      return NextResponse.json({ error: 'This date is already closed' }, { status: 409 })
    }

    const rows = await db.select().from(productionPlans).where(
      and(eq(productionPlans.date, date), inArray(productionPlans.stage, ['Core', 'Mould', 'Melt', 'Knockout']))
    )

    const carryForwards = computeCarryForwards(rows as unknown as PlanRow[])

    try {
      await db.transaction(async (tx) => {
        if (carryForwards.length > 0) {
          await tx.insert(productionPlans).values(carryForwards.map(cf => ({
            orderId: cf.orderId,
            itemId: cf.itemId,
            stage: cf.stage,
            date: cf.date,
            quantityScheduled: cf.quantityScheduled,
            coreBoxCode: cf.coreBoxCode || '',
            shiftId: cf.shiftId,
            isPending: true,
            carriedForwardFromDate: cf.carriedForwardFromDate,
          })))
        }

        await tx.insert(productionDayClosures).values({ date })
      })
    } catch (error) {
      // Handle TOCTOU race: two concurrent requests both passed the existingClosure check
      // and tried to insert the same date. The second will hit unique constraint violation.
      if ((error as any).code === '23505') {
        return NextResponse.json({ error: 'This date is already closed' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ closed: true, carriedForward: carryForwards })
  } catch (error) {
    console.error('POST /api/production-plans/close-day error:', error)
    return NextResponse.json({ error: 'Failed to close day' }, { status: 500 })
  }
}
