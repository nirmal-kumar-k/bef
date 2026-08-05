// Shared shape of a production_plans row as Production Tracking consumes it.
// Previously this lived in tracking-stage-list.tsx, which was the List view -
// removed now that every day is opened through the calendar - so the type has
// its own home rather than being anchored to a component.
export interface TrackingPlanRow {
  id: string
  orderId: string
  itemId: string
  stage: 'Core' | 'Mould' | 'Melt' | 'Knockout'
  date: string
  quantityScheduled: number
  coreBoxCode?: string | null
  // The planned per-hour targets Planning wrote. Tracking renders them
  // read-only beside each hour's actuals input, so the grid reads as
  // "planned vs actual" in the same shape Planning laid the day out in.
  hourlyTargets?: Record<string, number> | null
  hourlyActuals?: Record<string, number> | null
  actualQuantity?: string | number | null
  isPending?: boolean | null
  carriedForwardFromDate?: string | null
  shiftId?: string | null
  varianceReason?: string | null
  // Melt-specific. A Melt row is one *pour* (one product allocated to a
  // heat), so several rows can share a heatNo - that's what Tracking's Melt
  // view groups on to show one card per heat rather than one per pour.
  heatNo?: string | null
  patternRef?: string | null
  mouldsScheduled?: number | null
}
