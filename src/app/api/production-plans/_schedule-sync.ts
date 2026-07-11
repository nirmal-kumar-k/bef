import { and, eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { schedules, productionPlans } from '@/infrastructure/database/schema'
import { stageRowsToObject, replaceStages } from '../schedules/_stage-helpers'

// Production Planning only covers these 4 of the 9 Production Tracking stages -
// shotBlasting/grinding/inspection/readyForDispatch/pouring have no planning
// equivalent yet and stay manually entered in Production Tracking.
const PLAN_STAGE_TO_SCHEDULE_STAGE: Record<string, string> = {
  Core: 'core',
  Mould: 'moulding',
  Melt: 'melting',
  Knockout: 'knockout',
}

// Mirrors whatever is scheduled/completed for an order on a date in Production
// Planning into that order+date's Production Tracking schedule, so Tracking never
// needs the same numbers re-entered by hand. Only touches the 4 mapped stages -
// every other stage on the schedule is read back untouched.
export async function syncScheduleFromPlans(orderId: string | undefined | null, date: string | undefined | null) {
  if (!orderId || !date) return

  let schedule: any = await db.query.schedules.findFirst({
    where: and(eq(schedules.orderId, orderId), eq(schedules.date, date)),
    with: { stages: true },
  })

  if (!schedule) {
    const [created] = await db.insert(schedules).values({ orderId, date }).returning()
    schedule = { ...created, stages: [] }
  }

  const stagesObj = stageRowsToObject(schedule.stages)

  for (const [planStage, scheduleStageName] of Object.entries(PLAN_STAGE_TO_SCHEDULE_STAGE)) {
    const rows = await db.select().from(productionPlans).where(
      and(
        eq(productionPlans.orderId, orderId),
        eq(productionPlans.date, date),
        eq(productionPlans.stage, planStage as 'Core' | 'Mould' | 'Melt' | 'Knockout')
      )
    )
    const planned = rows.reduce((sum, r) => sum + (Number(r.quantityScheduled) || 0), 0)
    const completed = rows.reduce((sum, r) => sum + (Number(r.actualQuantity) || 0), 0)

    stagesObj[scheduleStageName] = {
      ...stagesObj[scheduleStageName],
      planned,
      completed,
      pending: Math.max(0, planned - completed),
      variance: completed - planned,
    }
  }

  await db.transaction(async (tx) => {
    await replaceStages(tx, schedule!.id, stagesObj)
  })
}
