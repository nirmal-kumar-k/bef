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
      <DialogContent className="w-full h-full max-w-full rounded-none sm:w-[95vw] sm:max-w-[1200px] sm:h-[90vh] sm:rounded-2xl bg-[#F4F6FB] text-foreground p-0 shadow-2xl flex flex-col overflow-hidden">
        <DialogHeader className="p-6 pb-4 pr-14 border-b border-[#E0E7FF] bg-white shrink-0">
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
