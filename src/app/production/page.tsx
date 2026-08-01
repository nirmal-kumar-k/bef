'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Input } from '@/shared/ui/input'
import { cn, toLocalDateString } from '@/shared/lib/utils'
import { TrackingStageList, type TrackingPlanRow } from '@/modules/production/presentation/tracking-stage-list'

const STAGES: TrackingPlanRow['stage'][] = ['Core', 'Mould', 'Melt', 'Knockout']

export default function ProductionTrackingPage() {
  const [plans, setPlans] = useState<TrackingPlanRow[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState(() => toLocalDateString(new Date()))
  const [activeStage, setActiveStage] = useState<TrackingPlanRow['stage']>('Core')

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [planRes, orderRes] = await Promise.all([fetch('/api/production-plans'), fetch('/api/orders')])
      if (planRes.ok) setPlans(await planRes.json())
      if (orderRes.ok) setOrders(await orderRes.json())
    } catch (err) {
      console.error('Failed to fetch tracking data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const dayPlans = useMemo(() => plans.filter(p => p.date === dateFilter), [plans, dateFilter])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#172554] font-heading tracking-tight">Production Tracking</h1>
          <p className="text-[#64748B] mt-1 text-sm">Read-only view of planned quantities, with actuals entry per item</p>
        </div>
        <Input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          className="w-40 bg-[#FFFFFF] border-[#E0E7FF] text-[#172554]"
        />
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
          onEnterActuals={() => {}}
        />
      )}
    </div>
  )
}
