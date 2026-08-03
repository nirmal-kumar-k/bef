'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { Input } from '@/shared/ui/input'
import { cn } from '@/shared/lib/utils'
import type { TrackingPlanRow } from './tracking-stage-list'

interface TrackingMeltActualsTableProps {
  rows: TrackingPlanRow[]
  orders: any[]
  onDirtyChange: (dirty: boolean) => void
  onSaved: () => Promise<void>
  disabled?: boolean
}

export function TrackingMeltActualsTable({ rows, orders, onDirtyChange, onSaved, disabled }: TrackingMeltActualsTableProps) {
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setEdits({})
    onDirtyChange(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  const valueFor = (row: TrackingPlanRow): string => {
    if (row.id in edits) return edits[row.id]
    return row.actualQuantity != null ? String(row.actualQuantity) : ''
  }

  const handleChange = (rowId: string, value: string) => {
    setEdits(prev => ({ ...prev, [rowId]: value }))
    onDirtyChange(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const changedRowIds = Object.keys(edits)
      await Promise.all(changedRowIds.map(rowId => fetch(`/api/production-plans/${rowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actualQuantity: edits[rowId] === '' ? null : Number(edits[rowId]) }),
      })))
      await onSaved()
    } finally {
      setIsSaving(false)
    }
  }

  const sortedRows = [...rows].sort((a, b) => (b.isPending ? 1 : 0) - (a.isPending ? 1 : 0))
  const hasEdits = Object.keys(edits).length > 0

  if (rows.length === 0) {
    return <p className="text-[#94A3B8] text-center py-12 italic">No Melt plans for this date.</p>
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sortedRows.map(row => {
          const order = orders.find((o: any) => (o.id || o._id) === row.orderId)
          const parts = String(row.itemId).split('-')
          const idx = parseInt(parts[parts.length - 1], 10)
          const productName = order?.cart?.[idx]?.productName || '-'

          return (
            <div key={row.id} className={cn('border border-[#E0E7FF] rounded-xl p-4 bg-white shadow-sm space-y-3', row.isPending && 'bg-red-50 border-red-200')}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">PO No</p>
                  <p className="font-mono text-[#4285F4] font-semibold">{order?.customerOrderNo || '-'}</p>
                </div>
                {row.isPending ? (
                  <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-[10px]">
                    Pending{row.carriedForwardFromDate ? ` (from ${row.carriedForwardFromDate})` : ''}
                  </Badge>
                ) : null}
              </div>

              <div>
                <p className="font-semibold text-[#172554]">{productName}</p>
                <p className="text-xs text-[#64748B] mt-0.5">Heat No: <span className="font-mono">{(row as any).heatNo || '-'}</span></p>
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-[#E0E7FF]">
                <div className="text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Planned</p>
                  <p className="font-mono font-bold text-[#172554]">{row.quantityScheduled}</p>
                </div>
                <div className="flex-1 flex flex-col items-center gap-1 p-2 rounded-lg border border-[#E0E7FF] bg-[#F8FAFC]">
                  <span className="text-[9.5px] font-semibold uppercase tracking-wider text-[#64748B]">Actual Quantity</span>
                  <Input
                    type="number"
                    min="0"
                    disabled={disabled}
                    value={valueFor(row)}
                    onChange={e => handleChange(row.id, e.target.value)}
                    className="w-full h-8 text-center text-sm bg-white border-[#E0E7FF]"
                    placeholder="0"
                  />
                </div>
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
