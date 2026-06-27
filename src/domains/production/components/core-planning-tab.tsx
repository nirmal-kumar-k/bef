import { useState, useMemo } from 'react'
import { BacklogItem } from './daily-planning-modal'
import { Input } from '@/shared/ui/input'
import { Button } from '@/shared/ui/button'
import { Label } from '@/shared/ui/label'
import { CorePlanningModal } from './core-planning-modal'
import { cn } from '@/shared/lib/utils'

interface CorePlanningTabProps {
  coreBacklog: BacklogItem[]
  patterns: any[]
  openOrders: any[]
  dailyPlans: any[]
  onSaveDayPlan: (date: string, plans: any[]) => void
}

export function CorePlanningTab({ coreBacklog, patterns, openOrders, dailyPlans, onSaveDayPlan }: CorePlanningTabProps) {
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  
  // Workers state per core box code
  const [workersPerBox, setWorkersPerBox] = useState<Record<string, number>>({})

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

  // Group backlog by Core Box to calculate Shift Planning
  const shiftPlanningData = useMemo(() => {
    const boxMap = new Map<string, { totalRequired: number, avgProduction: number, patternRef: string }>()
    
    coreBacklog.forEach(b => {
      if (!b.coreBoxCode) return
      
      const pattern = patterns.find(p => p.code === b.patternRef)
      // Wait, is avgCoreProduction per core box or per pattern?
      // The prompt says "Average Core Production per person per hour from Pattern".
      const avgProd = Number(pattern?.avgCoreProduction) || 10 // fallback to 10 if not set

      if (!boxMap.has(b.coreBoxCode)) {
        boxMap.set(b.coreBoxCode, { totalRequired: 0, avgProduction: avgProd, patternRef: b.patternRef })
      }
      
      const existing = boxMap.get(b.coreBoxCode)!
      existing.totalRequired += Math.max(0, b.totalRequired - b.totalScheduled) // Remaining
    })
    
    return Array.from(boxMap.entries()).map(([code, data]) => ({
      code,
      ...data
    }))
  }, [coreBacklog, patterns])

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
              
              const dayPlans = dailyPlans.filter(p => p.date === dateStr && p.stage === 'Core')
              const sum = dayPlans.reduce((s, p) => s + p.quantityScheduled, 0)
              const hasPending = coreBacklog.some(b => (b.totalRequired - b.totalScheduled) > 0)

              const prevDate = new Date(date)
              prevDate.setDate(date.getDate() - 1)
              const prevDateStr = prevDate.toISOString().split('T')[0]
              const prevDayPlans = dailyPlans.filter(p => p.date === prevDateStr && p.stage === 'Core')
              const hasCarryForward = prevDayPlans.some(p => p.actualQuantity !== undefined && p.actualQuantity < p.quantityScheduled)

              return (
                <div 
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={cn(
                    "bg-[#050810] p-2 hover:bg-[#0C1221] transition-colors cursor-pointer flex flex-col min-h-[120px]",
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
                      <div className="px-2 py-1 text-[10px] font-bold uppercase rounded-md bg-[#4285F4]/10 text-[#4285F4] border border-[#4285F4]/20 truncate">
                        Core {sum}
                      </div>
                    )}
                    {hasCarryForward && (
                      <div className="px-2 py-1 text-[10px] font-bold uppercase rounded-md bg-red-500/10 text-red-500 border border-red-500/20 mt-2 truncate">
                        PENDING
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
          <div className="bg-[#050810] border border-[#243050] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#0C1221] border-b border-[#243050] text-[#8B9FC4] text-[11px] uppercase tracking-wider font-bold">
              <tr>
                <th className="px-6 py-4 text-center">Order No</th>
                <th className="px-6 py-4 text-center">Pattern Ref</th>
                <th className="px-6 py-4 text-center">Core Box</th>
                <th className="px-6 py-4 text-center">Required</th>
                <th className="px-6 py-4 text-center">Completed</th>
                <th className="px-6 py-4 text-center">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#243050] text-[#EEF3FF]">
              {coreBacklog.map((b) => {
                const remaining = b.totalRequired - b.totalScheduled
                const isPending = remaining > 0
                return (
                  <tr key={`${b.itemId}-${b.coreBoxCode}`} className="hover:bg-[#0C1221]/50 transition-colors">
                    <td className="px-6 py-4 text-center font-mono font-medium">{b.orderNo}</td>
                    <td className="px-6 py-4 text-center font-mono text-[#8B9FC4]">{b.patternRef}</td>
                    <td className="px-6 py-4 text-center font-mono text-[#D4521A]">{b.coreBoxCode || 'Common'}</td>
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
                  <td colSpan={6} className="px-6 py-12 text-center text-[#5A6E90] italic">
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
