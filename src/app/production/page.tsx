'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Input } from '@/shared/ui/input'
import { Button } from '@/shared/ui/button'
import { cn, toLocalDateString } from '@/shared/lib/utils'
import { TrackingStageList, type TrackingPlanRow } from '@/modules/production/presentation/tracking-stage-list'
import { TrackingActualsModal } from '@/modules/production/presentation/tracking-actuals-modal'

const STAGES: TrackingPlanRow['stage'][] = ['Core', 'Mould', 'Melt', 'Knockout']

export default function ProductionTrackingPage() {
  const [plans, setPlans] = useState<TrackingPlanRow[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [shifts, setShifts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState(() => toLocalDateString(new Date()))
  const [activeStage, setActiveStage] = useState<TrackingPlanRow['stage']>('Core')
  const [actualsPlan, setActualsPlan] = useState<TrackingPlanRow | null>(null)
  const [isClosed, setIsClosed] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

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

  const handleCloseDay = async () => {
    if (!confirm(`Close ${dateFilter}? This carries forward any shortfall to tomorrow and locks further edits for this date.`)) return
    setIsClosing(true)
    try {
      const res = await fetch('/api/production-plans/close-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateFilter }),
      })
      if (res.ok) {
        const data = await res.json()
        alert(`Day closed. ${data.carriedForward.length} item(s) carried forward to tomorrow.`)
        setIsClosed(true)
        await fetchData()
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to close day')
      }
    } finally {
      setIsClosing(false)
    }
  }

  const dayPlans = useMemo(() => plans.filter(p => p.date === dateFilter), [plans, dateFilter])

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
          onEnterActuals={isClosed ? () => {} : setActualsPlan}
          disableActuals={isClosed}
        />
      )}

      <TrackingActualsModal
        plan={actualsPlan}
        shifts={shifts}
        onClose={() => setActualsPlan(null)}
        onSaved={fetchData}
      />
    </div>
  )
}
