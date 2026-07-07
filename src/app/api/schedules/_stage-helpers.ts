import { eq } from 'drizzle-orm'
import { scheduleStages } from '@/infrastructure/database/schema'

export const STAGE_DEFAULT_UNITS: Record<string, string> = {
  core: 'cores',
  melting: 'heats',
  moulding: 'moulds',
  pouring: 'moulds',
  knockout: 'pieces',
  shotBlasting: 'pieces',
  grinding: 'pieces',
  inspection: 'pieces',
  readyForDispatch: 'pieces',
}

export const STAGE_NAMES = Object.keys(STAGE_DEFAULT_UNITS)

export function emptyStage(unit: string) {
  return {
    planned: 0, completed: 0, pending: 0, variance: 0, unit,
    rejected: 0, rework: 0, operator: '', remarks: '',
    invoiceNumber: '', vehicleNumber: '', driverName: '',
  }
}

export function defaultStagesObject(): Record<string, ReturnType<typeof emptyStage>> {
  const obj: Record<string, ReturnType<typeof emptyStage>> = {}
  for (const name of STAGE_NAMES) obj[name] = emptyStage(STAGE_DEFAULT_UNITS[name])
  return obj
}

// DB rows (one per stage) -> the { core: {...}, melting: {...}, ... } object the frontend expects
export function stageRowsToObject(rows: any[]) {
  const obj = defaultStagesObject()
  for (const r of rows) {
    const { id, scheduleId, stageName, ...rest } = r
    obj[stageName] = rest
  }
  return obj
}

function stagesObjectToRowValues(scheduleId: string, stagesObj: Record<string, any> | undefined) {
  const src = stagesObj || {}
  return STAGE_NAMES.map(name => {
    const s = src[name] || emptyStage(STAGE_DEFAULT_UNITS[name])
    return {
      scheduleId,
      stageName: name,
      planned: s.planned ?? 0,
      completed: s.completed ?? 0,
      pending: s.pending ?? 0,
      variance: s.variance ?? 0,
      unit: s.unit ?? STAGE_DEFAULT_UNITS[name],
      rejected: s.rejected ?? 0,
      rework: s.rework ?? 0,
      operator: s.operator ?? '',
      remarks: s.remarks ?? '',
      invoiceNumber: s.invoiceNumber ?? '',
      vehicleNumber: s.vehicleNumber ?? '',
      driverName: s.driverName ?? '',
    }
  })
}

// Wipes and re-inserts all 9 stage rows for a schedule; returns the object shape
export async function replaceStages(tx: any, scheduleId: string, stagesObj: Record<string, any> | undefined) {
  await tx.delete(scheduleStages).where(eq(scheduleStages.scheduleId, scheduleId))
  const rows = await tx.insert(scheduleStages).values(stagesObjectToRowValues(scheduleId, stagesObj)).returning()
  return stageRowsToObject(rows)
}
