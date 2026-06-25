'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Switch } from '@/shared/ui/switch'
import { Label } from '@/shared/ui/label'
import { Badge } from '@/shared/ui/badge'
import { ScheduleDrawer, type Schedule } from '@/domains/production/components/schedule-drawer'
import { cn } from '@/shared/lib/utils'
import { useRole } from '@/shared/context/role-context'
import { ShieldWarning } from '@phosphor-icons/react'

interface Order {
  id: string
  customerOrderNo: string
  customer: string
  status: string
}

export default function ProductionSchedulePage() {
  const { role } = useRole()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'weekly' | 'monthly'>('weekly')
  
  // Modal state
  const [selectedDate, setSelectedDate] = useState<string | null>(null)


  const fetchData = useCallback(async () => {
    try {
      const [schedRes, orderRes] = await Promise.all([
        fetch('/api/schedules'),
        fetch('/api/orders')
      ])
      if (schedRes.ok && orderRes.ok) {
        setSchedules(await schedRes.json())
        setOrders(await orderRes.json())
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

  const handleScheduleOrder = async (orderId: string, stage: string) => {
    if (!selectedDate) return
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, date: selectedDate, stage }),
      })
      if (res.ok) {
        await fetchData()
      }
    } catch (err) {
      console.error('Failed to schedule order:', err)
    }
  }

  const handleRemoveSchedule = async (id: string) => {
    try {
      const res = await fetch(`/api/schedules/${id}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchData()
      }
    } catch (err) {
      console.error('Failed to remove schedule:', err)
    }
  }

  const handleSaveEntries = async (entries: Record<string, { planned: number, actual: number }>) => {
    try {
      const updates = Object.keys(entries).map(id => 
        fetch(`/api/schedules/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            plannedQuantity: entries[id].planned, 
            actualQuantity: entries[id].actual 
          })
        })
      )
      await Promise.all(updates)
      await fetchData()
    } catch (err) {
      console.error('Failed to save entries:', err)
    }
  }

  // Aggregate schedules by date for the calendar cells
  const schedulesByDate = useMemo(() => {
    const map = new Map<string, { Moulding: number, Melting: number, Fettling: number }>()
    schedules.forEach(s => {
      if (!map.has(s.date)) {
        map.set(s.date, { Moulding: 0, Melting: 0, Fettling: 0 })
      }
      const counts = map.get(s.date)!
      counts[s.stage]++
    })
    return map
  }, [schedules])

  // Calendar logic (Very basic starting from current week/month)
  const getDays = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    if (view === 'weekly') {
      // Get current week (Mon - Sun)
      const currentDay = today.getDay()
      const diff = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1) // adjust when day is sunday
      const monday = new Date(today.setDate(diff))
      
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday)
        d.setDate(monday.getDate() + i)
        return d
      })
    } else {
      // Get current month grid (42 cells to ensure 6 rows)
      const year = today.getFullYear()
      const month = today.getMonth()
      const firstDay = new Date(year, month, 1)
      const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1 // 0 is Monday
      
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
          <h1 className="text-3xl font-bold text-[#EEF3FF] font-heading tracking-tight">Production Schedule</h1>
          <p className="text-[#8B9FC4] mt-1 text-sm">Assign and track production stages across dates</p>
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
          <div className={cn("grid grid-cols-7 bg-[#243050] gap-px", view === 'monthly' ? '' : '')}>
            {days.map((date, i) => {
              const dateStr = date.toISOString().split('T')[0]
              const isToday = new Date().toISOString().split('T')[0] === dateStr
              const isCurrentMonth = view === 'weekly' || date.getMonth() === new Date().getMonth()
              
              const counts = schedulesByDate.get(dateStr)

              return (
                <div 
                  key={i}
                  onClick={() => setSelectedDate(dateStr)}
                  className={cn(
                    "min-h-[140px] bg-[#050810] p-2 hover:bg-[#1A263D]/50 transition-colors cursor-pointer group flex flex-col gap-1",
                    !isCurrentMonth && "opacity-50"
                  )}
                >
                  <div className="flex justify-end">
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
                    {counts?.Moulding ? (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-[11px] font-medium justify-center w-full rounded-md py-0.5">
                        Moulding {counts.Moulding}
                      </Badge>
                    ) : null}
                    
                    {counts?.Melting ? (
                      <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20 text-[11px] font-medium justify-center w-full rounded-md py-0.5">
                        Melting {counts.Melting}
                      </Badge>
                    ) : null}
                    
                    {counts?.Fettling ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-[11px] font-medium justify-center w-full rounded-md py-0.5">
                        Fettling {counts.Fettling}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <ScheduleDrawer
        isOpen={!!selectedDate}
        date={selectedDate || ''}
        schedules={selectedDate ? schedules.filter(s => s.date === selectedDate) : []}
        orders={orders}
        onClose={() => setSelectedDate(null)}
        onSchedule={handleScheduleOrder}
        onRemove={handleRemoveSchedule}
        onSaveEntries={handleSaveEntries}
      />
    </div>
  )
}
