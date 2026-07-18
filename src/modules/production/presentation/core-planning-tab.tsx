import { useState, useMemo, useEffect } from 'react'
import { BacklogItem } from './daily-planning-modal'
import { Input } from '@/shared/ui/input'
import { Button } from '@/shared/ui/button'
import { Label } from '@/shared/ui/label'
import { CorePlanningModal } from './core-planning-modal'
import { cn, toLocalDateString } from '@/shared/lib/utils'

interface CorePlanningTabProps {
  coreBacklog: BacklogItem[]
  patterns: any[]
  openOrders: any[]
  dailyPlans: any[]
  onSaveDayPlan: (date: string, plans: any[]) => void
}

export function CorePlanningTab({ coreBacklog, patterns, openOrders, dailyPlans, onSaveDayPlan }: CorePlanningTabProps) {
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('calendar')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Workers state per core box code
  const [workersPerBox, setWorkersPerBox] = useState<Record<string, number>>({})

  // Equipment master is the only source for the per-hour core production rate
  const [coreEquipments, setCoreEquipments] = useState<any[]>([])
  useEffect(() => {
    fetch('/api/equipment')
      .then(res => res.json())
      .then(data => setCoreEquipments(data.filter((e: any) => e.type === 'Core Machine' && e.isActive)))
      .catch(console.error)
  }, [])

  const SHIFT_HOURS = 12.5 // 8:00 AM to 8:30 PM

  // Calendar logic
  const getDays = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
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
  const days = getDays()
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  // Average core production rate across active Core Machines in equipment master -
  // patterns/core boxes no longer carry their own rate.
  const equipmentAvgProd = useMemo(() => {
    const rates = coreEquipments.map(e => Number(e.avgPiecesPerHour)).filter(r => r > 0)
    return rates.length > 0 ? rates.reduce((s, r) => s + r, 0) / rates.length : 10
  }, [coreEquipments])

  // Group backlog by Core Box to calculate Shift Planning
  const shiftPlanningData = useMemo(() => {
    const boxMap = new Map<string, { totalRequired: number, avgProduction: number, patternRef: string }>()

    coreBacklog.forEach(b => {
      if (!b.coreBoxCode) return

      if (!boxMap.has(b.coreBoxCode)) {
        boxMap.set(b.coreBoxCode, { totalRequired: 0, avgProduction: equipmentAvgProd, patternRef: b.patternRef })
      }

      const existing = boxMap.get(b.coreBoxCode)!
      existing.totalRequired += Math.max(0, b.totalRequired - b.totalScheduled) // Remaining
    })

    return Array.from(boxMap.entries()).map(([code, data]) => ({
      code,
      ...data
    }))
  }, [coreBacklog, equipmentAvgProd])

  // Aggregate capacities
  const totalRemainingCores = coreBacklog.reduce((sum, b) => sum + Math.max(0, b.totalRequired - b.totalScheduled), 0)
  const totalWorkers = Object.values(workersPerBox).reduce((sum, w) => sum + (Number(w) || 0), 0)
  
  // To get a blended average core production, we can take a simple average of the shift planning avgProduction 
  // or a weighted average. Let's do simple for now or just take a default 10 if no boxes.
  const blendedAvg = shiftPlanningData.length > 0 
    ? shiftPlanningData.reduce((sum, d) => sum + d.avgProduction, 0) / shiftPlanningData.length 
    : 10
    
  const completionHours = (totalWorkers > 0 && blendedAvg > 0) ? totalRemainingCores / (totalWorkers * blendedAvg) : 0
  const completionDays = completionHours / SHIFT_HOURS

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <div className="flex items-center gap-3 bg-[#FFFFFF] px-4 py-1.5 border border-[#E0E7FF] rounded-xl shadow-sm">
          <Label htmlFor="view-mode" className={cn("text-sm font-semibold cursor-pointer transition-colors duration-200", viewMode === 'table' ? 'text-[#172554]' : 'text-[#94A3B8]')} onClick={() => setViewMode('table')}>Table</Label>
          <div 
            className="w-12 h-6 bg-[#F4F6FB] rounded-full relative cursor-pointer border border-[#E0E7FF] shadow-inner transition-colors duration-200 hover:bg-[#EEF2FF]"
            onClick={() => setViewMode(v => v === 'table' ? 'calendar' : 'table')}
          >
            <div className={cn(
              "w-4 h-4 bg-[#4F46E5] rounded-full absolute top-[3px] transition-all duration-300 shadow-sm",
              viewMode === 'calendar' ? "left-[27px]" : "left-[3px]"
            )} />
          </div>
          <Label htmlFor="view-mode" className={cn("text-sm font-semibold cursor-pointer transition-colors duration-200", viewMode === 'calendar' ? 'text-[#172554]' : 'text-[#94A3B8]')} onClick={() => setViewMode('calendar')}>Calendar</Label>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <div className="bg-[#F4F6FB] border border-[#E0E7FF] rounded-xl relative flex flex-col p-4 overflow-x-auto">
          <div className="grid grid-cols-7 mb-2 min-w-[800px]">
            {weekDays.map(day => (
              <div key={day} className="py-2 text-center text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-3 flex-1 min-w-[800px]">
            {days.map((date, i) => {
              const dateStr = toLocalDateString(date)
              const isToday = toLocalDateString(new Date()) === dateStr
              const isCurrentMonth = date.getMonth() === new Date().getMonth()
              
              const dayPlans = dailyPlans.filter(p => p.date === dateStr && p.stage === 'Core')
              const sum = dayPlans.reduce((s, p) => s + p.quantityScheduled, 0)
              const pendingAmount = coreBacklog.reduce((s, b) => s + Math.max(0, b.totalRequired - b.totalScheduled), 0)
              const hasPending = pendingAmount > 0

              const handleDrop = (e: React.DragEvent) => {
                e.preventDefault()
                try {
                  const dataStr = e.dataTransfer.getData('text/plain')
                  if (!dataStr) return
                  const data = JSON.parse(dataStr)

                  if (data.type === 'planned' && data.plans && data.plans.length > 0 && data.plans[0].date !== dateStr) {
                    const updates = data.plans.map((p: any) => ({ ...p, date: dateStr }))
                    onSaveDayPlan(dateStr, updates)
                  } else if (data.type === 'pending') {
                    const newPlans: any[] = []
                    coreBacklog.forEach(b => {
                      const remaining = b.totalRequired - b.totalScheduled
                      if (remaining > 0) {
                        newPlans.push({
                          stage: 'Core',
                          date: dateStr,
                          itemId: b.itemId,
                          productName: b.productName,
                          patternRef: b.patternRef,
                          coreBoxCode: b.coreBoxCode,
                          quantityScheduled: remaining
                        })
                      }
                    })
                    if (newPlans.length > 0) {
                      onSaveDayPlan(dateStr, newPlans)
                    }
                  }
                } catch (err) {
                  console.error('Drop parse error', err)
                }
              }

              const prevDate = new Date(date)
              prevDate.setDate(date.getDate() - 1)
              const prevDateStr = toLocalDateString(prevDate)
              const prevDayPlans = dailyPlans.filter(p => p.date === prevDateStr && p.stage === 'Core')
              // With no Actual entry to compare against, we can't know what was
              // actually produced, so we conservatively carry the full
              // scheduled amount forward as still-pending.
              const carryForwardAmount = prevDayPlans.reduce((s, p) => s + p.quantityScheduled, 0)
              const hasCarryForward = carryForwardAmount > 0

              return (
                <div 
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    e.dataTransfer.dropEffect = 'move'
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onDrop={(e) => {
                    e.stopPropagation()
                    handleDrop(e)
                  }}
                  className={cn(
                    "bg-[#FFFFFF] p-2 rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:-translate-y-[2px] transition-all duration-300 ease-out cursor-pointer flex flex-col min-h-[120px] border border-[#E0E7FF] hover:border-[#4F46E5] hover:shadow-[0_4px_14px_rgba(79,70,229,0.12)] group overflow-hidden relative",
                    !isCurrentMonth && "bg-[#F8FAFC]/50 opacity-70 hover:opacity-100"
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={cn(
                      "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                      isToday ? "bg-[#4F46E5] text-white" : "text-[#64748B]"
                    )}>
                      {date.getDate()}
                    </span>
                  </div>
                  
                  <div className="flex-1 space-y-1">
                    {sum > 0 && (
                      <div 
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation()
                          e.dataTransfer.effectAllowed = 'move'
                          e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'planned', plans: dayPlans }))
                        }}
                        className="flex items-center justify-between px-1.5 py-1 rounded-md hover:bg-[#F8FAFC] transition-colors cursor-grab"
                      >
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#4285F4]" />
                          <span className="text-[10.5px] font-medium text-[#64748B]">Production</span>
                        </div>
                        <span className="text-[10.5px] font-bold text-[#0F172A]">{sum}</span>
                      </div>
                    )}
                    {isToday && hasPending && !hasCarryForward && (
                      <div 
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation()
                          e.dataTransfer.effectAllowed = 'move'
                          e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'pending' }))
                        }}
                        className="flex items-center justify-between px-1.5 py-1 bg-red-50/50 hover:bg-red-50 rounded-md transition-colors cursor-grab mt-1"
                      >
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-[10.5px] font-medium text-red-600">Pending</span>
                        </div>
                        <span className="text-[10.5px] font-bold text-red-600">{pendingAmount}</span>
                      </div>
                    )}
                    {hasCarryForward && (
                      <div 
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation()
                          e.dataTransfer.effectAllowed = 'move'
                          e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'pending' }))
                        }}
                        className="flex items-center justify-between px-1.5 py-1 bg-red-50/50 hover:bg-red-50 rounded-md transition-colors cursor-grab mt-1"
                      >
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-[10.5px] font-medium text-red-600">Pending</span>
                        </div>
                        <span className="text-[10.5px] font-bold text-red-600">{carryForwardAmount}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <CorePlanningModal
            isOpen={!!selectedDate}
            onClose={() => setSelectedDate(null)}
            date={selectedDate || ''}
            openOrders={openOrders}
            backlogData={coreBacklog}
            dailyPlans={selectedDate ? dailyPlans.filter(p => p.date === selectedDate && p.stage === 'Core') : []}
            patterns={patterns}
            onSaveDayPlan={onSaveDayPlan}
          />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Table View */}
          <div className="bg-[#F4F6FB] border border-[#E0E7FF] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#FFFFFF] border-b border-[#E0E7FF] text-[#64748B] text-[11px] uppercase tracking-wider font-bold">
              <tr>
                <th className="px-6 py-4 text-center">Order No</th>
                <th className="px-6 py-4 text-center">Pattern Ref</th>
                <th className="px-6 py-4 text-center">Core Box</th>
                <th className="px-6 py-4 text-center">Required</th>
                <th className="px-6 py-4 text-center">Completed</th>
                <th className="px-6 py-4 text-center">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0E7FF] text-[#172554]">
              {coreBacklog.map((b) => {
                const remaining = b.totalRequired - b.totalScheduled
                const isPending = remaining > 0
                return (
                  <tr key={`${b.itemId}-${b.coreBoxCode}`} className="hover:bg-[#FFFFFF]/50 transition-colors">
                    <td className="px-6 py-4 text-center font-mono font-medium">{b.orderNo}</td>
                    <td className="px-6 py-4 text-center font-mono text-[#64748B]">{b.patternRef}</td>
                    <td className="px-6 py-4 text-center font-mono text-[#4F46E5]">{b.coreBoxCode || 'Common'}</td>
                    <td className="px-6 py-4 text-center font-mono">{b.totalRequired}</td>
                    <td className="px-6 py-4 text-center font-mono text-[#4285F4]">{b.totalScheduled}</td>
                    <td className={cn(
                      "px-6 py-4 text-center font-mono font-bold",
                      isPending ? "text-[#EAB308]" : "text-[#10B981]"
                    )}>
                      {remaining}
                    </td>
                  </tr>
                )
              })}
              {coreBacklog.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[#94A3B8] italic">
                    No core planning data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

        </div>
      )}
    </div>
  )
}
