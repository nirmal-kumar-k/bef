'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Input } from '@/shared/ui/input'
import { Button } from '@/shared/ui/button'
import { cn, toLocalDateString } from '@/shared/lib/utils'
import { TrackingStageList, type TrackingPlanRow } from '@/modules/production/presentation/tracking-stage-list'
import { TrackingDayModal } from '@/modules/production/presentation/tracking-day-modal'
import { ConfirmDialog, type ConfirmDialogState } from '@/shared/ui/confirm-dialog'

const STAGES: TrackingPlanRow['stage'][] = ['Core', 'Mould', 'Melt', 'Knockout']
const STAGE_DOTS: { stage: TrackingPlanRow['stage']; color: string }[] = [
  { stage: 'Core', color: 'bg-yellow-400' },
  { stage: 'Mould', color: 'bg-[#4F46E5]' },
  { stage: 'Melt', color: 'bg-orange-400' },
  { stage: 'Knockout', color: 'bg-emerald-400' },
]

export default function ProductionTrackingPage() {
  const [plans, setPlans] = useState<TrackingPlanRow[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [shifts, setShifts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState(() => toLocalDateString(new Date()))
  const [activeStage, setActiveStage] = useState<TrackingPlanRow['stage']>('Core')
  const [isClosed, setIsClosed] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [openDayModalDate, setOpenDayModalDate] = useState<string | null>(null)
  const [dialog, setDialog] = useState<ConfirmDialogState | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [planRes, orderRes, shiftRes] = await Promise.all([fetch('/api/production-plans'), fetch('/api/orders'), fetch('/api/shifts')])
      if (planRes.ok) setPlans(await planRes.json())
      if (orderRes.ok) setOrders(await orderRes.json())
      if (shiftRes.ok) setShifts(await shiftRes.json())
    } catch (err) {
      console.error('Failed to fetch tracking data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    fetch(`/api/production-day-closures?date=${dateFilter}`)
      .then(res => res.ok ? res.json() : { closed: false })
      .then(data => setIsClosed(!!data.closed))
      .catch(() => setIsClosed(false))
  }, [dateFilter])

  const performCloseDay = async () => {
    setIsClosing(true)
    try {
      const res = await fetch('/api/production-plans/close-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateFilter }),
      })
      if (res.ok) {
        const data = await res.json()
        setIsClosed(true)
        await fetchData()
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
    setDialog({
      title: 'Close this day?',
      description: `Close ${dateFilter}? This carries forward any shortfall to tomorrow and locks further edits for this date.`,
      confirmLabel: 'Close Day',
      cancelLabel: 'Cancel',
      onConfirm: performCloseDay,
    })
  }

  const dayPlans = useMemo(() => plans.filter(p => p.date === dateFilter), [plans, dateFilter])

  const [summaryView, setSummaryView] = useState<'calendar' | 'list'>('list')

  const calendarDays = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
    const startDate = new Date(firstDay)
    startDate.setDate(firstDay.getDate() - startOffset)
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(startDate)
      d.setDate(startDate.getDate() + i)
      return d
    })
  }, [])

  const trackingByDate = useMemo(() => {
    const map = new Map<string, Record<'Core' | 'Mould' | 'Melt' | 'Knockout', { planned: number; actual: number }>>()
    plans.forEach(p => {
      if (!STAGES.includes(p.stage)) return
      if (!map.has(p.date)) {
        map.set(p.date, { Core: { planned: 0, actual: 0 }, Mould: { planned: 0, actual: 0 }, Melt: { planned: 0, actual: 0 }, Knockout: { planned: 0, actual: 0 } })
      }
      const entry = map.get(p.date)!
      entry[p.stage].planned += Number(p.quantityScheduled) || 0
      entry[p.stage].actual += p.stage === 'Melt'
        ? Number(p.actualQuantity) || 0
        : Object.values(p.hourlyActuals || {}).reduce((s, v) => s + (Number(v) || 0), 0)
    })
    return map
  }, [plans])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#172554] font-heading tracking-tight">Production Tracking</h1>
          <p className="text-[#64748B] mt-1 text-sm">Read-only view of planned quantities, with actuals entry per item</p>
        </div>
        <div className="flex gap-2">
          <Input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="w-40 bg-[#FFFFFF] border-[#E0E7FF] text-[#172554]"
          />
          <Button onClick={handleCloseDay} disabled={isClosed || isClosing} className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white">
            {isClosed ? 'Day Closed' : isClosing ? 'Closing...' : 'Close Day'}
          </Button>
        </div>
      </div>

      <div className="flex justify-end">
        <div className="flex items-center gap-3 bg-white px-4 py-1.5 border border-[#E0E7FF] rounded-xl shadow-sm">
          <button onClick={() => setSummaryView('calendar')} className={cn('text-sm font-semibold', summaryView === 'calendar' ? 'text-[#172554]' : 'text-[#94A3B8]')}>Calendar</button>
          <button onClick={() => setSummaryView('list')} className={cn('text-sm font-semibold', summaryView === 'list' ? 'text-[#172554]' : 'text-[#94A3B8]')}>List</button>
        </div>
      </div>

      {summaryView === 'list' && (
        <>
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

          {loading ? (
            <p className="text-[#64748B] text-center py-12 animate-pulse">Loading tracking data...</p>
          ) : (
            <TrackingStageList
              stage={activeStage}
              plans={dayPlans}
              orders={orders}
              onSaved={fetchData}
              disableActuals={isClosed}
            />
          )}
        </>
      )}

      {summaryView === 'calendar' && (
        <div className="bg-[#F4F6FB] border border-[#E0E7FF] rounded-xl p-4 overflow-x-auto">
          <div className="grid grid-cols-7 mt-2 mb-2 min-w-[800px]">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="py-2 text-center text-xs font-semibold text-[#64748B] uppercase tracking-wider">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-3 min-w-[800px]">
            {calendarDays.map((date, i) => {
              const dateStr = toLocalDateString(date)
              const isToday = toLocalDateString(new Date()) === dateStr
              const counts = trackingByDate.get(dateStr)
              return (
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
              )
            })}
          </div>
        </div>
      )}

      <TrackingDayModal
        date={openDayModalDate}
        plans={plans}
        orders={orders}
        shifts={shifts}
        onClose={() => setOpenDayModalDate(null)}
        onSaved={fetchData}
      />

      <ConfirmDialog state={dialog} onClose={() => setDialog(null)} />
    </div>
  )
}
