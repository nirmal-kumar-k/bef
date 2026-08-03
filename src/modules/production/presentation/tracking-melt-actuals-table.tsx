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
      <div className="border border-[#E0E7FF] rounded-xl overflow-x-auto shadow-sm">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-[#F4F6FB] border-b border-[#E0E7FF] text-[#64748B] font-semibold text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">PO No</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3 text-center">Heat No</th>
              <th className="px-4 py-3 text-center">Planned</th>
              <th className="px-4 py-3 text-center">Actual Quantity</th>
              <th className="px-4 py-3 text-center">Status</th>
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
                  <td className="px-4 py-3 font-mono text-[#4285F4]">{order?.customerOrderNo || '-'}</td>
                  <td className="px-4 py-3 font-semibold text-[#172554]">{productName}</td>
                  <td className="px-4 py-3 text-center font-mono">{(row as any).heatNo || '-'}</td>
                  <td className="px-4 py-3 text-center font-mono font-semibold">{row.quantityScheduled}</td>
                  <td className="px-4 py-3 text-center">
                    <Input
                      type="number"
                      min="0"
                      disabled={disabled}
                      value={valueFor(row)}
                      onChange={e => handleChange(row.id, e.target.value)}
                      className="w-28 h-8 text-center text-sm bg-white border-[#E0E7FF] mx-auto"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
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
