'use client'

import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { cn } from '@/shared/lib/utils'

export interface TrackingPlanRow {
  id: string
  orderId: string
  itemId: string
  stage: 'Core' | 'Mould' | 'Melt' | 'Knockout'
  date: string
  quantityScheduled: number
  coreBoxCode?: string | null
  hourlyActuals?: Record<string, number> | null
  actualQuantity?: string | number | null
  isPending?: boolean | null
  carriedForwardFromDate?: string | null
  shiftId?: string | null
}

interface TrackingStageListProps {
  stage: 'Core' | 'Mould' | 'Melt' | 'Knockout'
  plans: TrackingPlanRow[]
  orders: any[]
  onEnterActuals: (plan: TrackingPlanRow) => void
}

function actualSumFor(plan: TrackingPlanRow): number {
  if (plan.stage === 'Melt') return Number(plan.actualQuantity) || 0
  return Object.values(plan.hourlyActuals || {}).reduce((s, v) => s + (Number(v) || 0), 0)
}

export function TrackingStageList({ stage, plans, orders, onEnterActuals }: TrackingStageListProps) {
  const rows = plans
    .filter(p => p.stage === stage)
    // Pending (carried-forward) rows surface first so operators clear backlog before new work.
    .sort((a, b) => (b.isPending ? 1 : 0) - (a.isPending ? 1 : 0))

  if (rows.length === 0) {
    return <p className="text-[#94A3B8] text-center py-12 italic">No {stage} plans for this date.</p>
  }

  return (
    <div className="border border-[#E0E7FF] rounded-xl overflow-x-auto shadow-sm">
      <table className="w-full text-sm text-left whitespace-nowrap">
        <thead className="bg-[#F4F6FB] border-b border-[#E0E7FF] text-[#64748B] font-semibold text-xs uppercase tracking-wider">
          <tr>
            <th className="px-4 py-3">PO No</th>
            <th className="px-4 py-3">Product</th>
            {stage === 'Core' && <th className="px-4 py-3">Core Box</th>}
            <th className="px-4 py-3 text-center">Planned</th>
            <th className="px-4 py-3 text-center">Actual (so far)</th>
            <th className="px-4 py-3 text-center">Status</th>
            <th className="px-4 py-3 text-right">Actuals Entry</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E0E7FF]">
          {rows.map(plan => {
            const order = orders.find((o: any) => (o.id || o._id) === plan.orderId)
            const parts = String(plan.itemId).split('-')
            const idx = parseInt(parts[parts.length - 1], 10)
            const productName = order?.cart?.[idx]?.productName || '-'
            const actual = actualSumFor(plan)

            return (
              <tr key={plan.id} className={cn('hover:bg-[#F8FAFC]', plan.isPending && 'bg-red-50')}>
                <td className="px-4 py-3 font-mono text-[#4285F4]">{order?.customerOrderNo || '-'}</td>
                <td className="px-4 py-3 font-semibold text-[#172554]">{productName}</td>
                {stage === 'Core' && <td className="px-4 py-3 font-mono text-indigo-600">{plan.coreBoxCode || '-'}</td>}
                <td className="px-4 py-3 text-center font-mono font-semibold">{plan.quantityScheduled}</td>
                <td className="px-4 py-3 text-center font-mono">{actual}</td>
                <td className="px-4 py-3 text-center">
                  {plan.isPending ? (
                    <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-[10px]">
                      Pending{plan.carriedForwardFromDate ? ` (from ${plan.carriedForwardFromDate})` : ''}
                    </Badge>
                  ) : (
                    <span className="text-[#94A3B8] text-xs">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="outline" onClick={() => onEnterActuals(plan)} className="border-[#E0E7FF] text-[#4F46E5] hover:bg-[#EEF2FF]">
                    Enter Actuals
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
