import { useState, useMemo, useEffect } from 'react'
import { BacklogItem } from './daily-planning-modal'
import { Label } from '@/shared/ui/label'
import { KnockoutPlanningModal } from './knockout-planning-modal'
import { cn, toLocalDateString } from '@/shared/lib/utils'

interface KnockoutPlanningTabProps {
  knockoutBacklog: BacklogItem[] // pieces, not moulds - required = poured moulds x cavities
  openOrders: any[]
  dailyPlans: any[]
  onSaveDayPlan: (date: string, plans: any[]) => void
}

export function KnockoutPlanningTab({ knockoutBacklog, openOrders, dailyPlans, onSaveDayPlan }: KnockoutPlanningTabProps) {
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('calendar')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Equipment master is the only source for the per-hour knockout production rate
  const [knockoutEquipments, setKnockoutEquipments] = useState<any[]>([])
  useEffect(() => {
    fetch('/api/equipment')
      .then(res => res.json())
      .then(data => setKnockoutEquipments(data.filter((e: any) => e.type === 'Knockout' && e.isActive)))
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

  // Aggregate capacities (pieces)
  const totalRemainingPieces = knockoutBacklog.reduce((sum, b) => sum + Math.max(0, b.totalRequired - b.totalScheduled), 0)

  const totalPossibleCapacity = knockoutEquipments.reduce((sum, e) => sum + (Number(e.avgPiecesPerHour) || 0), 0) * SHIFT_HOURS
  const pendingPreview = useMemo(() => {
    if (totalRemainingPieces <= 0 || totalPossibleCapacity <= 0) return null
    const cursor = new Date()
    cursor.setHours(0, 0, 0, 0)
    const maxLookaheadDays = 60
    for (let i = 0; i < maxLookaheadDays; i++) {
      cursor.setDate(cursor.getDate() + 1)
      const cursorStr = toLocalDateString(cursor)
      const dayScheduled = dailyPlans
        .filter(p => p.date === cursorStr && p.stage === 'Knockout')
        .reduce((s, p) => s + p.quantityScheduled, 0)
      const dayFreeCapacity = Math.max(0, totalPossibleCapacity - dayScheduled)
      if (dayFreeCapacity > 0) {
        return { date: cursorStr, amount: Math.min(totalRemainingPieces, dayFreeCapacity) }
      }
    }
    return null
  }, [dailyPlans, totalRemainingPieces, totalPossibleCapacity])

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <div className="flex items-center gap-3 bg-[#FFFFFF] px-4 py-1.5 border border-[#E0E7FF] rounded-xl shadow-sm">
          <Label htmlFor="view-mode" className={cn("text-sm font-semibold cursor-pointer transition-colors duration-200", viewMode === 'table' ? 'text-[#172554]' : 'text-[#94A3B8]')} onClick={() => setViewMode('table')}>Table</Label>
          <div
            className="w-12 h-6 bg-[#F4F6FB] rounded-full relative cursor-pointer border border-[#E0E7FF] shadow-inner transition-colors duration-200 hover:bg-[#F3E8FF]"
            onClick={() => setViewMode(v => v === 'table' ? 'calendar' : 'table')}
          >
            <div className={cn(
              "w-4 h-4 bg-[#7C3AED] rounded-full absolute top-[3px] transition-all duration-300 shadow-sm",
              viewMode === 'calendar' ? "left-[27px]" : "left-[3px]"
            )} />
          </div>
          <Label htmlFor="view-mode" className={cn("text-sm font-semibold cursor-pointer transition-colors duration-200", viewMode === 'calendar' ? 'text-[#172554]' : 'text-[#94A3B8]')} onClick={() => setViewMode('calendar')}>Calendar</Label>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <div className="bg-[#F5F3FF] border border-[#E9D5FF] rounded-xl relative flex flex-col p-4 overflow-x-auto">
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

              const dayPlans = dailyPlans.filter(p => p.date === dateStr && p.stage === 'Knockout')
              const sum = dayPlans.reduce((s, p) => s + p.quantityScheduled, 0)

              const handleDrop = (e: React.DragEvent) => {
                e.preventDefault()
                try {
                  const dataStr = e.dataTransfer.getData('text/plain')
                  if (!dataStr) return
                  const data = JSON.parse(dataStr)

                  if (data.type === 'planned' && data.plans && data.plans.length > 0 && data.plans[0].date !== dateStr) {
                    const updates = data.plans.map((p: any) => ({ ...p, date: dateStr }))
                    onSaveDayPlan(dateStr, updates)
                  }
                } catch (err) {
                  console.error('Drop parse error', err)
                }
              }

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
                    "bg-[#FFFFFF] p-2 rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:-translate-y-[2px] transition-all duration-300 ease-out cursor-pointer flex flex-col min-h-[120px] border border-[#E9D5FF] hover:border-[#7C3AED] hover:shadow-[0_4px_14px_rgba(124,58,237,0.12)] group overflow-hidden relative",
                    !isCurrentMonth && "bg-[#F8FAFC]/50 opacity-70 hover:opacity-100"
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={cn(
                      "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                      isToday ? "bg-[#7C3AED] text-white" : "text-[#64748B]"
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
                          <div className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]" />
                          <span className="text-[10.5px] font-medium text-[#64748B]">Day Production</span>
                        </div>
                        <span className="text-[10.5px] font-bold text-[#0F172A]">{sum} pcs</span>
                      </div>
                    )}
                    {pendingPreview && dateStr === pendingPreview.date && (
                      <div
                        title="Combined possible output across all active Knockout machines for one shift, minus what that day already has scheduled - rolls forward until a day with free capacity is found"
                        className="flex items-center justify-between px-1.5 py-1 bg-red-50/50 rounded-md mt-1"
                      >
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-[10.5px] font-medium text-red-600">Pending</span>
                        </div>
                        <span className="text-[10.5px] font-bold text-red-600">{Math.round(pendingPreview.amount)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <KnockoutPlanningModal
            isOpen={!!selectedDate}
            onClose={() => setSelectedDate(null)}
            date={selectedDate || ''}
            openOrders={openOrders}
            backlogData={knockoutBacklog}
            dailyPlans={selectedDate ? dailyPlans.filter(p => p.date === selectedDate && p.stage === 'Knockout') : []}
            onSaveDayPlan={onSaveDayPlan}
            onNavigateDate={(direction) => {
              setSelectedDate(prev => {
                if (!prev) return prev
                const d = new Date(`${prev}T00:00:00`)
                d.setDate(d.getDate() + direction)
                return toLocalDateString(d)
              })
            }}
          />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Table View */}
          <div className="bg-[#F5F3FF] border border-[#E9D5FF] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#FFFFFF] border-b border-[#E9D5FF] text-[#64748B] text-[11px] uppercase tracking-wider font-bold">
              <tr>
                <th className="px-6 py-4 text-center">Order No</th>
                <th className="px-6 py-4 text-center">Pattern Ref</th>
                <th className="px-6 py-4 text-center">Product</th>
                <th className="px-6 py-4 text-center">Required (pcs)</th>
                <th className="px-6 py-4 text-center">Completed (pcs)</th>
                <th className="px-6 py-4 text-center">Remaining (pcs)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9D5FF] text-[#172554]">
              {knockoutBacklog.map((b) => {
                const remaining = b.totalRequired - b.totalScheduled
                const isPending = remaining > 0
                return (
                  <tr key={b.itemId} className="hover:bg-[#FFFFFF]/50 transition-colors">
                    <td className="px-6 py-4 text-center font-mono font-medium">{b.orderNo}</td>
                    <td className="px-6 py-4 text-center font-mono text-[#64748B]">{b.patternRef}</td>
                    <td className="px-6 py-4 text-center font-medium">{b.productName}</td>
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
              {knockoutBacklog.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[#94A3B8] italic">
                    No knockout planning data available
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
