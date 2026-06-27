import { useState, useMemo } from 'react'
import { BacklogItem } from './daily-planning-modal'
import { Label } from '@/shared/ui/label'
import { MouldPlanningModal } from './mould-planning-modal'
import { cn } from '@/shared/lib/utils'

interface MouldPlanningTabProps {
  mouldBacklog: BacklogItem[]
  patterns: any[]
  openOrders: any[]
  dailyPlans: any[]
  onSaveDayPlan: (date: string, plans: any[]) => void
}

export function MouldPlanningTab({ mouldBacklog, patterns, openOrders, dailyPlans, onSaveDayPlan }: MouldPlanningTabProps) {
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [draggedType, setDraggedType] = useState<'planned' | 'pending' | null>(null)
  const [draggedPlans, setDraggedPlans] = useState<any[] | null>(null)

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

  // Calculate capacities
  const totalRemainingMoulds = mouldBacklog.reduce((sum, b) => sum + Math.max(0, b.totalRequired - b.totalScheduled), 0)
  
  // Calculate average capacity per shift across all required patterns
  const averageMouldsPerHour = useMemo(() => {
    let sum = 0
    let count = 0
    mouldBacklog.forEach(b => {
      const pattern = patterns.find(p => p.code === b.patternRef)
      if (pattern && pattern.avgMouldsPerHour) {
        sum += Number(pattern.avgMouldsPerHour)
        count++
      }
    })
    return count > 0 ? sum / count : 20 // default 20 if not set
  }, [mouldBacklog, patterns])

  const shiftCapacity = averageMouldsPerHour * SHIFT_HOURS
  const capacityRatio = totalRemainingMoulds / shiftCapacity
  const daysToComplete = capacityRatio > 0 ? capacityRatio.toFixed(1) : 0

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <div className="flex items-center gap-3 bg-[#0C1221] px-4 py-2 border border-[#243050] rounded-xl">
          <Label htmlFor="view-mode" className={cn("text-sm font-semibold cursor-pointer", viewMode === 'table' ? 'text-white' : 'text-[#5A6E90]')} onClick={() => setViewMode('table')}>Table</Label>
          <div 
            className="w-12 h-6 bg-[#050810] rounded-full relative cursor-pointer border border-[#243050]"
            onClick={() => setViewMode(v => v === 'table' ? 'calendar' : 'table')}
          >
            <div className={cn(
              "w-4 h-4 bg-[#D4521A] rounded-full absolute top-0.5 transition-all duration-300",
              viewMode === 'calendar' ? "left-[26px]" : "left-1"
            )} />
          </div>
          <Label htmlFor="view-mode" className={cn("text-sm font-semibold cursor-pointer", viewMode === 'calendar' ? 'text-white' : 'text-[#5A6E90]')} onClick={() => setViewMode('calendar')}>Calendar</Label>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <div className="bg-[#050810] border border-[#243050] rounded-xl overflow-hidden relative flex flex-col">
          <div className="grid grid-cols-7 border-b border-[#243050] bg-[#0C1221]">
            {weekDays.map(day => (
              <div key={day} className="py-3 text-center text-xs font-semibold text-[#8B9FC4] uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 bg-[#243050] gap-[1px] flex-1">
            {days.map((date, i) => {
              const dateStr = date.toISOString().split('T')[0]
              const isToday = new Date().toISOString().split('T')[0] === dateStr
              const isCurrentMonth = date.getMonth() === new Date().getMonth()
              
              const dayPlans = dailyPlans.filter(p => p.date === dateStr && p.stage === 'Mould')
              const sum = dayPlans.reduce((s, p) => s + p.quantityScheduled, 0)
              const hasPending = mouldBacklog.some(b => (b.totalRequired - b.totalScheduled) > 0)

              const handleDrop = (e: React.DragEvent) => {
                e.preventDefault()
                if (draggedType === 'planned' && draggedPlans && draggedPlans.length > 0 && draggedPlans[0].date !== dateStr) {
                  const updates = draggedPlans.map(p => ({ ...p, date: dateStr }))
                  onSaveDayPlan(dateStr, updates)
                } else if (draggedType === 'pending') {
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
                setDraggedType(null)
                setDraggedPlans(null)
              }

              return (
                <div 
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className={cn(
                    "bg-[#050810] p-2 hover:bg-[#0C1221] transition-colors cursor-pointer flex flex-col min-h-[120px] border-[1px] border-transparent hover:border-[#D4521A]/20",
                    !isCurrentMonth && "opacity-50"
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={cn(
                      "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                      isToday ? "bg-[#D4521A] text-white" : "text-[#8B9FC4]"
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
                          setDraggedType('planned')
                          setDraggedPlans(dayPlans)
                        }}
                        className="px-2 py-1 text-[10px] font-bold uppercase rounded-md bg-[#D4521A]/10 text-[#D4521A] border border-[#D4521A]/20 truncate cursor-grab shadow-md"
                      >
                        Moulds {sum}
                      </div>
                    )}
                    {isToday && hasPending && (
                      <div 
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation()
                          setDraggedType('pending')
                        }}
                        className="px-2 py-1 text-[10px] font-bold uppercase rounded-md bg-red-500/10 text-red-500 border border-red-500/20 mt-2 truncate cursor-grab shadow-md"
                      >
                        Pending Backlog
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
          <div className="bg-[#050810] border border-[#243050] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#0C1221] border-b border-[#243050] text-[#8B9FC4] text-[11px] uppercase tracking-wider font-bold">
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
            <tbody className="divide-y divide-[#243050] text-[#EEF3FF]">
              {mouldBacklog.map((b) => {
                const remaining = b.totalRequired - b.totalScheduled
                const isPending = remaining > 0
                const pattern = patterns.find(p => p.code === b.patternRef)
                const avgPerHour = pattern?.avgMouldsPerHour || '-'

                return (
                  <tr key={b.itemId} className="hover:bg-[#0C1221]/50 transition-colors">
                    <td className="px-6 py-4 text-center font-mono font-medium">{b.orderNo}</td>
                    <td className="px-6 py-4 text-center font-mono text-[#8B9FC4]">{b.patternRef}</td>
                    <td className="px-6 py-4 text-center font-medium">{b.productName}</td>
                    <td className="px-6 py-4 text-center font-mono text-[#5A6E90]">{avgPerHour}</td>
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
                  <td colSpan={7} className="px-6 py-12 text-center text-[#5A6E90] italic">
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
        <div className="bg-[#0C1221] border border-[#243050] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[#EEF3FF] font-semibold flex items-center gap-2">
                Moulding Line Capacity
              </h3>
              <p className="text-xs text-[#8B9FC4] mt-1">Based on {SHIFT_HOURS} hr shift and avg {averageMouldsPerHour.toFixed(1)} moulds/hr</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold font-mono text-[#EEF3FF]">{totalRemainingMoulds}</span>
              <span className="text-[#8B9FC4] text-sm ml-2">remaining</span>
            </div>
          </div>

          <div className="relative h-4 bg-[#050810] rounded-full overflow-hidden border border-[#243050]">
            <div 
              className="absolute top-0 left-0 h-full bg-[#D4521A] transition-all"
              style={{ width: `${Math.min(100, (totalRemainingMoulds / (shiftCapacity * 10)) * 100)}%` }}
            />
          </div>
          
          <div className="flex justify-between mt-2 text-xs text-[#5A6E90]">
            <span>1 Shift Capacity: <strong className="text-[#EEF3FF] font-mono">{shiftCapacity.toFixed(0)}</strong> moulds</span>
            <span>Est. Time to Complete: <strong className="text-[#4285F4] font-mono">{daysToComplete}</strong> shifts</span>
          </div>
          </div>
        )}
        </div>
      )}
    </div>
  )
}
