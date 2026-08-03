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
  onDirtyChange: (dirty: boolean) => void
  onSaved: () => Promise<void>
  disabled?: boolean
}

export function TrackingHourlyGrid({ rows, orders, timeSlots, onDirtyChange, onSaved, disabled }: TrackingHourlyGridProps) {
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
      <div className="space-y-3">
        {sortedRows.map(row => {
          const order = orders.find((o: any) => (o.id || o._id) === row.orderId)
          const parts = String(row.itemId).split('-')
          const idx = parseInt(parts[parts.length - 1], 10)
          const productName = order?.cart?.[idx]?.productName || '-'

          return (
            <div key={row.id} className={cn('border border-[#E0E7FF] rounded-xl p-4 bg-white shadow-sm space-y-3', row.isPending && 'bg-red-50 border-red-200')}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">PO No</p>
                    <p className="font-mono text-[#4285F4] font-semibold">{order?.customerOrderNo || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Product</p>
                    <p className="font-semibold text-[#172554]">{productName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Planned</p>
                    <p className="font-mono font-bold text-[#172554]">{row.quantityScheduled}</p>
                  </div>
                </div>
                {row.isPending ? (
                  <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-[10px]">
                    Pending{row.carriedForwardFromDate ? ` (from ${row.carriedForwardFromDate})` : ''}
                  </Badge>
                ) : null}
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {timeSlots.map(slot => (
                  <div key={slot.time} className="flex flex-col items-center gap-1 p-2 rounded-lg border border-[#E0E7FF] bg-[#F8FAFC] aspect-square justify-center">
                    <span className="text-[9.5px] font-semibold text-[#64748B] text-center leading-tight">{slot.time}</span>
                    <Input
                      type="number"
                      min="0"
                      disabled={disabled}
                      value={valueFor(row, slot.time) || ''}
                      onChange={e => handleChange(row.id, slot.time, e.target.value)}
                      className="w-full h-8 text-center text-sm bg-white border-[#E0E7FF] px-1"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!hasEdits || isSaving || disabled} className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white">
          {isSaving ? 'Saving...' : 'Save Actuals'}
        </Button>
      </div>
    </div>
  )
}
