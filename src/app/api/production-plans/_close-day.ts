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
// The shortfall is written straight into quantity_scheduled, an INTEGER
// column, so it must be rounded here: Melt's actualQuantity is numeric and
// routinely fractional (kg), which would otherwise produce a fractional
// shortfall and make Postgres reject the carry-forward insert outright.
// Rounding before the caller's `> 0` filter also stops a sub-1 remainder
// (e.g. 0.4 kg) from creating a pointless carry-forward row of quantity 0.
export function shortfallForRow(row: PlanRow): number {
  if (row.stage === 'Melt') {
    const actual = Number(row.actualQuantity) || 0
    return Math.max(0, Math.round(row.quantityScheduled - actual))
  }
  const actualSum = Object.values(row.hourlyActuals || {}).reduce((s, v) => s + (Number(v) || 0), 0)
  return Math.max(0, Math.round(row.quantityScheduled - actualSum))
}

export function nextDateString(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const utcMs = Date.UTC(year, month - 1, day + 1)
  return new Date(utcMs).toISOString().slice(0, 10)
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
