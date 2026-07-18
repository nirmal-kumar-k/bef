import { useState, useMemo, useEffect } from 'react'
import { BacklogItem } from './daily-planning-modal'
import { Label } from '@/shared/ui/label'
import { MouldPlanningModal } from './mould-planning-modal'
import { cn, toLocalDateString } from '@/shared/lib/utils'

interface MouldPlanningTabProps {
  mouldBacklog: BacklogItem[]
  patterns: any[]
  openOrders: any[]
  dailyPlans: any[]
  onSaveDayPlan: (date: string, plans: any[]) => void
}

export function MouldPlanningTab({ mouldBacklog, patterns, openOrders, dailyPlans, onSaveDayPlan }: MouldPlanningTabProps) {
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('calendar')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)


  const SHIFT_HOURS = 12.5 // 8:00 AM to 8:30 PM

  // Equipment master is the only source for the per-hour mould production rate
  const [mouldEquipments, setMouldEquipments] = useState<any[]>([])
  useEffect(() => {
    fetch('/api/equipment')
      .then(res => res.json())
      .then(data => setMouldEquipments(data.filter((e: any) => e.type === 'Moulding Machine' && e.isActive)))
      .catch(console.error)
  }, [])

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

  // Calculate capacities
  const totalRemainingMoulds = mouldBacklog.reduce((sum, b) => sum + Math.max(0, b.totalRequired - b.totalScheduled), 0)
  
  // Average mould production rate across active Moulding Machines in equipment
  // master - patterns no longer carry their own rate.
  const averageMouldsPerHour = useMemo(() => {
    const rates = mouldEquipments.map(e => Number(e.avgPiecesPerHour)).filter(r => r > 0)
    return rates.length > 0 ? rates.reduce((s, r) => s + r, 0) / rates.length : 20
  }, [mouldEquipments])

  const shiftCapacity = averageMouldsPerHour * SHIFT_HOURS
  const capacityRatio = totalRemainingMoulds / shiftCapacity
  const daysToComplete = capacityRatio > 0 ? capacityRatio.toFixed(1) : 0

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
              
              const dayPlans = dailyPlans.filter(p => p.date === dateStr && p.stage === 'Mould')
              const sum = dayPlans.reduce((s, p) => s + p.quantityScheduled, 0)
              const pendingAmount = mouldBacklog.reduce((s, b) => s + Math.max(0, b.totalRequired - b.totalScheduled), 0)
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
                    // Schedule all pending backlog to this date
                    const newPlans: any[] = []
                    mouldBacklog.forEach(b => {
                      const remaining = b.totalRequired - b.totalScheduled
                      if (remaining > 0) {
                        newPlans.push({
                          stage: 'Mould',
                          date: dateStr,
                          itemId: b.itemId,
                          productName: b.productName,
                          patternRef: b.patternRef,
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
              const prevDayPlans = dailyPlans.filter(p => p.date === prevDateStr && p.stage === 'Mould')
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
                          <div className="w-1.5 h-1.5 rounded-full bg-[#4F46E5]" />
                          <span className="text-[10.5px] font-medium text-[#64748B]">Moulds</span>
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

          <MouldPlanningModal
            isOpen={!!selectedDate}
            onClose={() => setSelectedDate(null)}
            date={selectedDate || ''}
            openOrders={openOrders}
            backlogData={mouldBacklog}
            patterns={patterns}
            dailyPlans={dailyPlans}
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
                <th className="px-6 py-4 text-center">Product Name</th>
                <th className="px-6 py-4 text-center">Avg Moulds/hr</th>
                <th className="px-6 py-4 text-center">Required</th>
                <th className="px-6 py-4 text-center">Completed</th>
                <th className="px-6 py-4 text-center">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0E7FF] text-[#172554]">
              {mouldBacklog.map((b) => {
                const remaining = b.totalRequired - b.totalScheduled
                const isPending = remaining > 0
                const avgPerHour = averageMouldsPerHour || '-'

                return (
                  <tr key={b.itemId} className="hover:bg-[#FFFFFF]/50 transition-colors">
                    <td className="px-6 py-4 text-center font-mono font-medium">{b.orderNo}</td>
                    <td className="px-6 py-4 text-center font-mono text-[#64748B]">{b.patternRef}</td>
                    <td className="px-6 py-4 text-center font-medium">{b.productName}</td>
                    <td className="px-6 py-4 text-center font-mono text-[#94A3B8]">{avgPerHour}</td>
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
              {mouldBacklog.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[#94A3B8] italic">
                    No mould planning data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Capacity Indicator */}
      {mouldBacklog.length > 0 && (
        <div className="bg-[#FFFFFF] border border-[#E0E7FF] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[#172554] font-semibold flex items-center gap-2">
                Moulding Line Capacity
              </h3>
              <p className="text-xs text-[#64748B] mt-1">Based on {SHIFT_HOURS} hr shift and avg {averageMouldsPerHour.toFixed(1)} moulds/hr</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold font-mono text-[#172554]">{totalRemainingMoulds}</span>
              <span className="text-[#64748B] text-sm ml-2">remaining</span>
            </div>
          </div>

          <div className="relative h-4 bg-[#F4F6FB] rounded-full overflow-hidden border border-[#E0E7FF]">
            <div 
              className="absolute top-0 left-0 h-full bg-[#4F46E5] transition-all"
              style={{ width: `${Math.min(100, (totalRemainingMoulds / (shiftCapacity * 10)) * 100)}%` }}
            />
          </div>
          
          <div className="flex justify-between mt-2 text-xs text-[#94A3B8]">
            <span>1 Shift Capacity: <strong className="text-[#172554] font-mono">{shiftCapacity.toFixed(0)}</strong> moulds</span>
            <span>Est. Time to Complete: <strong className="text-[#4285F4] font-mono">{daysToComplete}</strong> shifts</span>
          </div>
          </div>
        )}
        </div>
      )}
    </div>
  )
}
