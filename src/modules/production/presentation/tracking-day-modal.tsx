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
import { ConfirmDialog, type ConfirmDialogState } from '@/shared/ui/confirm-dialog'
import { Lock } from '@phosphor-icons/react'
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
  const [dialog, setDialog] = useState<ConfirmDialogState | null>(null)

  // This component is never unmounted - the page renders it permanently and it
  // returns null while `date` is null - so every piece of state here survives
  // from one opening to the next and MUST be reset explicitly. Without this,
  // typing in one day then discard-closing left isDirty true, so the next day
  // opened warned about unsaved changes that did not exist; isClosed likewise
  // carried over and briefly showed a locked banner on an open day.
  useEffect(() => {
    if (!date) return
    setActiveStage('Core')
    setSelectedShiftId(shifts[0]?.id || '')
    setIsDirty(false)
    setDialog(null)
    // Cleared before the lookup, not left at the previous day's value, so a
    // stale "this day is closed" state can never flash on a different date.
    setIsClosed(false)
    let cancelled = false
    fetch(`/api/production-day-closures?date=${date}`)
      .then(res => res.ok ? res.json() : { closed: false })
      .then(data => { if (!cancelled) setIsClosed(!!data.closed) })
      .catch(() => { if (!cancelled) setIsClosed(false) })
    // Guards against a slow response for a previously-viewed date landing
    // after the user has already switched to another one.
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  // Shifts are fetched by the page in parallel with everything else, so a
  // modal opened before that request lands would otherwise keep an empty
  // shift selection for its whole lifetime - leaving the grid with no time
  // columns at all and no way to recover short of reopening.
  useEffect(() => {
    if (!selectedShiftId && shifts.length > 0) setSelectedShiftId(shifts[0].id)
  }, [shifts, selectedShiftId])

  const dayPlans = useMemo(() => plans.filter(p => p.date === date), [plans, date])
  const stageRows = useMemo(() => dayPlans.filter(p => p.stage === activeStage), [dayPlans, activeStage])

  const selectedShift = shifts.find((s: any) => s.id === selectedShiftId)
  // Memoized for the same reason as shiftFilteredRows below: it is a prop the
  // grid feeds into its own useMemo dependencies, so a fresh array each render
  // makes that work churn on every keystroke.
  const timeSlots = useMemo(
    () => selectedShift ? generateTimeSlots(selectedShift.startTime, selectedShift.endTime, selectedShift.breaks || []) : [],
    [selectedShift]
  )

  // Rows saved before shiftId existed carry no value at all - shown under
  // any shift, same convention Planning's own modals use.
  // MUST be memoized. The grid resets its in-progress edits whenever this
  // array's identity changes, and typing a value calls onDirtyChange, which
  // re-renders this component - so an unmemoized filter handed the grid a new
  // array on every keystroke and wiped the value the moment it was typed.
  const shiftFilteredRows = useMemo(
    () => stageRows.filter(r => !r.shiftId || r.shiftId === selectedShiftId),
    [stageRows, selectedShiftId]
  )

  const handleClose = () => {
    if (!isDirty) {
      onClose()
      return
    }
    setDialog({
      title: 'Discard unsaved actuals?',
      description: 'You have unsaved actuals entered. Closing now will discard them.',
      confirmLabel: 'Discard & Close',
      cancelLabel: 'Keep Editing',
      onConfirm: onClose,
    })
  }

  const performCloseDay = async () => {
    if (!date) return
    setIsClosing(true)
    try {
      const res = await fetch('/api/production-plans/close-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      })
      if (res.ok) {
        const data = await res.json()
        setIsClosed(true)
        await onSaved()
        setDialog({
          title: 'Day Closed',
          description: `${data.carriedForward.length} item(s) carried forward to tomorrow.`,
          tone: 'info',
          onConfirm: () => {},
        })
      } else {
        const err = await res.json()
        setDialog({
          title: 'Could Not Close Day',
          description: err.error || 'Failed to close day',
          onConfirm: () => {},
        })
      }
    } finally {
      setIsClosing(false)
    }
  }

  const performReopenDay = async () => {
    if (!date) return
    setIsClosing(true)
    try {
      const res = await fetch(`/api/production-day-closures?date=${date}`, { method: 'DELETE' })
      if (res.ok) {
        const data = await res.json()
        setIsClosed(false)
        await onSaved()
        setDialog({
          title: 'Day Reopened',
          description: `Actuals can be edited again for ${date}.`
            + `\n\n${data.carryForwardsRemoved} carried-forward row(s) removed from tomorrow.`
            + (data.carryForwardsKept > 0
              ? `\n${data.carryForwardsKept} kept because work has already been recorded against them.`
              : ''),
          tone: 'info',
          onConfirm: () => {},
        })
      } else {
        const err = await res.json()
        setDialog({
          title: 'Could Not Reopen Day',
          description: err.error || 'Failed to reopen day',
          onConfirm: () => {},
        })
      }
    } finally {
      setIsClosing(false)
    }
  }

  const handleReopenDay = () => {
    if (!date) return
    setDialog({
      title: 'Reopen this day?',
      description: `Unlock ${date} so actuals can be edited again. Carry-forward rows this day created will be removed from tomorrow, unless work has already been recorded against them.`,
      confirmLabel: 'Reopen Day',
      cancelLabel: 'Cancel',
      onConfirm: performReopenDay,
    })
  }

  const handleCloseDay = () => {
    if (!date) return
    setDialog({
      title: 'Close this day?',
      description: `Close ${date}? This carries forward any shortfall to tomorrow and locks further edits for this date.`,
      confirmLabel: 'Close Day',
      cancelLabel: 'Cancel',
      onConfirm: performCloseDay,
    })
  }

  if (!date) return null

  return (
    <>
    <Dialog open={!!date} onOpenChange={(open) => !open && handleClose()}>
      {/* Sized like Planning's own modal (98vw) rather than a fixed 1200px:
          the hourly grid carries one column per shift hour, which simply
          doesn't fit a narrower dialog without horizontal scrolling. */}
      <DialogContent className="w-full h-full max-w-full rounded-none sm:w-[98vw] sm:max-w-[98vw] sm:h-[95vh] sm:rounded-2xl bg-[#F4F6FB] text-foreground p-0 shadow-2xl flex flex-col overflow-hidden">
        <DialogHeader className="p-6 pb-4 pr-14 border-b border-[#E0E7FF] bg-white shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <DialogTitle className="text-xl font-heading text-[#172554]">{date}</DialogTitle>
            <div className="flex items-center gap-2">
              {/* Re-planning a disrupted day is a planning decision, so it
                  happens in Planning - which owns the quantity caps, machine
                  capacity ceilings and shift-end checks. Tracking deep-links
                  straight to this day/stage so it is one click, but never
                  rewrites the plan itself: Close Day derives the carry-forward
                  from planned - actual, so a plan edited down to match a bad
                  day would silently drop the unmade work instead of moving it
                  to tomorrow. */}
              <Button
                variant="outline"
                onClick={() => { window.location.href = `/production-planning?tab=${activeStage}&date=${date}` }}
                title="Open this day in Production Planning to change the schedule"
                className="border-[#E0E7FF] text-[#4F46E5] hover:bg-[#EEF2FF]"
              >
                Revise Plan
              </Button>
              {isClosed ? (
                <Button
                  onClick={handleReopenDay}
                  disabled={isClosing}
                  variant="outline"
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                  {isClosing ? 'Reopening...' : 'Reopen Day'}
                </Button>
              ) : (
                <Button onClick={handleCloseDay} disabled={isClosing} className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white">
                  {isClosing ? 'Closing...' : 'Close Day'}
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4">
          {/* Without this, a closed day just presented a screen of dead inputs
              with no stated reason - the single most confusing state this
              screen can be in. */}
          {isClosed && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <Lock weight="fill" className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-amber-900">This day is closed — actuals are locked</p>
                <p className="text-amber-700 mt-0.5">
                  Its shortfall has already been carried forward to the next day. Use <span className="font-semibold">Reopen Day</span> above to edit these figures again.
                </p>
              </div>
            </div>
          )}

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

          {activeStage === 'Melt' ? (
            <TrackingMeltActualsTable
              rows={shiftFilteredRows}
              orders={orders}
              onDirtyChange={setIsDirty}
              onSaved={onSaved}
              disabled={isClosed}
            />
          ) : (
            <TrackingHourlyGrid
              rows={shiftFilteredRows}
              orders={orders}
              timeSlots={timeSlots}
              stage={activeStage}
              onDirtyChange={setIsDirty}
              onSaved={onSaved}
              disabled={isClosed}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
    <ConfirmDialog state={dialog} onClose={() => setDialog(null)} />
    </>
  )
}
