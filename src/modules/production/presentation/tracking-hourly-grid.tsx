'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { cn } from '@/shared/lib/utils'
import type { TimeSlot } from '@/shared/lib/utils'
import type { TrackingPlanRow } from './tracking-stage-list'
import { VARIANCE_REASONS } from './variance-reasons'

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
// lighter wash of Planning's so the two screens stay distinguishable:
// Planning decides the numbers, Tracking records them.
export function TrackingHourlyGrid({ rows, orders, timeSlots, stage, onDirtyChange, onSaved, disabled }: TrackingHourlyGridProps) {
  const [edits, setEdits] = useState<Record<string, Record<string, number>>>({})
  const [reasonEdits, setReasonEdits] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)

  // Reset local edits whenever the underlying rows change (new shift
  // selected, new date opened, or a save just landed) - edits are always
  // relative to the latest server state, never carried across a shift switch.
  useEffect(() => {
    setEdits({})
    setReasonEdits({})
    onDirtyChange(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  const reasonFor = (row: TrackingPlanRow): string =>
    row.id in reasonEdits ? reasonEdits[row.id] : (row.varianceReason || '')

  const handleReasonChange = (rowId: string, reason: string) => {
    setReasonEdits(prev => ({ ...prev, [rowId]: reason }))
    onDirtyChange(true)
  }

  const valueFor = (row: TrackingPlanRow, slotTime: string): number => {
    const rowEdits = edits[row.id]
    if (rowEdits && slotTime in rowEdits) return rowEdits[slotTime]
    return (row.hourlyActuals || {})[slotTime] || 0
  }

  // EVERY slot in the shift is rendered, including hours nothing was planned
  // in. Reality diverges from the plan constantly - a machine goes down at
  // 11:00 and the work is recovered at 19:00, in a slot that carried a target
  // of zero. Hiding unplanned hours to save width would make that output
  // literally impossible to record, which is exactly backwards for a screen
  // whose job is capturing what actually happened.
  const visibleSlots = timeSlots

  const rowActual = (row: TrackingPlanRow) =>
    timeSlots.reduce((s, slot) => s + valueFor(row, slot.time), 0)

  // Recomputed on every keystroke (edits is a dependency), so the header
  // reflects what is on screen rather than what was last persisted.
  const summary = useMemo(() => {
    let planned = 0
    let actual = 0
    rows.forEach(row => {
      planned += Number(row.quantityScheduled) || 0
      actual += timeSlots.reduce((s, slot) => {
        const e = edits[row.id]
        const v = e && slot.time in e ? e[slot.time] : ((row.hourlyActuals || {})[slot.time] || 0)
        return s + v
      }, 0)
    })
    return { planned, actual, variance: actual - planned }
  }, [rows, edits, timeSlots])

  // Every slot is typed by hand, deliberately. No copy-the-plan shortcut and
  // no pre-filling from hourlyTargets: an actual is a record of what really
  // happened on the floor, and offering one click to accept the plan wholesale
  // invites rubber-stamping it, which would quietly turn this screen's data
  // into a duplicate of Planning's rather than a measurement of reality.
  const handleChange = (rowId: string, slotTime: string, value: string) => {
    const num = Math.max(0, Number(value) || 0)
    setEdits(prev => {
      onDirtyChange(true)
      return { ...prev, [rowId]: { ...prev[rowId], [slotTime]: num } }
    })
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // A row is dirty if its hourly figures changed, its reason changed, or
      // both - keyed as a set so a row touched in both ways is still one PUT.
      const changedRowIds = Array.from(new Set([...Object.keys(edits), ...Object.keys(reasonEdits)]))
      await Promise.all(changedRowIds.map(rowId => {
        const row = rows.find(r => r.id === rowId)
        if (!row) return Promise.resolve()
        const body: Record<string, unknown> = {}
        if (edits[rowId]) body.hourlyActuals = { ...(row.hourlyActuals || {}), ...edits[rowId] }
        if (rowId in reasonEdits) body.varianceReason = reasonEdits[rowId] || null
        return fetch(`/api/production-plans/${rowId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }))
      await onSaved()
    } finally {
      setIsSaving(false)
    }
  }

  const sortedRows = [...rows].sort((a, b) => (b.isPending ? 1 : 0) - (a.isPending ? 1 : 0))
  const hasEdits = Object.keys(edits).length > 0 || Object.keys(reasonEdits).length > 0

  if (rows.length === 0) {
    return <p className="text-[#94A3B8] text-center py-12 italic">No plans for this shift.</p>
  }

  const varianceTone =
    summary.variance === 0 ? 'text-[#64748B]'
      : summary.variance > 0 ? 'text-emerald-600'
        : 'text-amber-600'

  return (
    <div className="space-y-3">
      {/* Live plan-vs-actual summary - the whole shift at a glance, updating
          as values are typed, so nobody has to add up columns by eye. */}
      <div className="rounded-xl border border-[#E8EDFB] bg-white shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#A9B4CC]">Planned</p>
            <p className="text-2xl font-mono font-bold text-[#172554] leading-tight">{summary.planned}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#A9B4CC]">Actual</p>
            <p className="text-2xl font-mono font-bold text-[#4F46E5] leading-tight">{summary.actual}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#A9B4CC]">Variance</p>
            <p className={cn('text-2xl font-mono font-bold leading-tight', varianceTone)}>
              {summary.variance > 0 ? '+' : ''}{summary.variance}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#E8EDFB] bg-white shadow-sm overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[720px] table-fixed text-sm text-left">
            <thead className="bg-[#E8EEF9] border-b border-[#D3DDEF] text-[#3F4E6B] uppercase tracking-wider font-bold text-[12px]">
              <tr>
                <th className="px-3 py-3.5 w-[190px]">{stage === 'Core' ? 'Core Box Details' : 'Item Details'}</th>
                <th className="px-1.5 py-3.5 text-center border-x border-[#D3DDEF] w-[124px]">Quantity Info</th>
                {visibleSlots.map(slot => (
                  <th key={slot.time} className="px-1 py-3.5 text-center border-r border-[#D3DDEF] leading-tight">
                    <div>{slot.time}</div>
                    <div className="text-[10px] font-semibold normal-case text-[#6B7A99] mt-0.5">to {slot.endTime}</div>
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
                const actualSum = rowActual(row)
                const rowVariance = actualSum - (Number(row.quantityScheduled) || 0)

                return (
                  <tr key={row.id} className={cn('hover:bg-[#FBFCFF]', row.isPending && 'bg-red-50/60')}>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-sm text-[#172554] truncate" title={stage === 'Core' ? (row.coreBoxCode || '') : productName}>
                          {stage === 'Core' ? (row.coreBoxCode || '-') : productName}
                        </span>
                        <span className="text-[10px] text-[#94A3B8] truncate" title={`${order?.customerOrderNo || ''} ${productName}`}>
                          {order?.customerOrderNo || '-'}{stage === 'Core' ? ` | ${productName}` : ''}
                        </span>
                        {row.isPending && (
                          <Badge variant="outline" className="mt-1 w-fit bg-red-500/10 text-red-600 border-red-500/20 text-[9px]">
                            Pending{row.carriedForwardFromDate ? ` (from ${row.carriedForwardFromDate})` : ''}
                          </Badge>
                        )}

                        {/* Only surfaces once the row is genuinely behind, and
                            only after something has been recorded - prompting
                            for a reason against an untouched row would just be
                            asking why work that hasn't started yet is late. */}
                        {actualSum > 0 && rowVariance < 0 && (
                          <div className="mt-1.5">
                            <Select
                              value={reasonFor(row)}
                              onValueChange={v => handleReasonChange(row.id, v)}
                              disabled={disabled}
                            >
                              <SelectTrigger
                                title="Why did this fall short of plan?"
                                className={cn(
                                  'h-7 w-full px-2 text-[10px] font-semibold rounded-md border shadow-none',
                                  reasonFor(row)
                                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                                    : 'border-amber-300 bg-white text-amber-600'
                                )}
                              >
                                <SelectValue placeholder="Reason for shortfall">
                                  {(v: string) => v || 'Reason for shortfall'}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {VARIANCE_REASONS.map(r => (
                                  <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-2 py-3 text-center border-x border-[#E8EDFB] bg-[#FBFCFF]">
                      <div className="grid grid-cols-[26px_1fr] gap-1 items-center max-w-[108px] mx-auto">
                        <span className="h-7 flex items-center text-[9px] font-bold text-[#A9B4CC]">PL</span>
                        <div
                          title="Planned - total scheduled for this item today, view only"
                          className="h-7 flex items-center justify-center font-mono font-semibold text-xs px-1 rounded-md border border-[#E8EDFB] bg-white text-[#64748B]"
                        >
                          {row.quantityScheduled}
                        </div>

                        <span className="h-7 flex items-center text-[9px] font-bold text-[#A9B4CC]">AC</span>
                        <div
                          title={`Actual entered so far (${rowVariance > 0 ? '+' : ''}${rowVariance} vs plan)`}
                          className={cn(
                            'h-7 flex items-center justify-center font-mono font-semibold text-xs px-1 rounded-md border',
                            actualSum === 0 ? 'border-[#E8EDFB] bg-white text-[#94A3B8]'
                              : rowVariance < 0 ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          )}
                        >
                          {actualSum}
                        </div>

                      </div>
                    </td>

                    {visibleSlots.map(slot => {
                      const planned = targets[slot.time] || 0
                      const actual = valueFor(row, slot.time)
                      const touched = actual > 0
                      return (
                        <td key={slot.time} className="px-1 py-2 text-center border-r border-[#E8EDFB]">
                          <div className="flex flex-col gap-1 items-center justify-center">
                            {/* Planned target: strictly read-only reference.
                                Planning owns this number; it sits in its own
                                bordered chip so it reads as a fixed target
                                rather than another field you could type into,
                                while staying large enough to actually read. */}
                            <span
                              title={planned > 0 ? `Planned ${planned} this hour` : 'Nothing planned this hour'}
                              className={cn(
                                'w-[62px] mx-auto h-[22px] flex items-center justify-center rounded-md border font-mono text-[12px] font-semibold',
                                planned > 0
                                  ? 'border-[#E2E8F5] bg-[#F4F7FD] text-[#5A6B8C]'
                                  : 'border-transparent bg-transparent text-[#D7DEEC]'
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
                                'w-[62px] mx-auto h-9 text-center font-mono text-sm px-0 transition-all shadow-none',
                                // Number inputs render browser spin buttons that
                                // occupy space on the right, so text-center
                                // lands visibly left of true centre. Suppressing
                                // them is what actually centres the figure.
                                '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
                                'bg-transparent border-transparent hover:border-[#E0E7FF] focus:border-[#4F46E5] focus:bg-white',
                                // Output in an hour with no target is neither
                                // "short" nor "met" - it is unplanned recovery
                                // work, so it gets its own indigo tone rather
                                // than being misread as hitting a target.
                                touched && (planned === 0
                                  ? 'bg-[#EEF2FF] border-[#C7D2FE] text-[#4F46E5] font-semibold'
                                  : actual < planned
                                    ? 'bg-amber-50 border-amber-200 text-amber-700 font-semibold'
                                    : 'bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold')
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
