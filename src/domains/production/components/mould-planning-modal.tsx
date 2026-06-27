import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { BacklogItem } from './daily-planning-modal'
import { CubeTransparent, CaretDown, CaretUp } from '@phosphor-icons/react'
import { cn } from '@/shared/lib/utils'

const TIME_SLOTS = [
  '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', 
  '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM', '07:00 PM'
]
const SHIFT_HOURS = 12.5

interface MouldPlanningModalProps {
  isOpen: boolean
  onClose: () => void
  date: string
  openOrders: any[]
  backlogData: BacklogItem[]
  dailyPlans: any[] // existing plans for this date and stage
  patterns: any[]
  onSaveDayPlan: (date: string, plans: any[]) => void
}

export function MouldPlanningModal({
  isOpen,
  onClose,
  date,
  openOrders,
  backlogData,
  dailyPlans,
  patterns,
  onSaveDayPlan
}: MouldPlanningModalProps) {
  const [selectedOrder, setSelectedOrder] = useState<string>('')
  
  // State maps keyed by Pattern Code
  const [hourlyMatrix, setHourlyMatrix] = useState<Record<string, Record<string, number>>>({})
  const [workers, setWorkers] = useState<Record<string, Record<string, number>>>({})
  const [actuals, setActuals] = useState<Record<string, number>>({})

  // Initialization when order changes or modal opens
  useEffect(() => {
    if (isOpen && !selectedOrder && openOrders.length > 0) {
      // Don't auto-select to match UI specification, but we can reset states
      setHourlyMatrix({})
      setWorkers({})
      setActuals({})
    }
  }, [isOpen, selectedOrder, openOrders.length])

  useEffect(() => {
    if (!selectedOrder) return

    const order = openOrders.find(o => o.id === selectedOrder)
    if (!order) return

    const existingPlans = dailyPlans.filter(p => p.orderId === selectedOrder && p.stage === 'Core')
    
    const initMatrix: Record<string, Record<string, number>> = {}
    const initWorkers: Record<string, Record<string, number>> = {}
    const initActuals: Record<string, number> = {}

    // Pre-fill from existing plans
    existingPlans.forEach(p => {
      if (p.patternRef) {
        initMatrix[p.patternRef] = p.hourlyTargets || {}
        initWorkers[p.patternRef] = p.hourlyWorkers || {}
        if (p.actualQuantity !== undefined && p.actualQuantity !== null) {
          initActuals[p.patternRef] = p.actualQuantity
        }
      }
    })

    setHourlyMatrix(initMatrix)
    setWorkers(initWorkers)
    setActuals(initActuals)
  }, [selectedOrder, dailyPlans, openOrders])

  const handleSave = () => {
    if (!selectedOrder) return

    const order = openOrders.find(o => o.id === selectedOrder)
    if (!order) return

    const orderCoreBacklog = backlogData.filter(b => b.orderNo === order.customerOrderNo)
    const plansToSave: any[] = []

    // Save plans for any core box that has hourly targets or workers
    Object.keys(hourlyMatrix).forEach(code => {
      const hours = hourlyMatrix[code] || {}
      const totalScheduled = Object.values(hours).reduce((sum, val) => sum + (val || 0), 0)
      
      if (totalScheduled > 0 || workers[code] > 0 || actuals[code] !== undefined) {
        const backlog = orderCoreBacklog.find(b => b.patternRef === code)
        const maxWorkers = workers[code] && Object.values(workers[code]).length > 0 
          ? Math.max(...Object.values(workers[code])) 
          : 1
          
        plansToSave.push({
          orderId: selectedOrder,
          itemId: backlog?.itemId || `${selectedOrder}-0`,
          stage: 'Mould',
          patternRef: code,
          quantityScheduled: totalScheduled,
          laborersAssigned: maxWorkers,
          workersAssigned: maxWorkers,
          hourlyTargets: hours,
          hourlyWorkers: workers[code] || {},
          actualQuantity: actuals[code]
        })
      }
    })

    onSaveDayPlan(date, plansToSave)
    onClose()
  }

  // Derived Data
  const order = openOrders.find(o => o.id === selectedOrder)
  const orderMouldBacklogs = order ? backlogData.filter(b => b.orderNo === order.customerOrderNo) : []
  
  const getColTotal = (code: string) => {
    const hours = hourlyMatrix[code] || {}
    return Object.values(hours).reduce((sum, val) => sum + (val || 0), 0)
  }

  const getRowTotal = (timeSlot: string) => {
    return Object.keys(hourlyMatrix).reduce((sum, code) => sum + (hourlyMatrix[code][timeSlot] || 0), 0)
  }

  const getGrandTotal = () => {
    return Object.keys(hourlyMatrix).reduce((sum, code) => sum + getColTotal(code), 0)
  }

  // Hourly input change
  const handleHourlyChange = (code: string, timeSlot: string, value: string) => {
    const numValue = value === '' ? 0 : parseInt(value, 10)
    setHourlyMatrix(prev => ({
      ...prev,
      [code]: {
        ...(prev[code] || {}),
        [timeSlot]: numValue
      }
    }))
  }

  const handleWorkerChange = (code: string, timeSlot: string, delta: number) => {
    setWorkers(prev => {
      const codeWorkers = prev[code] || {}
      const current = codeWorkers[timeSlot] || 0
      const next = Math.max(0, current + delta)
      return { ...prev, [code]: { ...codeWorkers, [timeSlot]: next } }
    })
  }

  const getExpectedOutput = (code: string, avgProd: number) => {
    const codeWorkers = workers[code] || {}
    let totalExpected = 0
    TIME_SLOTS.forEach(slot => {
      const w = codeWorkers[slot] || 0
      const hours = slot === '07:00 PM' ? 1.5 : 1
      totalExpected += w * avgProd * hours
    })
    return totalExpected
  }

  // Section 1: Top-level fill (distributes equally across hours for quick entry)
  const handleFillRemaining = (code: string, remaining: number) => {
    const perHour = Math.floor(remaining / 12)
    const remainder = remaining % 12
    
    const newHours: Record<string, number> = {}
    TIME_SLOTS.forEach((slot, idx) => {
      newHours[slot] = perHour + (idx === 0 ? remainder : 0) // dump remainder in first hour
    })
    
    setHourlyMatrix(prev => ({
      ...prev,
      [code]: newHours
    }))
  }

  const dateObj = new Date(date || new Date())
  const dateString = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  // Active Patternes for the table (we show all from the order backlog)
  const activeMoulds = orderMouldBacklogs

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-[95vw] md:max-w-[800px] lg:max-w-[1000px] xl:max-w-[1200px] min-h-[60vh] max-h-[90vh] bg-[#050810] border-[#243050] text-foreground p-0 shadow-2xl">
        <div className="flex flex-col w-full max-h-[90vh]">
          <DialogHeader className="p-6 pb-4 border-b border-[#243050] shrink-0">
          <div>
            <DialogTitle className="text-xl font-heading text-white">
              {dateString}
            </DialogTitle>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md border flex items-center gap-1 text-[#4285F4] border-[#4285F4]/20 bg-[#4285F4]/10">
                <CubeTransparent weight="bold" className="w-3 h-3" />
                MOULD PLANNING
              </span>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-8">
          {/* SECTION 1: Order & Patternes */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Select Order</Label>
              <Select value={selectedOrder} onValueChange={setSelectedOrder}>
                <SelectTrigger className="w-full max-w-2xl h-12 text-base bg-[#0C1221] border-[#243050] text-[#EEF3FF] shadow-sm">
                  <SelectValue placeholder="Select active customer order..." />
                </SelectTrigger>
                <SelectContent className="bg-[#0C1221] border-[#243050] max-h-60">
                  {openOrders.map(o => (
                    <SelectItem key={o.id} value={o.id} className="text-[#EEF3FF] hover:bg-[#1A263D] focus:bg-[#1A263D]">
                      <span className="font-mono text-[#4285F4] mr-2">{o.customerOrderNo}</span> {o.customer}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedOrder && activeMoulds.length > 0 && (
              <div className="flex flex-wrap gap-4 mt-4">
                {activeMoulds.map(cb => {
                  const remaining = Math.max(0, cb.totalRequired - cb.totalScheduled)
                  const plannedForDay = getColTotal(cb.patternRef!)
                  const pattern = patterns.find(p => p.code === cb.patternRef)
                  const mouldingType = pattern?.category || 'Machine Moulding'
                  
                  
                  return (
                    <div key={cb.patternRef} className="bg-gradient-to-br from-[#0C1221] to-[#1A263D] p-5 rounded-xl border border-[#243050] min-w-[280px] flex-1 shadow-md">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-[#EEF3FF] font-mono font-bold text-base">{cb.patternRef}</h4>
                          <span className="text-[10px] text-[#4285F4] uppercase font-bold tracking-wider">{mouldingType}</span>
                        </div>
                        <span className="text-xs font-medium text-[#8B9FC4] bg-[#050810] px-2.5 py-1 rounded-md border border-[#243050]">Remaining: {remaining}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 text-sm text-[#8B9FC4]">Planned Today:</div>
                        <span className="font-mono text-[#4285F4] font-bold text-2xl">{plannedForDay}</span>
                        {remaining > 0 && plannedForDay === 0 && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-xs h-8 px-3 ml-2 text-[#4285F4] hover:bg-[#4285F4]/10 border border-[#4285F4]/30 bg-[#4285F4]/5 transition-colors"
                            onClick={() => handleFillRemaining(cb.patternRef!, remaining)}
                          >
                            Fill
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {selectedOrder && activeMoulds.length === 0 && (
              <p className="text-sm text-[#5A6E90] italic">No moulds mapped for this order.</p>
            )}
          </div>

          {/* SECTION 2: Shift Time Table */}
          {selectedOrder && activeMoulds.length > 0 && (
            <div className="space-y-3">
              <Label className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Shift Time Table</Label>
              <div className="border border-[#243050] rounded-xl overflow-x-auto bg-[#050810]">
                <table className="w-full text-xs text-left whitespace-nowrap">
                  <thead className="bg-[#0C1221] border-b border-[#243050] text-[#8B9FC4] uppercase tracking-wider font-bold">
                    <tr>
                      <th rowSpan={2} className="px-6 py-4 sticky left-0 bg-[#0C1221] z-10 w-40 whitespace-nowrap text-xs align-bottom pb-6">Time Slot</th>
                      {activeMoulds.map(cb => {
                        const pattern = patterns.find(p => p.code === cb.patternRef)
                        const mouldingType = pattern?.category || 'Machine Moulding'
                        return (
                          <th key={cb.patternRef} colSpan={2} className="px-4 py-3 text-center text-[#4285F4] font-mono text-base border-b border-[#243050]/50">
                            {cb.patternRef}
                            <div className="text-[9px] text-[#5A6E90] tracking-wider mt-1 font-semibold">{mouldingType}</div>
                          </th>
                        )
                      })}
                      <th rowSpan={2} className="px-6 py-4 text-center text-[#EEF3FF] whitespace-nowrap w-40 align-bottom pb-6">Slot Total</th>
                    </tr>
                    <tr>
                      {activeMoulds.map(cb => [
                        <th key={`${cb.patternRef}-hourly`} className="px-2 py-2 text-center text-[10px] text-[#5A6E90] w-32 font-medium border-r border-[#243050]/20">HOURLY PLAN</th>,
                        <th key={`${cb.patternRef}-assign`} className="px-2 py-2 text-center text-[10px] text-[#5A6E90] w-56 font-medium">LABOURER ASSIGNMENT</th>
                      ])}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#243050]">
                    {TIME_SLOTS.map((slot, index) => (
                      <tr key={slot} className="hover:bg-[#0C1221]/50 transition-colors">
                        <td className="px-6 py-3 font-mono font-semibold text-sm text-[#EEF3FF] sticky left-0 bg-[#050810] z-10 whitespace-nowrap">
                          {slot}
                          {slot === '07:00 PM' && <span className="text-[10px] text-[#5A6E90] block mt-0.5 font-normal">- 08:30 PM</span>}
                        </td>
                        {activeMoulds.map(cb => {
                          const val = hourlyMatrix[cb.patternRef!]?.[slot]
                          const workerCount = workers[cb.patternRef!]?.[slot] || 0
                          
                          return [
                            <td key={`${cb.patternRef}-input`} className="px-2 py-2 text-center border-r border-[#243050]/20">
                              <Input
                                type="number"
                                min="0"
                                value={val || ''}
                                onChange={e => handleHourlyChange(cb.patternRef!, slot, e.target.value)}
                                className="w-20 h-9 mx-auto bg-[#0C1221] border-transparent hover:border-[#243050] focus:border-[#4285F4] text-[#EEF3FF] font-mono text-center px-2 text-sm shadow-inner"
                                placeholder="-"
                              />
                            </td>,
                            <td key={`${cb.patternRef}-assign`} className="px-2 py-2 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="h-6 w-6 bg-[#050810] border-[#243050] text-[#EEF3FF] hover:bg-[#1A263D]"
                                  onClick={() => handleWorkerChange(cb.patternRef!, slot, -1)}
                                >
                                  -
                                </Button>
                                <span className="font-mono font-medium text-[#EEF3FF] w-4 text-center text-sm">{workerCount}</span>
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="h-6 w-6 bg-[#050810] border-[#243050] text-[#EEF3FF] hover:bg-[#1A263D]"
                                  onClick={() => handleWorkerChange(cb.patternRef!, slot, 1)}
                                >
                                  +
                                </Button>
                              </div>
                            </td>
                          ]
                        })}
                        <td className="px-6 py-3 font-mono font-bold text-center text-[#8B9FC4] bg-[#0C1221]/30">
                          {getRowTotal(slot)}
                        </td>
                      </tr>
                    ))}
                    {/* Totals Row */}
                    <tr className="bg-[#1A263D] border-t-2 border-[#243050]">
                      <td className="px-6 py-4 font-bold text-sm text-[#EEF3FF] sticky left-0 bg-[#1A263D] z-10">COLUMN TOTAL</td>
                      {activeMoulds.map(cb => {
                        const plannedTarget = getColTotal(cb.patternRef!)
                        const pattern = patterns.find(p => p.code === cb.patternRef)
                        const avgProd = Number(pattern?.avgMouldsPerHour) || 10
                        const expectedOutput = getExpectedOutput(cb.patternRef!, avgProd)
                        
                        const isOverrun = expectedOutput > plannedTarget && expectedOutput > 0 && expectedOutput > (plannedTarget * 1.1)
                        const isOnTrack = expectedOutput >= plannedTarget && expectedOutput > 0 && !isOverrun
                        
                        const totalWorkers = Math.max(0, ...Object.values(workers[cb.patternRef!] || {}))

                        return [
                          <td key={`${cb.patternRef}-total`} className="px-4 py-4 text-center font-mono font-bold text-lg text-[#4285F4] border-r border-[#243050]/20">
                            {plannedTarget}
                          </td>,
                          <td key={`${cb.patternRef}-expected`} className="bg-[#1A263D] px-2 py-4 align-middle">
                            <div className="flex flex-col items-center justify-center space-y-1.5">
                              <span className="text-[10px] text-[#EEF3FF] font-mono font-bold">Exp: {expectedOutput.toFixed(0)}</span>
                              {totalWorkers === 0 ? (
                                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-[#050810] text-[#8B9FC4] border border-[#243050]">Unassigned</span>
                              ) : isOnTrack ? (
                                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20">On Track</span>
                              ) : isOverrun ? (
                                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">Overrun</span>
                              ) : (
                                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">At Risk</span>
                              )}
                            </div>
                          </td>
                        ]
                      })}
                      <td className="px-6 py-4 font-mono font-bold text-center text-[#EEF3FF] text-xl bg-[#D4521A]/20">
                        {getGrandTotal()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 3: Actual Entry */}
          {selectedOrder && activeMoulds.length > 0 && (
            <div className="border border-[#243050] rounded-xl overflow-hidden mt-8">
              <div className="w-full flex items-center justify-between bg-[#1A263D] p-4 text-[#EEF3FF]">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm">End of Day — Actual Entry</h3>
                  <span className="text-xs text-[#8B9FC4]">Enter produced quantities</span>
                </div>
              </div>
              
              <div className="p-4 bg-[#050810] space-y-3">
                  {activeMoulds.map(cb => {
                    const planned = getColTotal(cb.patternRef!)
                    const act = actuals[cb.patternRef!]
                    const hasAct = act !== undefined
                    const variance = hasAct ? act - planned : 0
                    
                    return (
                      <div key={cb.patternRef} className="flex items-center gap-4 p-3 bg-[#0C1221] border border-[#243050] rounded-lg">
                        <div className="w-32">
                          <h4 className="text-[#EEF3FF] font-mono font-bold text-sm">{cb.patternRef}</h4>
                        </div>
                        <div className="w-24">
                          <span className="text-[10px] text-[#8B9FC4] block uppercase font-bold mb-1">Planned</span>
                          <span className="font-mono text-[#EEF3FF]">{planned}</span>
                        </div>
                        <div className="w-32">
                          <span className="text-[10px] text-[#4285F4] block uppercase font-bold mb-1">Actual</span>
                          <Input
                            type="number"
                            min="0"
                            value={act === undefined ? '' : act}
                            onChange={e => setActuals(prev => ({ ...prev, [cb.patternRef!]: e.target.value === '' ? undefined : Number(e.target.value) })) as any}
                            className="h-8 bg-[#050810] border-[#243050] text-[#EEF3FF] font-mono px-2 text-sm w-full"
                            placeholder="0"
                          />
                        </div>
                        <div className="w-24 text-right ml-auto">
                          <span className="text-[10px] text-[#8B9FC4] block uppercase font-bold mb-1">Variance</span>
                          {hasAct ? (
                            <span className={cn(
                              "font-mono font-bold text-lg",
                              variance > 0 ? "text-green-500" : variance < 0 ? "text-red-500" : "text-[#8B9FC4]"
                            )}>
                              {variance > 0 ? '+' : ''}{variance}
                            </span>
                          ) : (
                            <span className="text-[#5A6E90]">-</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  <p className="text-[10px] text-[#8B9FC4] italic mt-2">
                    * If Actual &lt; Planned, the deficit will be carried forward to tomorrow as Pending.
                  </p>
                </div>
            </div>
          )}
        </div>

        <DialogFooter className="m-0 p-4 border-t border-[#243050] bg-[#0C1221] shrink-0 rounded-b-xl sm:justify-end">
          <Button variant="outline" onClick={onClose} className="border-[#243050] text-[#8B9FC4] hover:text-[#EEF3FF]">Cancel</Button>
          <Button onClick={handleSave} className="bg-[#D4521A] text-white hover:bg-[#D4521A]/90 shadow-[0_0_15px_rgba(212,82,26,0.3)]">Save Day Plan</Button>
        </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
