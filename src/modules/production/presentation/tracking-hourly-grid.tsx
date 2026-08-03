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
      <div className="border border-[#E0E7FF] rounded-xl overflow-x-auto shadow-sm">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-[#F4F6FB] border-b border-[#E0E7FF] text-[#64748B] font-semibold text-xs uppercase tracking-wider">
            <tr>
              <th className="px-3 py-3">PO No</th>
              <th className="px-3 py-3">Product</th>
              <th className="px-3 py-3 text-center">Planned</th>
              {timeSlots.map(slot => (
                <th key={slot.time} className="px-2 py-3 text-center border-l border-[#E0E7FF]">{slot.time}</th>
              ))}
              <th className="px-3 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E0E7FF]">
            {sortedRows.map(row => {
              const order = orders.find((o: any) => (o.id || o._id) === row.orderId)
              const parts = String(row.itemId).split('-')
              const idx = parseInt(parts[parts.length - 1], 10)
              const productName = order?.cart?.[idx]?.productName || '-'

              return (
                <tr key={row.id} className={cn('hover:bg-[#F8FAFC]', row.isPending && 'bg-red-50')}>
                  <td className="px-3 py-2 font-mono text-[#4285F4]">{order?.customerOrderNo || '-'}</td>
                  <td className="px-3 py-2 font-semibold text-[#172554]">{productName}</td>
                  <td className="px-3 py-2 text-center font-mono font-semibold">{row.quantityScheduled}</td>
                  {timeSlots.map(slot => (
                    <td key={slot.time} className="px-1 py-1.5 border-l border-[#E0E7FF]">
                      <Input
                        type="number"
                        min="0"
                        disabled={disabled}
                        value={valueFor(row, slot.time) || ''}
                        onChange={e => handleChange(row.id, slot.time, e.target.value)}
                        className="w-16 h-8 text-center text-sm bg-white border-[#E0E7FF] mx-auto"
                        placeholder="0"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center">
                    {row.isPending ? (
                      <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-[10px]">
                        Pending{row.carriedForwardFromDate ? ` (from ${row.carriedForwardFromDate})` : ''}
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
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!hasEdits || isSaving || disabled} className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white">
          {isSaving ? 'Saving...' : 'Save Actuals'}
        </Button>
      </div>
    </div>
  )
}
