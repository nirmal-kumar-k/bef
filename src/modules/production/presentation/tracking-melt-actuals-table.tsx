'use client'

import { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { cn } from '@/shared/lib/utils'
import type { TrackingPlanRow } from './tracking-stage-list'
import { VARIANCE_REASONS } from './variance-reasons'

interface TrackingMeltActualsTableProps {
  rows: TrackingPlanRow[]
  orders: any[]
  onDirtyChange: (dirty: boolean) => void
  onSaved: () => Promise<void>
  disabled?: boolean
}

// A Melt plan row is one pour - one product allocated to a heat - so a heat
// that pours three products is three rows sharing a heatNo. Showing a card
// per row repeated the same heat three times; grouping on heatNo gives one
// card per actual heat, with the products behind a detail popup.
interface HeatGroup {
  key: string
  heatCode: string
  patternCodes: string[]
  rows: TrackingPlanRow[]
  planned: number
  actual: number
  hasPending: boolean
}

function productNameFor(row: TrackingPlanRow, orders: any[]): string {
  const order = orders.find((o: any) => (o.id || o._id) === row.orderId)
  const parts = String(row.itemId).split('-')
  const idx = parseInt(parts[parts.length - 1], 10)
  return order?.cart?.[idx]?.productName || '-'
}

export function TrackingMeltActualsTable({ rows, orders, onDirtyChange, onSaved, disabled }: TrackingMeltActualsTableProps) {
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [reasonEdits, setReasonEdits] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [openHeatKey, setOpenHeatKey] = useState<string | null>(null)

  // Keyed on which rows are shown rather than the array's identity - see the
  // same guard in tracking-hourly-grid: depending on the array meant a parent
  // re-render mid-typing discarded the value being entered.
  const rowsKey = rows.map(r => r.id).join('|')
  useEffect(() => {
    setEdits({})
    setReasonEdits({})
    // The open heat belongs to the rows being replaced, so it cannot survive
    // a switch to a different day/shift - otherwise the popup lingers against
    // a heat that is no longer in view.
    setOpenHeatKey(null)
    onDirtyChange(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsKey])

  const heatGroups = useMemo<HeatGroup[]>(() => {
    const map = new Map<string, HeatGroup>()
    rows.forEach(row => {
      // Rows with no heat code (legacy, saved before heatNo existed) each
      // stand alone rather than collapsing into one nameless bucket.
      const key = row.heatNo || `__row-${row.id}`
      if (!map.has(key)) {
        map.set(key, {
          key,
          heatCode: row.heatNo || 'No heat code',
          patternCodes: [],
          rows: [],
          planned: 0,
          actual: 0,
          hasPending: false,
        })
      }
      const g = map.get(key)!
      g.rows.push(row)
      g.planned += Number(row.quantityScheduled) || 0
      g.actual += Number(row.actualQuantity) || 0
      if (row.isPending) g.hasPending = true
      if (row.patternRef && !g.patternCodes.includes(row.patternRef)) g.patternCodes.push(row.patternRef)
    })
    return Array.from(map.values()).sort((a, b) => {
      if (a.hasPending !== b.hasPending) return a.hasPending ? -1 : 1
      return a.heatCode.localeCompare(b.heatCode)
    })
  }, [rows])

  const valueFor = (row: TrackingPlanRow): string => {
    if (row.id in edits) return edits[row.id]
    return row.actualQuantity != null ? String(row.actualQuantity) : ''
  }

  const handleChange = (rowId: string, value: string) => {
    setEdits(prev => ({ ...prev, [rowId]: value }))
    onDirtyChange(true)
  }

  // closeAfter distinguishes the two save buttons: "Save Actuals" commits and
  // dismisses the heat popup, while "Save & Refresh" commits and stays put
  // with freshly-fetched values - matching Melt Planning's own pairing, so an
  // operator can keep working through one heat without reopening it each time.
  const handleSave = async (closeAfter: boolean) => {
    setIsSaving(true)
    try {
      // A pour is dirty if its actual changed, its shortfall reason changed,
      // or both - de-duplicated so one row is still one PUT.
      const changedRowIds = Array.from(new Set([...Object.keys(edits), ...Object.keys(reasonEdits)]))
      await Promise.all(changedRowIds.map(rowId => {
        const row = rows.find(r => r.id === rowId)
        const actualTotal = rowId in edits
          ? (edits[rowId] === '' ? 0 : Number(edits[rowId]) || 0)
          : (Number(row?.actualQuantity) || 0)
        const stillShort = actualTotal > 0 && actualTotal < (Number(row?.quantityScheduled) || 0)

        const body: Record<string, unknown> = {}
        if (rowId in edits) body.actualQuantity = edits[rowId] === '' ? null : Number(edits[rowId])
        // Same guard as the hourly grid: a pour raised up to plan must not
        // keep an invisible shortfall reason from an earlier save.
        if (!stillShort) body.varianceReason = null
        else if (rowId in reasonEdits) body.varianceReason = reasonEdits[rowId] || null

        return fetch(`/api/production-plans/${rowId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }))
      await onSaved()
      // Cleared explicitly: rowsKey is deliberately unchanged by a save (same
      // rows, new values), so without this the local edits would keep
      // shadowing what actually persisted.
      setEdits({})
      setReasonEdits({})
      onDirtyChange(false)
      if (closeAfter) setOpenHeatKey(null)
    } finally {
      setIsSaving(false)
    }
  }

  const hasEdits = Object.keys(edits).length > 0 || Object.keys(reasonEdits).length > 0

  const reasonFor = (row: TrackingPlanRow): string =>
    row.id in reasonEdits ? reasonEdits[row.id] : (row.varianceReason || '')

  const handleReasonChange = (rowId: string, reason: string) => {
    setReasonEdits(prev => ({ ...prev, [rowId]: reason }))
    onDirtyChange(true)
  }
  const openHeat = heatGroups.find(g => g.key === openHeatKey) || null

  if (rows.length === 0) {
    return <p className="text-[#94A3B8] text-center py-12 italic">No Melt plans for this date.</p>
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {heatGroups.map(g => (
          <button
            key={g.key}
            type="button"
            onClick={() => setOpenHeatKey(g.key)}
            className={cn(
              'border border-[#E0E7FF] rounded-xl p-4 bg-white shadow-sm space-y-3 text-left transition-colors hover:border-[#4F46E5]',
              g.hasPending && 'bg-red-50 border-red-200'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Heat Code</p>
                <p className="font-mono font-bold text-[#172554] text-base">{g.heatCode}</p>
              </div>
              {g.hasPending ? (
                <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-[10px]">Pending</Badge>
              ) : null}
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1">Pattern</p>
              <div className="flex flex-wrap gap-1">
                {g.patternCodes.length > 0 ? g.patternCodes.map(code => (
                  <span key={code} className="font-mono text-xs font-semibold text-[#4F46E5] bg-[#EEF2FF] border border-[#C7D2FE] rounded-md px-2 py-0.5">
                    {code}
                  </span>
                )) : <span className="text-xs text-[#94A3B8]">-</span>}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#E0E7FF]">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Planned (kg)</p>
                <p className="font-mono font-bold text-[#172554]">{g.planned}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Actual (kg)</p>
                <p className="font-mono font-bold text-[#172554]">{g.actual}</p>
              </div>
              <span className="text-[11px] font-semibold text-[#4F46E5]">
                {g.rows.length} product{g.rows.length === 1 ? '' : 's'} &rsaquo;
              </span>
            </div>
          </button>
        ))}
      </div>

      {hasEdits && (
        <div className="flex justify-end">
          <Button onClick={() => handleSave(true)} disabled={isSaving || disabled} className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white">
            {isSaving ? 'Saving...' : 'Save Actuals'}
          </Button>
        </div>
      )}

      <Dialog open={!!openHeat} onOpenChange={(open) => !open && setOpenHeatKey(null)}>
        <DialogContent className="w-full sm:w-[92vw] sm:max-w-[1200px] bg-[#F4F6FB] text-foreground p-0 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
          {openHeat && (
            <>
              <DialogHeader className="p-6 pb-4 pr-14 border-b border-[#E0E7FF] bg-white shrink-0">
                <DialogTitle className="text-xl font-heading text-[#172554]">
                  Heat <span className="font-mono">{openHeat.heatCode}</span>
                </DialogTitle>
                <p className="text-sm text-[#64748B]">
                  {openHeat.rows.length} product{openHeat.rows.length === 1 ? '' : 's'} poured from this heat &middot; {openHeat.planned} kg planned
                </p>
                {/* Moulds are a count and planned/actual are a weight, so the
                    two columns sit side by side in different units. Stating it
                    outright stops the actual being entered as a mould count -
                    which would then be compared against kilograms when the day
                    is closed. */}
                <p className="text-xs text-[#94A3B8] mt-1">
                  Moulds is a count; Planned and Actual are weights in kg (moulds &times; kg per mould).
                </p>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto min-h-0 p-6">
                {/* No whitespace-nowrap: long product names wrap instead of
                    forcing the whole table into a horizontal scroll. */}
                <div className="border border-[#E0E7FF] rounded-xl overflow-hidden shadow-sm bg-white">
                  <table className="w-full text-sm text-left table-fixed">
                    <thead className="bg-[#F4F6FB] border-b border-[#E0E7FF] text-[#64748B] font-semibold text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 w-[14%]">Pattern</th>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3 w-[10%]">PO No</th>
                        <th className="px-4 py-3 text-center w-[8%]">Moulds</th>
                        <th className="px-4 py-3 text-center w-[9%]">Planned<span className="normal-case font-normal text-[#94A3B8]"> (kg)</span></th>
                        <th className="px-4 py-3 text-center w-[13%]">Actual<span className="normal-case font-normal text-[#94A3B8]"> (kg)</span></th>
                        <th className="px-4 py-3 w-[17%]">Shortfall Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E0E7FF]">
                      {openHeat.rows.map(row => {
                        const order = orders.find((o: any) => (o.id || o._id) === row.orderId)
                        return (
                          <tr key={row.id} className={cn('hover:bg-[#F8FAFC]', row.isPending && 'bg-red-50')}>
                            <td className="px-4 py-3 font-mono font-semibold text-[#4F46E5] break-words">{row.patternRef || '-'}</td>
                            <td className="px-4 py-3 font-semibold text-[#172554] break-words">{productNameFor(row, orders)}</td>
                            <td className="px-4 py-3 font-mono text-[#4285F4] break-words">{order?.customerOrderNo || '-'}</td>
                            <td className="px-4 py-3 text-center font-mono">{row.mouldsScheduled ?? '-'}</td>
                            <td className="px-4 py-3 text-center font-mono font-semibold">{row.quantityScheduled}</td>
                            <td className="px-4 py-3 text-center">
                              <Input
                                type="number"
                                min="0"
                                disabled={disabled}
                                value={valueFor(row)}
                                onChange={e => handleChange(row.id, e.target.value)}
                                className="w-28 h-9 text-center text-sm bg-white border-[#E0E7FF] mx-auto [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="0"
                              />
                            </td>
                            <td className="px-4 py-3">
                              {/* Only asked for once the pour is genuinely
                                  short and something has been recorded - a
                                  reason against an untouched row would be
                                  asking why work that hasn't started is late. */}
                              {(() => {
                                const actualNum = Number(valueFor(row)) || 0
                                const isShort = actualNum > 0 && actualNum < (Number(row.quantityScheduled) || 0)
                                if (!isShort) return <span className="text-[#94A3B8] text-xs">-</span>
                                return (
                                  <Select
                                    value={reasonFor(row)}
                                    onValueChange={v => handleReasonChange(row.id, v)}
                                    disabled={disabled}
                                  >
                                    <SelectTrigger
                                      title="Why did this pour fall short of plan?"
                                      className={cn(
                                        'h-8 w-full px-2 text-[11px] font-semibold rounded-md border shadow-none',
                                        reasonFor(row)
                                          ? 'border-amber-200 bg-amber-50 text-amber-700'
                                          : 'border-amber-300 bg-white text-amber-600'
                                      )}
                                    >
                                      <SelectValue placeholder="Select reason">
                                        {(v: string) => v || 'Select reason'}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {VARIANCE_REASONS.map(r => (
                                        <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )
                              })()}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-6 border-t border-[#E0E7FF] bg-white shrink-0 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setOpenHeatKey(null)}>Close</Button>
                <Button
                  variant="outline"
                  onClick={() => handleSave(false)}
                  disabled={!hasEdits || isSaving || disabled}
                  className="border-[#4F46E5] text-[#4F46E5] hover:bg-[#EEF2FF]"
                >
                  {isSaving ? 'Saving...' : 'Save & Refresh'}
                </Button>
                <Button onClick={() => handleSave(true)} disabled={!hasEdits || isSaving || disabled} className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white">
                  {isSaving ? 'Saving...' : 'Save Actuals'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
