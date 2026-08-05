'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { Input } from '@/shared/ui/input'
import { cn } from '@/shared/lib/utils'
import type { TimeSlot } from '@/shared/lib/utils'
import type { TrackingPlanRow } from './tracking-stage-list'

interface TrackingHourlyGridProps {
  rows: TrackingPlanRow[]
  orders: any[]
  timeSlots: TimeSlot[]
  stage: TrackingPlanRow['stage']
  onDirtyChange: (dirty: boolean) => void
  onSaved: () => Promise<void>
  disabled?: boolean
}

// Deliberately mirrors Production Planning's own scheduling grid - same
// row-per-item, column-per-hour shape the day was planned in - so the floor
// reads actuals against the plan without re-orienting. The palette is a
// lighter wash of Planning's (softer borders, muted planned figures, only the
// actuals inputs carrying real contrast) so the two screens stay instantly
// distinguishable: Planning is where numbers are decided, Tracking is where
// they are recorded.
export function TrackingHourlyGrid({ rows, orders, timeSlots, stage, onDirtyChange, onSaved, disabled }: TrackingHourlyGridProps) {
  const [edits, setEdits] = useState<Record<string, Record<string, number>>>({})
  const [isSaving, setIsSaving] = useState(false)

  // Reset local edits whenever the underlying rows change (new shift
  // selected, new date opened, or a save just landed) - edits are always
  // relative to the latest server state, never carried across a shift switch.
  useEffect(() => {
    setEdits({})
    onDirtyChange(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  const valueFor = (row: TrackingPlanRow, slotTime: string): number => {
    const rowEdits = edits[row.id]
    if (rowEdits && slotTime in rowEdits) return rowEdits[slotTime]
    return (row.hourlyActuals || {})[slotTime] || 0
  }

  const handleChange = (rowId: string, slotTime: string, value: string) => {
    const num = Math.max(0, Number(value) || 0)
    setEdits(prev => {
      const next = { ...prev, [rowId]: { ...prev[rowId], [slotTime]: num } }
      onDirtyChange(true)
      return next
    })
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const changedRowIds = Object.keys(edits)
      await Promise.all(changedRowIds.map(rowId => {
        const row = rows.find(r => r.id === rowId)
        if (!row) return Promise.resolve()
        const merged = { ...(row.hourlyActuals || {}), ...edits[rowId] }
        return fetch(`/api/production-plans/${rowId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hourlyActuals: merged }),
        })
      }))
      await onSaved()
    } finally {
      setIsSaving(false)
    }
  }

  const sortedRows = [...rows].sort((a, b) => (b.isPending ? 1 : 0) - (a.isPending ? 1 : 0))
  const hasEdits = Object.keys(edits).length > 0

  if (rows.length === 0) {
    return <p className="text-[#94A3B8] text-center py-12 italic">No plans for this shift.</p>
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[#E8EDFB] bg-white shadow-sm overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[900px] table-fixed text-sm text-left">
            <thead className="bg-[#F8FAFF] border-b border-[#E8EDFB] text-[#8494B4] uppercase tracking-wider font-bold text-[11px]">
              <tr>
                <th className="px-3 py-3 w-[170px]">{stage === 'Core' ? 'Core Box Details' : 'Item Details'}</th>
                <th className="px-1.5 py-3 text-center border-x border-[#E8EDFB] w-[110px]">Quantity Info</th>
                {timeSlots.map(slot => (
                  <th key={slot.time} className="px-1 py-3 text-center border-r border-[#E8EDFB] leading-tight">
                    <div>{slot.time}</div>
                    <div className="text-[9px] font-normal normal-case text-[#A9B4CC]">to {slot.endTime}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2FB]">
              {sortedRows.map(row => {
                const order = orders.find((o: any) => (o.id || o._id) === row.orderId)
                const parts = String(row.itemId).split('-')
                const idx = parseInt(parts[parts.length - 1], 10)
                const productName = order?.cart?.[idx]?.productName || '-'
                const targets = row.hourlyTargets || {}
                const actualSum = timeSlots.reduce((s, slot) => s + valueFor(row, slot.time), 0)

                return (
                  <tr key={row.id} className={cn('hover:bg-[#FBFCFF]', row.isPending && 'bg-red-50/60')}>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-sm text-[#172554] truncate">
                          {stage === 'Core' ? (row.coreBoxCode || '-') : productName}
                        </span>
                        <span className="text-[10px] text-[#94A3B8] truncate">
                          {order?.customerOrderNo || '-'}{stage === 'Core' ? ` | ${productName}` : ''}
                        </span>
                        {row.isPending && (
                          <Badge variant="outline" className="mt-1 w-fit bg-red-500/10 text-red-600 border-red-500/20 text-[9px]">
                            Pending{row.carriedForwardFromDate ? ` (from ${row.carriedForwardFromDate})` : ''}
                          </Badge>
                        )}
                      </div>
                    </td>

                    <td className="px-2 py-3 text-center border-x border-[#E8EDFB] bg-[#FBFCFF]">
                      <div className="grid grid-cols-[26px_1fr] gap-1 items-center max-w-[96px] mx-auto">
                        <span className="h-7 flex items-center text-[9px] font-bold text-[#A9B4CC]">PL</span>
                        <div
                          title="Planned - total scheduled for this item today, view only"
                          className="h-7 flex items-center justify-center font-mono font-semibold text-xs px-1 rounded-md border border-[#E8EDFB] bg-white text-[#64748B]"
                        >
                          {row.quantityScheduled}
                        </div>
                        <span className="h-7 flex items-center text-[9px] font-bold text-[#A9B4CC]">AC</span>
                        <div
                          title="Actual - total entered across all hour slots"
                          className={cn(
                            'h-7 flex items-center justify-center font-mono font-semibold text-xs px-1 rounded-md border',
                            actualSum > 0
                              ? 'border-[#C7D2FE] bg-[#EEF2FF] text-[#4F46E5]'
                              : 'border-[#E8EDFB] bg-white text-[#94A3B8]'
                          )}
                        >
                          {actualSum}
                        </div>
                      </div>
                    </td>

                    {timeSlots.map(slot => {
                      const planned = targets[slot.time] || 0
                      const actual = valueFor(row, slot.time)
                      return (
                        <td key={slot.time} className="px-1 py-2 text-center border-r border-[#E8EDFB]">
                          <div className="flex flex-col gap-1 items-center justify-center">
                            {/* Planned target, read-only - Planning owns this number */}
                            <span
                              title="Planned for this hour"
                              className={cn(
                                'text-[10px] font-mono leading-none',
                                planned > 0 ? 'text-[#94A3B8]' : 'text-[#D7DEEC]'
                              )}
                            >
                              {planned > 0 ? planned : '-'}
                            </span>
                            <Input
                              type="number"
                              min="0"
                              disabled={disabled}
                              value={actual || ''}
                              onChange={e => handleChange(row.id, slot.time, e.target.value)}
                              placeholder="-"
                              title="Actual produced this hour"
                              className={cn(
                                'w-full max-w-[52px] mx-auto h-8 text-center font-mono text-xs px-1 transition-all shadow-none',
                                'bg-transparent border-transparent hover:border-[#E0E7FF] focus:border-[#4F46E5] focus:bg-white',
                                actual > 0 && 'bg-[#EEF2FF] border-[#C7D2FE] text-[#4F46E5] font-semibold'
                              )}
                            />
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!hasEdits || isSaving || disabled} className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white">
          {isSaving ? 'Saving...' : 'Save Actuals'}
        </Button>
      </div>
    </div>
  )
}
