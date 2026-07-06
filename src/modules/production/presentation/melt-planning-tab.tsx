import { useState, useMemo } from 'react'
import { BacklogItem } from './daily-planning-modal'
import { MeltPlanningModal } from './melt-planning-modal'
import { cn } from '@/shared/lib/utils'

interface MeltPlanningTabProps {
  defaultMetalQty: number
  openOrders: any[]
  products: any[]
  patterns: any[]
  dailyPlans: any[]
  onSaveDayPlan: (date: string, plans: any[]) => void
}

export function MeltPlanningTab({ defaultMetalQty, openOrders, products, patterns, dailyPlans, onSaveDayPlan }: MeltPlanningTabProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

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

  // Process melt backlog dynamically from the dailyPlans and openOrders passed
  const meltBacklog = useMemo(() => {
    const backlog: BacklogItem[] = []
    openOrders.forEach(order => {
      order.cart?.forEach((item: any, idx: number) => {
        const uniqueId = `${order.id || order._id}-${idx}`
        const product = products.find(p => p.name === item.productName || p.code === item.product)
        const pattern = patterns.find(p => p.mappedProducts?.some((mp: any) => mp.name === product?.name))
        
        const cavities = product?.cavities || 1
        const plannedQty = item.quantity
        const finalMoulds = Math.ceil(plannedQty / cavities)
        
        const castingWeight = pattern?.totalWeight || 0
        const metalRequired = finalMoulds * castingWeight
        const meltScheduled = dailyPlans.filter(p => p.stage === 'Melt' && p.itemId === uniqueId).reduce((sum, p) => sum + p.quantityScheduled, 0)
        
        if (metalRequired > 0) {
          backlog.push({
            itemId: uniqueId, 
            orderNo: order.customerOrderNo, 
            patternRef: pattern?.code || '-', 
            productName: item.productName,
            totalRequired: metalRequired, 
            totalScheduled: meltScheduled, 
            unit: 'kg'
          })
        }
      })
    })

    // Group by orderNo to consolidate the required amounts
    const grouped = new Map<string, BacklogItem>()
    backlog.forEach(item => {
      const key = `${item.orderNo}|${item.patternRef}`
      if (grouped.has(key)) {
        const existing = grouped.get(key)!
        existing.totalRequired += item.totalRequired
        existing.totalScheduled += item.totalScheduled
      } else {
        grouped.set(key, { ...item })
      }
    })
    return Array.from(grouped.values())
  }, [openOrders, products, patterns, dailyPlans])

  return (
    <div className="space-y-6">
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
            const dateStr = date.toISOString().split('T')[0]
            const isToday = new Date().toISOString().split('T')[0] === dateStr
            const isCurrentMonth = date.getMonth() === new Date().getMonth()
            
            const dayPlans = dailyPlans.filter(p => p.date === dateStr && p.stage === 'Melt')
            const sum = dayPlans.reduce((s, p) => s + p.quantityScheduled, 0)
            const pendingAmount = meltBacklog.reduce((s, b) => s + Math.max(0, b.totalRequired - b.totalScheduled), 0)
            const hasPending = pendingAmount > 0
            
            return (
              <div 
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={cn(
                  "min-h-[100px] p-2 rounded-xl border flex flex-col transition-all cursor-pointer group hover:shadow-md",
                  !isCurrentMonth ? "bg-[#FFFFFF]/50 border-transparent opacity-50" : "bg-[#FFFFFF] border-[#E0E7FF] hover:border-amber-400",
                  isToday && "ring-2 ring-amber-500 ring-offset-2 border-transparent",
                  selectedDate === dateStr && "ring-2 ring-amber-500 border-transparent"
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={cn(
                    "text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full transition-colors",
                    isToday ? "bg-amber-500 text-white" : "text-[#172554] group-hover:bg-amber-50"
                  )}>
                    {date.getDate()}
                  </span>
                  
                  {sum > 0 && (
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                      {sum.toFixed(0)} kg
                    </span>
                  )}
                </div>

                <div className="mt-auto space-y-1">
                  {dayPlans.length === 0 ? (
                    hasPending && isCurrentMonth ? (
                      <div className="text-[10px] text-amber-500/70 font-medium px-1 group-hover:text-amber-600 transition-colors">
                        Click to plan
                      </div>
                    ) : null
                  ) : (
                    <div className="text-[10px] space-y-1">
                      {dayPlans.map((p, idx) => {
                        const order = openOrders.find(o => o.id === p.orderId)
                        return (
                          <div key={idx} className={cn(
                            "truncate px-1.5 py-0.5 rounded border border-amber-100 flex items-center justify-between",
                            p.isConfirmed ? "bg-amber-50" : "bg-gray-50 border-dashed border-gray-200"
                          )}>
                            <span className="font-semibold text-amber-900">{order?.customerOrderNo || 'Melt'}</span>
                            <span className={cn("font-mono", p.isConfirmed ? "text-amber-700" : "text-gray-500")}>
                              {p.quantityScheduled}kg
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selectedDate && (
        <MeltPlanningModal
          isOpen={true}
          onClose={() => setSelectedDate(null)}
          date={selectedDate}
          openOrders={openOrders}
          backlogData={meltBacklog}
          dailyPlans={dailyPlans}
          patterns={patterns}
          products={products}
          onSaveDayPlan={onSaveDayPlan}
        />
      )}
    </div>
  )
}
