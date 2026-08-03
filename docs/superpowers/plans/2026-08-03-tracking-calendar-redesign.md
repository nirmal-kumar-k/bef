# Tracking Calendar-Driven Day Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Production Tracking's calendar match Production Planning's calendar visually, make its day cells clickable to open a new `TrackingDayModal` (stage-tabbed, hourly-grid actuals entry), and simplify List view's actuals column now that the old per-row popup is gone.

**Architecture:** Two new presentational components (`tracking-hourly-grid.tsx` for Core/Mould/Knockout, `tracking-melt-actuals-table.tsx` for Melt) are composed inside a new `tracking-day-modal.tsx` that owns its own Close Day / closure-status logic, opened from a restyled, clickable calendar in `production/page.tsx`. `tracking-stage-list.tsx` (List view) loses its "Enter Actuals" button in favor of a read-only total (Core/Mould/Knockout) or an inline field (Melt). `tracking-actuals-modal.tsx` is deleted.

**Tech Stack:** Next.js App Router, React client components, existing `@/shared/ui` components (Dialog, Select, Button, Input, Label, Badge), `generateTimeSlots`/`toLocalDateString`/`cn` from `@/shared/lib/utils`.

## Global Constraints

- Production Planning (`src/app/production-planning/**`, its modals/tabs) must not be modified by any task in this plan.
- No new API routes or schema changes — reuse `PUT /api/production-plans/[id]`, `POST /api/production-plans/close-day`, `GET /api/production-day-closures`.
- This project has no test runner (no jest/vitest) — verification is `npx tsc --noEmit` plus the manual checks each task specifies.
- Every task must leave `npx tsc --noEmit` clean before its commit.

---

### Task 1: `TrackingHourlyGrid` — Core/Mould/Knockout actuals table

**Files:**
- Create: `src/modules/production/presentation/tracking-hourly-grid.tsx`

**Interfaces:**
- Consumes: `TrackingPlanRow` type from `./tracking-stage-list`, `TimeSlot`/`generateTimeSlots` from `@/shared/lib/utils`.
- Produces: `TrackingHourlyGrid` component — props `{ rows: TrackingPlanRow[], orders: any[], timeSlots: TimeSlot[], onDirtyChange: (dirty: boolean) => void, onSaved: () => Promise<void>, disabled?: boolean }`, consumed by Task 3's `TrackingDayModal`.

- [ ] **Step 1: Write the component**

Create `src/modules/production/presentation/tracking-hourly-grid.tsx`:

```tsx
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/production/presentation/tracking-hourly-grid.tsx
git commit -m "feat: add hourly-grid actuals table for Tracking's day modal"
```

---

### Task 2: `TrackingMeltActualsTable` — Melt per-heat actuals table

**Files:**
- Create: `src/modules/production/presentation/tracking-melt-actuals-table.tsx`

**Interfaces:**
- Consumes: `TrackingPlanRow` type from `./tracking-stage-list`.
- Produces: `TrackingMeltActualsTable` component — props `{ rows: TrackingPlanRow[], orders: any[], onDirtyChange: (dirty: boolean) => void, onSaved: () => Promise<void>, disabled?: boolean }`, consumed by Task 3's `TrackingDayModal`.

- [ ] **Step 1: Write the component**

Create `src/modules/production/presentation/tracking-melt-actuals-table.tsx`:

```tsx
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/production/presentation/tracking-melt-actuals-table.tsx
git commit -m "feat: add Melt per-heat actuals table for Tracking's day modal"
```

---

### Task 3: `TrackingDayModal` — stage tabs, shift selector, Close Day

**Files:**
- Create: `src/modules/production/presentation/tracking-day-modal.tsx`

**Interfaces:**
- Consumes: `TrackingHourlyGrid` (Task 1), `TrackingMeltActualsTable` (Task 2), `TrackingPlanRow` from `./tracking-stage-list`.
- Produces: `TrackingDayModal` component — props `{ date: string | null, plans: TrackingPlanRow[], orders: any[], shifts: any[], onClose: () => void, onSaved: () => Promise<void> }`, consumed by Task 4's `production/page.tsx`.

- [ ] **Step 1: Write the component**

Create `src/modules/production/presentation/tracking-day-modal.tsx`:

```tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { cn, generateTimeSlots } from '@/shared/lib/utils'
import { TrackingHourlyGrid } from './tracking-hourly-grid'
import { TrackingMeltActualsTable } from './tracking-melt-actuals-table'
import type { TrackingPlanRow } from './tracking-stage-list'

const STAGES: TrackingPlanRow['stage'][] = ['Core', 'Mould', 'Melt', 'Knockout']

interface TrackingDayModalProps {
  date: string | null
  plans: TrackingPlanRow[]
  orders: any[]
  shifts: any[]
  onClose: () => void
  onSaved: () => Promise<void>
}

export function TrackingDayModal({ date, plans, orders, shifts, onClose, onSaved }: TrackingDayModalProps) {
  const [activeStage, setActiveStage] = useState<TrackingPlanRow['stage']>('Core')
  const [selectedShiftId, setSelectedShiftId] = useState<string>('')
  const [isDirty, setIsDirty] = useState(false)
  const [isClosed, setIsClosed] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    if (!date) return
    setActiveStage('Core')
    setSelectedShiftId(shifts[0]?.id || '')
    fetch(`/api/production-day-closures?date=${date}`)
      .then(res => res.ok ? res.json() : { closed: false })
      .then(data => setIsClosed(!!data.closed))
      .catch(() => setIsClosed(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  const dayPlans = useMemo(() => plans.filter(p => p.date === date), [plans, date])
  const stageRows = useMemo(() => dayPlans.filter(p => p.stage === activeStage), [dayPlans, activeStage])

  const selectedShift = shifts.find((s: any) => s.id === selectedShiftId)
  const timeSlots = selectedShift ? generateTimeSlots(selectedShift.startTime, selectedShift.endTime, selectedShift.breaks || []) : []

  // Rows saved before shiftId existed carry no value at all - shown under
  // any shift, same convention Planning's own modals use.
  const shiftFilteredRows = stageRows.filter(r => !r.shiftId || r.shiftId === selectedShiftId)

  const handleClose = () => {
    if (isDirty && !confirm('You have unsaved actuals. Discard and close?')) return
    onClose()
  }

  const handleCloseDay = async () => {
    if (!date) return
    if (!confirm(`Close ${date}? This carries forward any shortfall to tomorrow and locks further edits for this date.`)) return
    setIsClosing(true)
    try {
      const res = await fetch('/api/production-plans/close-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      })
      if (res.ok) {
        const data = await res.json()
        alert(`Day closed. ${data.carriedForward.length} item(s) carried forward to tomorrow.`)
        setIsClosed(true)
        await onSaved()
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to close day')
      }
    } finally {
      setIsClosing(false)
    }
  }

  if (!date) return null

  return (
    <Dialog open={!!date} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="w-full h-full max-w-full rounded-none sm:w-[95vw] sm:max-w-[1200px] sm:h-[90vh] sm:rounded-2xl bg-[#F4F6FB] text-foreground p-0 shadow-2xl flex flex-col overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-[#E0E7FF] bg-white shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <DialogTitle className="text-xl font-heading text-[#172554]">{date}</DialogTitle>
            <Button onClick={handleCloseDay} disabled={isClosed || isClosing} className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white">
              {isClosed ? 'Day Closed' : isClosing ? 'Closing...' : 'Close Day'}
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4">
          <div className="flex w-full max-w-xl bg-white p-1.5 rounded-full shadow-sm border border-[#D8DEE9]">
            {STAGES.map(stage => (
              <button
                key={stage}
                onClick={() => setActiveStage(stage)}
                className={cn(
                  'flex-1 px-3 py-2 text-sm font-bold text-center transition-all duration-300 rounded-full',
                  activeStage === stage ? 'bg-[#4F46E5] text-white shadow-md' : 'text-[#64748B] hover:text-[#4F46E5]'
                )}
              >
                {stage}
              </button>
            ))}
          </div>

          {activeStage === 'Melt' ? (
            <TrackingMeltActualsTable
              rows={stageRows}
              orders={orders}
              onDirtyChange={setIsDirty}
              onSaved={onSaved}
              disabled={isClosed}
            />
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">Shift:</span>
                {shifts.length > 0 && (
                  <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                    <SelectTrigger className="h-9 px-4 text-sm font-semibold rounded-lg border border-[#E0E7FF] bg-white shadow-sm">
                      <SelectValue placeholder="Select Shift">
                        {(id: string) => {
                          const s = shifts.find((sh: any) => sh.id === id)
                          return s ? `${s.name} (${s.startTime} - ${s.endTime})` : 'Select Shift'
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {shifts.map((s: any) => (
                        <SelectItem key={s.id} value={s.id!} className="text-sm">
                          {s.name} ({s.startTime} - {s.endTime})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <TrackingHourlyGrid
                rows={shiftFilteredRows}
                orders={orders}
                timeSlots={timeSlots}
                onDirtyChange={setIsDirty}
                onSaved={onSaved}
                disabled={isClosed}
              />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/production/presentation/tracking-day-modal.tsx
git commit -m "feat: add TrackingDayModal with stage tabs, shift selector, Close Day"
```

---

### Task 4: Wire `TrackingDayModal` into the page; restyle calendar to match Planning

**Files:**
- Modify: `src/app/production/page.tsx`

**Interfaces:**
- Consumes: `TrackingDayModal` (Task 3).
- Produces: clickable, Planning-styled calendar cells; removes the "Back to Calendar" link added in an earlier session (no longer needed - Calendar-day clicks open a modal instead of navigating to List).

- [ ] **Step 1: Replace the calendar cell markup and add Knockout tracking to `trackingByDate`**

In `src/app/production/page.tsx`, the `trackingByDate` memo already aggregates all four stages (see existing code) - no change needed there. Replace the calendar cell rendering (the `<button>` inside `calendarDays.map`) to match Planning's dot-row style. Replace this block:

```tsx
                <button
                  key={i}
                  onClick={() => { setDateFilter(dateStr); setSummaryView('list') }}
                  className="min-h-[110px] bg-white p-2 rounded-[12px] border border-[#E0E7FF] flex flex-col gap-1 text-left hover:border-[#4F46E5] transition-colors"
                >
                  <span className={cn('text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full self-end', isToday ? 'bg-[#4F46E5] text-white' : 'text-[#64748B]')}>
                    {date.getDate()}
                  </span>
                  {STAGES.map(stage => counts?.[stage]?.planned ? (
                    <div key={stage} className="flex items-center justify-between px-1 text-[10.5px]">
                      <span className="text-[#64748B]">{stage}</span>
                      <span className="font-bold text-[#0F172A]">{counts[stage].actual} / {counts[stage].planned}</span>
                    </div>
                  ) : null)}
                </button>
```

with:

```tsx
                <button
                  key={i}
                  onClick={() => setOpenDayModalDate(dateStr)}
                  className="min-h-[130px] bg-white p-2 rounded-[12px] border border-[#E0E7FF] flex flex-col gap-1 text-left hover:border-[#4F46E5] transition-colors"
                >
                  <div className="flex justify-end w-full">
                    <span className={cn('text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full', isToday ? 'bg-[#4F46E5] text-white' : 'text-[#64748B]')}>
                      {date.getDate()}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 mt-1">
                    {STAGE_DOTS.map(({ stage, color }) => counts?.[stage]?.planned ? (
                      <div key={stage} className="flex items-center justify-between px-1.5 py-0.5 rounded-md">
                        <div className="flex items-center gap-1.5">
                          <div className={cn('w-1.5 h-1.5 rounded-full', color)} />
                          <span className="text-[10.5px] font-medium text-[#64748B]">{stage}</span>
                        </div>
                        <span className="text-[10.5px] font-bold text-[#0F172A]">
                          {counts[stage].actual} <span className="text-[#94A3B8] font-normal mx-0.5">/</span> {counts[stage].planned}
                        </span>
                      </div>
                    ) : null)}
                  </div>
                </button>
```

- [ ] **Step 2: Add the `STAGE_DOTS` constant**

Add near the top of the file, after the `STAGES` constant:

```tsx
const STAGE_DOTS: { stage: TrackingPlanRow['stage']; color: string }[] = [
  { stage: 'Core', color: 'bg-yellow-400' },
  { stage: 'Mould', color: 'bg-[#4F46E5]' },
  { stage: 'Melt', color: 'bg-orange-400' },
  { stage: 'Knockout', color: 'bg-emerald-400' },
]
```

- [ ] **Step 3: Add `openDayModalDate` state and render `TrackingDayModal`**

Add state near the other `useState` calls: `const [openDayModalDate, setOpenDayModalDate] = useState<string | null>(null)`

Add the import: `import { TrackingDayModal } from '@/modules/production/presentation/tracking-day-modal'`

Add before the closing `</div>` of the component's return (alongside the existing `<TrackingActualsModal .../>`, which Task 6 will remove):

```tsx
      <TrackingDayModal
        date={openDayModalDate}
        plans={plans}
        orders={orders}
        shifts={shifts}
        onClose={() => setOpenDayModalDate(null)}
        onSaved={fetchData}
      />
```

- [ ] **Step 4: Remove the "Back to Calendar" link**

Remove this block (added in an earlier session, no longer needed since Calendar no longer navigates into List):

```tsx
          <button
            onClick={() => setSummaryView('calendar')}
            className="flex items-center gap-1.5 text-sm font-semibold text-[#4F46E5] hover:text-[#4338CA]"
          >
            <CaretLeft className="w-4 h-4" />
            Back to Calendar
          </button>

```

Remove the now-unused `CaretLeft` import (`import { CaretLeft } from '@phosphor-icons/react'`) if nothing else in the file uses it.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual check**

Run the dev server, visit `/production`, switch to Calendar, confirm cells now show colored dots for all 4 stages (matching Planning's calendar look, with an extra emerald dot for Knockout), and clicking any day (with or without plans) opens `TrackingDayModal` without navigating the page or changing the Calendar/List toggle state.

- [ ] **Step 7: Commit**

```bash
git add src/app/production/page.tsx
git commit -m "feat: restyle Tracking calendar to match Planning, make days clickable to open TrackingDayModal"
```

---

### Task 5: Simplify List view's actuals column

**Files:**
- Modify: `src/modules/production/presentation/tracking-stage-list.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `TrackingStageList` no longer takes `onEnterActuals`/`disableActuals` props; Core/Mould/Knockout show a read-only total, Melt shows an inline-editable field that saves via `PUT /api/production-plans/[id]`.

- [ ] **Step 1: Replace the "Actuals Entry" column with a read-only total / inline Melt field**

Replace the full contents of `src/modules/production/presentation/tracking-stage-list.tsx`:

```tsx
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
```

- [ ] **Step 2: Update the caller in `production/page.tsx`**

In `src/app/production/page.tsx`, change:

```tsx
            <TrackingStageList
              stage={activeStage}
              plans={dayPlans}
              orders={orders}
              onEnterActuals={isClosed ? () => {} : setActualsPlan}
              disableActuals={isClosed}
            />
```

to:

```tsx
            <TrackingStageList
              stage={activeStage}
              plans={dayPlans}
              orders={orders}
              onSaved={fetchData}
              disableActuals={isClosed}
            />
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (`TrackingActualsModal` and `actualsPlan` are still present in `production/page.tsx` at this point and still valid - Task 6 is what removes them.)

- [ ] **Step 4: Commit**

```bash
git add src/modules/production/presentation/tracking-stage-list.tsx src/app/production/page.tsx
git commit -m "feat: replace List's Enter Actuals popup with read-only totals + inline Melt field"
```

---

### Task 6: Delete the old per-row actuals popup

**Files:**
- Delete: `src/modules/production/presentation/tracking-actuals-modal.tsx`
- Modify: `src/app/production/page.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: a codebase with zero references to `TrackingActualsModal`.

- [ ] **Step 1: Delete the file**

```bash
rm src/modules/production/presentation/tracking-actuals-modal.tsx
```

- [ ] **Step 2: Remove its usage from `production/page.tsx`**

Remove the import: `import { TrackingActualsModal } from '@/modules/production/presentation/tracking-actuals-modal'`

Remove the state: `const [actualsPlan, setActualsPlan] = useState<TrackingPlanRow | null>(null)` (if not already removed by Task 5's edits).

Remove the rendered block:

```tsx
      <TrackingActualsModal
        plan={actualsPlan}
        shifts={shifts}
        onClose={() => setActualsPlan(null)}
        onSaved={fetchData}
      />
```

- [ ] **Step 3: Grep for any remaining reference**

Run: `grep -rn "TrackingActualsModal\|actualsPlan" src --include="*.ts" --include="*.tsx"`
Expected: no output.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove old per-row Tracking actuals popup, superseded by TrackingDayModal"
```

---

### Task 7: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 2: Grep for dead references**

Run: `grep -rn "TrackingActualsModal\|onEnterActuals" src --include="*.ts" --include="*.tsx"`
Expected: no output.

- [ ] **Step 3: Confirm Production Planning is untouched**

Run: `git diff master --stat -- src/app/production-planning src/modules/production/presentation/core-planning-modal.tsx src/modules/production/presentation/mould-planning-modal.tsx src/modules/production/presentation/melt-planning-modal.tsx src/modules/production/presentation/knockout-planning-modal.tsx src/modules/production/presentation/pour-planning-tab.tsx src/modules/production/presentation/inspection-tab.tsx`
Expected: no output.

- [ ] **Step 4: Manual end-to-end walkthrough**

1. `/production`, Calendar view: confirm dot-row styling matches Planning's calendar (plus the Knockout dot), and every day cell is clickable.
2. Click a day with existing Core plans: `TrackingDayModal` opens, Core tab active, shift selector shows the day's shift(s), hourly grid shows planned/actual per hour.
3. Enter actuals in a few hour cells, click "Save Actuals," confirm the grid reflects the save and the underlying calendar cell's `done/planned` count updates after closing the modal.
4. Switch to the Melt tab, enter an actual quantity for a heat row, save, confirm it persists.
5. Click "Close Day," confirm the carry-forward alert and that the modal now shows "Day Closed" with editing disabled.
6. Close the modal, switch to List view, confirm Core/Mould/Knockout show read-only totals (no button) and Melt shows an inline-editable field that saves on blur.
7. Confirm `/production-planning` is unaffected — same Core plan, same quantity, no behavior changes there.

- [ ] **Step 5: Report results to the user**

Summarize what was built and verified, and ask whether to push through the branch flow.
