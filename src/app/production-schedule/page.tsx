'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Switch } from '@/shared/ui/switch'
import { Label } from '@/shared/ui/label'
import { Badge } from '@/shared/ui/badge'
import { ScheduleDrawer } from '@/domains/production/components/schedule-drawer'
import { cn } from '@/shared/lib/utils'
import { useRole } from '@/shared/context/role-context'

export interface IStageData {
  planned: number
  completed: number
  pending: number
  variance: number
  unit: string
}

export interface Schedule {
  id: string
  orderId: string
  date: string
  shift: 'Morning' | 'Evening'
  priority: 'High' | 'Normal'
  remarks: string
  status: string
  customerOrderNo: string
  customer: string
  cart: any[]
  stages: {
    core: IStageData
    melting: IStageData
    moulding: IStageData
    pouring: IStageData
    knockout: IStageData
    shotBlasting: IStageData
    grinding: IStageData
    inspection: IStageData
    readyForDispatch: IStageData
  }
}

interface Order {
  id: string
  customerOrderNo: string
  customer: string
  status: string
  cart: any[]
}

export default function ProductionSchedulePage() {
  const { role } = useRole()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'weekly' | 'monthly'>('monthly')
  
  // Modal state
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const [products, setProducts] = useState<any[]>([])
  const [patterns, setPatterns] = useState<any[]>([])

  const fetchData = useCallback(async () => {
    try {
      const [schedRes, orderRes, prodRes, patRes] = await Promise.all([
        fetch('/api/schedules'),
        fetch('/api/orders'),
        fetch('/api/products'),
        fetch('/api/patterns')
      ])
      if (schedRes.ok && orderRes.ok && prodRes.ok && patRes.ok) {
        setSchedules(await schedRes.json())
        setOrders(await orderRes.json())
        setProducts(await prodRes.json())
        setPatterns(await patRes.json())
      }
    } catch (err) {
      console.error('Failed to fetch schedule data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Aggregate schedules by date for the calendar cells
  const schedulesByDate = useMemo(() => {
    const map = new Map<string, { core: number, melting: number, moulding: number, coreDone: number, meltingDone: number, mouldingDone: number, hasPending: boolean }>()
    schedules.forEach(s => {
      if (!map.has(s.date)) {
        map.set(s.date, { core: 0, melting: 0, moulding: 0, coreDone: 0, meltingDone: 0, mouldingDone: 0, hasPending: false })
      }
      const counts = map.get(s.date)!
      counts.core += s.stages?.core?.planned || 0
      counts.melting += s.stages?.melting?.planned || 0
      counts.moulding += s.stages?.moulding?.planned || 0
      
      counts.coreDone += s.stages?.core?.completed || 0
      counts.meltingDone += s.stages?.melting?.completed || 0
      counts.mouldingDone += s.stages?.moulding?.completed || 0

      if (s.remarks?.includes('Carried forward')) {
         counts.hasPending = true
      }
    })
    return map
  }, [schedules])

  // Calendar logic
  const getDays = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    if (view === 'weekly') {
      const currentDay = today.getDay()
      const diff = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1)
      const monday = new Date(today.setDate(diff))
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday)
        d.setDate(monday.getDate() + i)
        return d
      })
    } else {
      const year = today.getFullYear()
      const month = today.getMonth()
      const firstDay = new Date(year, month, 1)
      const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
      
      const startDate = new Date(firstDay)
      startDate.setDate(firstDay.getDate() - startOffset)
      
      return Array.from({ length: 42 }, (_, i) => {
        const d = new Date(startDate)
        d.setDate(startDate.getDate() + i)
        return d
      })
    }
  }

  const days = getDays()
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#EEF3FF] font-heading tracking-tight">Day-Wise Schedule</h1>
          <p className="text-[#8B9FC4] mt-1 text-sm">Assign daily production quotas across 9 stages</p>
        </div>
        <div className="flex items-center gap-3 bg-[#0C1221] px-4 py-2 border border-[#243050] rounded-xl">
          <Label htmlFor="view-mode" className={cn("text-sm font-semibold cursor-pointer", view === 'weekly' ? 'text-white' : 'text-[#5A6E90]')}>Weekly</Label>
          <Switch 
            id="view-mode" 
            checked={view === 'monthly'} 
            onCheckedChange={(c) => setView(c ? 'monthly' : 'weekly')}
            className="data-[state=checked]:bg-[#D4521A] data-[state=unchecked]:bg-[#2E3C5C]"
          />
          <Label htmlFor="view-mode" className={cn("text-sm font-semibold cursor-pointer", view === 'monthly' ? 'text-white' : 'text-[#5A6E90]')}>Monthly</Label>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <p className="text-[#8B9FC4] text-lg animate-pulse">Loading schedule...</p>
        </div>
      ) : (
        <div className="bg-[#050810] border border-[#243050] rounded-xl overflow-hidden">
          {/* Calendar Header Row */}
          <div className="grid grid-cols-7 bg-[#0C1221] border-b border-[#243050]">
            {weekDays.map(day => (
              <div key={day} className="py-3 text-center text-xs font-semibold text-[#8B9FC4] uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 bg-[#243050] gap-px">
            {days.map((date, i) => {
              const dateStr = date.toISOString().split('T')[0]
              const isToday = new Date().toISOString().split('T')[0] === dateStr
              const isCurrentMonth = view === 'weekly' || date.getMonth() === new Date().getMonth()
              
              const counts = schedulesByDate.get(dateStr)
              
              // Capacity validation warnings for the cell
              const isMeltingOverload = (counts?.melting || 0) > 2000 // example capacity
              const isMouldingOverload = (counts?.moulding || 0) > 500

              return (
                <div 
                  key={i}
                  onClick={() => setSelectedDate(dateStr)}
                  className={cn(
                    "min-h-[140px] bg-[#050810] p-2 hover:bg-[#1A263D]/50 transition-colors cursor-pointer group flex flex-col gap-1 relative",
                    !isCurrentMonth && "opacity-50"
                  )}
                >
                  <div className="flex justify-between items-center w-full">
                    <div className="flex gap-1">
                       {isMeltingOverload && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Melting Capacity Exceeded" />}
                       {isMouldingOverload && <div className="w-2 h-2 rounded-full bg-orange-500" title="Moulding Capacity Warning" />}
                    </div>
                    <span className={cn(
                      "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                      isToday 
                        ? "bg-[#D4521A] text-white" 
                        : "text-[#8B9FC4] group-hover:text-[#EEF3FF]"
                    )}>
                      {date.getDate()}
                    </span>
                  </div>
                  
                  {/* Badges */}
                  <div className="flex flex-col gap-1.5 mt-1">
                    {counts?.hasPending && (
                      <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 text-[11px] font-medium justify-center w-full rounded-md py-0.5 shadow-sm">
                        Pending Items
                      </Badge>
                    )}
                    {counts?.core ? (
                      <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-[11px] font-medium justify-center w-full rounded-md py-0.5">
                        Core {counts.coreDone} / {counts.core}
                      </Badge>
                    ) : null}
                    {counts?.melting ? (
                      <Badge variant="outline" className={cn("text-[11px] font-medium justify-center w-full rounded-md py-0.5", isMeltingOverload ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-orange-500/10 text-orange-500 border-orange-500/20")}>
                        Melting {counts.meltingDone} / {counts.melting}
                      </Badge>
                    ) : null}
                    {counts?.moulding ? (
                      <Badge variant="outline" className={cn("text-[11px] font-medium justify-center w-full rounded-md py-0.5", isMouldingOverload ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-blue-500/10 text-blue-500 border-blue-500/20")}>
                        Moulding {counts.mouldingDone} / {counts.moulding}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {selectedDate && (
        <ScheduleDrawer
          isOpen={true}
          date={selectedDate}
          schedules={schedules.filter(s => s.date === selectedDate)}
          orders={orders}
          products={products}
          patterns={patterns}
          onClose={() => setSelectedDate(null)}
          onRefresh={fetchData}
        />
      )}
    </div>
  )
}
