'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { cn, toLocalDateString } from '@/shared/lib/utils'
import { TrackingDayModal } from '@/modules/production/presentation/tracking-day-modal'
import type { TrackingPlanRow } from '@/modules/production/presentation/tracking-types'

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
  const [openDayModalDate, setOpenDayModalDate] = useState<string | null>(null)

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
      <div>
        <h1 className="text-3xl font-bold text-[#172554] font-heading tracking-tight">Production Tracking</h1>
        <p className="text-[#64748B] mt-1 text-sm">Select a day to record actuals against what was planned</p>
      </div>

      {loading ? (
        <p className="text-[#64748B] text-center py-12 animate-pulse">Loading tracking data...</p>
      ) : (
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
    </div>
  )
}
