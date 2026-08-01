export interface PlanRow {
  id: string
  orderId: string
  itemId: string
  stage: 'Core' | 'Mould' | 'Melt' | 'Knockout'
  date: string
  quantityScheduled: number
  hourlyActuals: Record<string, number> | null
  actualQuantity: string | number | null
  coreBoxCode: string | null
  shiftId: string | null
}

export interface CarryForwardInput {
  orderId: string
  itemId: string
  stage: PlanRow['stage']
  date: string
  quantityScheduled: number
  coreBoxCode: string | null
  shiftId: string | null
  isPending: true
  carriedForwardFromDate: string
}

// Melt tracks actuals via a single actualQuantity per heat-row; Core/Mould/
// Knockout track actuals per hour slot (hourlyActuals), summed and compared
// against quantityScheduled (which already equals sum(hourlyTargets) at save
// time in every planning modal). Only positive shortfalls carry forward -
// overachievement is out of scope (see plan's Global Constraints).
export function shortfallForRow(row: PlanRow): number {
  if (row.stage === 'Melt') {
    const actual = Number(row.actualQuantity) || 0
    return Math.max(0, row.quantityScheduled - actual)
  }
  const actualSum = Object.values(row.hourlyActuals || {}).reduce((s, v) => s + (Number(v) || 0), 0)
  return Math.max(0, row.quantityScheduled - actualSum)
}

export function nextDateString(date: string): string {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function computeCarryForwards(rows: PlanRow[]): CarryForwardInput[] {
  const tomorrow = rows.length > 0 ? nextDateString(rows[0].date) : ''
  return rows
    .map(row => ({ row, shortfall: shortfallForRow(row) }))
    .filter(({ shortfall }) => shortfall > 0)
    .map(({ row, shortfall }) => ({
      orderId: row.orderId,
      itemId: row.itemId,
      stage: row.stage,
      date: tomorrow,
      quantityScheduled: shortfall,
      coreBoxCode: row.coreBoxCode,
      shiftId: row.shiftId,
      isPending: true as const,
      carriedForwardFromDate: row.date,
    }))
}
