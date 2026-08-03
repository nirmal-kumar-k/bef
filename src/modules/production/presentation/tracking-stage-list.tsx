'use client'

import { useState } from 'react'
import { Badge } from '@/shared/ui/badge'
import { Input } from '@/shared/ui/input'
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
  onSaved: () => Promise<void>
  disableActuals?: boolean
}

function actualSumFor(plan: TrackingPlanRow): number {
  if (plan.stage === 'Melt') return Number(plan.actualQuantity) || 0
  return Object.values(plan.hourlyActuals || {}).reduce((s, v) => s + (Number(v) || 0), 0)
}

// Melt's actual is a single field (no hourly breakdown), so it stays
// inline-editable directly in List - Core/Mould/Knockout only ever get
// edited through TrackingDayModal's hourly grid, so the two entry points
// can't disagree about what "the actual" is for the same row.
function MeltActualInput({ plan, onSaved }: { plan: TrackingPlanRow; onSaved: () => Promise<void> }) {
  const [value, setValue] = useState(plan.actualQuantity != null ? String(plan.actualQuantity) : '')
  const [isSaving, setIsSaving] = useState(false)

  const handleBlur = async () => {
    const original = plan.actualQuantity != null ? String(plan.actualQuantity) : ''
    if (value === original) return
    setIsSaving(true)
    try {
      await fetch(`/api/production-plans/${plan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actualQuantity: value === '' ? null : Number(value) }),
      })
      await onSaved()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Input
      type="number"
      min="0"
      value={value}
      disabled={isSaving}
      onChange={e => setValue(e.target.value)}
      onBlur={handleBlur}
      className="w-24 h-8 text-center text-sm bg-white border-[#E0E7FF] mx-auto"
      placeholder="0"
    />
  )
}

export function TrackingStageList({ stage, plans, orders, onSaved, disableActuals }: TrackingStageListProps) {
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
            <th className="px-4 py-3 text-center">{stage === 'Melt' ? 'Actual Quantity' : 'Actual (so far)'}</th>
            <th className="px-4 py-3 text-center">Status</th>
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
                <td className="px-4 py-3 text-center font-mono">
                  {stage === 'Melt' ? (
                    disableActuals ? actual : <MeltActualInput plan={plan} onSaved={onSaved} />
                  ) : actual}
                </td>
                <td className="px-4 py-3 text-center">
                  {plan.isPending ? (
                    <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-[10px]">
                      Pending{plan.carriedForwardFromDate ? ` (from ${plan.carriedForwardFromDate})` : ''}
                    </Badge>
                  ) : (
                    <span className="text-[#94A3B8] text-xs">-</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
