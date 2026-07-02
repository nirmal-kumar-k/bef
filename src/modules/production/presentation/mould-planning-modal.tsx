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

import { generateTimeSlots, TimeSlot } from '@/shared/lib/utils'
import type { Shift } from './shift-master-page'

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
  
  // Equipment
  const [equipments, setEquipments] = useState<any[]>([])
  const [selectedEquipments, setSelectedEquipments] = useState<Record<string, string>>({})
  
  // Shifts
  const [shifts, setShifts] = useState<Shift[]>([])
  const [selectedShiftId, setSelectedShiftId] = useState<string>('')

  // Fetch shifts & equipments
  useEffect(() => {
    if (isOpen) {
      if (shifts.length === 0) {
        fetch('/api/shifts')
          .then(res => res.json())
          .then(data => {
            const activeShifts = data.filter((s: Shift) => s.isActive)
            setShifts(activeShifts)
            if (activeShifts.length > 0 && !selectedShiftId) {
              setSelectedShiftId(activeShifts[0].id)
            }
          })
          .catch(console.error)
      }
      if (equipments.length === 0) {
        fetch('/api/equipment')
          .then(res => res.json())
          .then(data => {
            const mouldEquips = data.filter((e: any) => e.type === 'Moulding Machine' && e.isActive)
            setEquipments(mouldEquips)
          })
          .catch(console.error)
      }
    }
  }, [isOpen])

  const selectedShift = shifts.find(s => s.id === selectedShiftId) || shifts[0]
  const TIME_SLOTS: TimeSlot[] = selectedShift 
    ? generateTimeSlots(selectedShift.startTime, selectedShift.endTime) 
    : []

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
    const initEquipments: Record<string, string> = {}

    // Pre-fill from existing plans
    existingPlans.forEach(p => {
      if (p.patternRef) {
        initMatrix[p.patternRef] = p.hourlyTargets || {}
        initWorkers[p.patternRef] = p.hourlyWorkers || {}
        if (p.actualQuantity !== undefined && p.actualQuantity !== null) {
          initActuals[p.patternRef] = p.actualQuantity
        }
        if (p.equipmentId) {
          initEquipments[p.patternRef] = p.equipmentId
        }
      }
    })

    setHourlyMatrix(initMatrix)
    setWorkers(initWorkers)
    setActuals(initActuals)
    setSelectedEquipments(initEquipments)
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
          
        const existingPlan = dailyPlans.find(p => p.orderId === selectedOrder && p.stage === 'Mould' && p.patternRef === code)
          
        plansToSave.push({
          orderId: selectedOrder,
          itemId: backlog?.itemId || `${selectedOrder}-0`,
          stage: 'Mould',
          patternRef: code,
          quantityScheduled: totalScheduled || existingPlan?.quantityScheduled || 0,
          laborersAssigned: maxWorkers,
          workersAssigned: maxWorkers,
          equipmentId: selectedEquipments[code] || '',
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
    const sum = Object.values(hours).reduce((sum, val) => sum + (val || 0), 0)
    if (sum === 0) {
      const existingPlan = dailyPlans.find(p => p.orderId === selectedOrder && p.stage === 'Mould' && p.patternRef === code)
      return existingPlan?.quantityScheduled || 0
    }
    return sum
  }

  const getRowTotal = (timeSlot: string) => {
    return Object.keys(hourlyMatrix).reduce((sum, code) => sum + (hourlyMatrix[code][timeSlot] || 0), 0)
  }

  const getGrandTotal = () => {
    return Object.keys(hourlyMatrix).reduce((sum, code) => sum + getColTotal(code), 0)
  }

  // Hourly input change
  const handleHourlyChange = (code: string, timeSlot: string, value: string) => {
    const numValue = value === '' ? undefined : parseInt(value, 10)
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
      const w = codeWorkers[slot.time] || 0
      totalExpected += w * avgProd * slot.hours
    })
    
    // Adjust total expected if there is a break in this shift
    if (selectedShift && selectedShift.breakDurationMins > 0) {
       const totalShiftMins = TIME_SLOTS.reduce((acc, s) => acc + (s.hours * 60), 0)
       if (totalShiftMins > 0) {
         const effectiveRatio = Math.max(0, (totalShiftMins - selectedShift.breakDurationMins) / totalShiftMins)
         totalExpected = totalExpected * effectiveRatio
       }
    }
    return Math.round(totalExpected)
  }

  const handleFillRemaining = (code: string, remaining: number) => {
    const perHour = Math.floor(remaining / 12)
    let remainder = Math.max(0, remaining - (perHour * TIME_SLOTS.length))
    
    const newHours: Record<string, number> = {}
    TIME_SLOTS.forEach((slot, idx) => {
      newHours[slot.time] = perHour + (idx === 0 ? remainder : 0) // dump remainder in first hour
    })
    
    setHourlyMatrix(prev => ({
      ...prev,
      [code]: newHours
    }))
  }

  const dateObj = new Date(date || new Date())
  const dateString = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  // Active Patternes for the table (group by patternRef to avoid duplicate keys)
  const activeMoulds = useMemo(() => {
    const grouped = new Map<string, typeof orderMouldBacklogs[0]>()
    orderMouldBacklogs.forEach(b => {
      if (!b.patternRef) return
      if (grouped.has(b.patternRef)) {
        const existing = grouped.get(b.patternRef)!
        existing.totalRequired += b.totalRequired
        existing.totalScheduled += b.totalScheduled
      } else {
        grouped.set(b.patternRef, { ...b })
      }
    })
    return Array.from(grouped.values())
  }, [orderMouldBacklogs])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-[95vw] md:max-w-[800px] lg:max-w-[1000px] xl:max-w-[1200px] min-h-[60vh] max-h-[90vh] bg-[#F4F6FB] border-[#E0E7FF] text-foreground p-0 shadow-2xl">
        <div className="flex flex-col w-full max-h-[90vh]">
          <DialogHeader className="p-6 pb-4 border-b border-[#E0E7FF] shrink-0">
          <div>
            <DialogTitle className="text-xl font-heading text-white">
              {dateString}
            </DialogTitle>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md border flex items-center gap-1 text-[#4285F4] border-[#4285F4]/20 bg-[#4285F4]/10">
                <CubeTransparent weight="bold" className="w-3 h-3" />
                MOULD PLANNING
              </span>
              {shifts.length > 0 && (
                <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                  <SelectTrigger className="h-6 px-2 text-[10px] font-bold uppercase rounded-md border border-amber-500/20 bg-amber-500/10 text-amber-500 ml-2 w-auto min-w-[100px] border-none focus:ring-0">
                    <SelectValue placeholder="Select Shift" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#FFFFFF] border-[#E0E7FF]">
                    {shifts.map(s => (
                      <SelectItem key={s.id} value={s.id!} className="text-[#172554] hover:bg-[#EEF2FF] focus:bg-[#EEF2FF] text-xs">
                        {s.name} ({s.startTime} - {s.endTime})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-8">
          {/* SECTION 1: Order & Patternes */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#64748B] text-xs font-semibold uppercase tracking-wider">Select Order</Label>
              <Select value={selectedOrder} onValueChange={setSelectedOrder}>
                <SelectTrigger className="w-full max-w-2xl h-12 text-base bg-[#FFFFFF] border-[#E0E7FF] text-[#172554] shadow-sm">
                  <SelectValue placeholder="Select active customer order..." />
                </SelectTrigger>
                <SelectContent className="bg-[#FFFFFF] border-[#E0E7FF] max-h-60">
                  {openOrders.map(o => (
                    <SelectItem key={o.id} value={o.id} className="text-[#172554] hover:bg-[#EEF2FF] focus:bg-[#EEF2FF]">
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
                    <div key={cb.patternRef} className="bg-gradient-to-br from-[#FFFFFF] to-[#EEF2FF] p-5 rounded-xl border border-[#E0E7FF] min-w-[280px] flex-1 shadow-md">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex flex-col gap-1">
                          <div className="text-[#172554] font-bold text-sm bg-[#EEF2FF] p-2 rounded border border-[#E0E7FF]">
                            {cb.patternRef}
                            {cb.itemId && <span className="text-[10px] text-[#94A3B8] ml-2 block">Item: {cb.itemId}</span>}
                          </div>
                          <div>
                            <Select 
                              value={selectedEquipments[cb.patternRef!] || ''} 
                              onValueChange={(val) => setSelectedEquipments(prev => ({...prev, [cb.patternRef!]: val}))}
                            >
                              <SelectTrigger className="h-7 text-[10px] bg-[#F4F6FB] border-[#E0E7FF] text-[#64748B]">
                                <SelectValue placeholder="Machine" />
                              </SelectTrigger>
                              <SelectContent className="bg-[#FFFFFF] border-[#E0E7FF]">
                                {equipments.map(e => <SelectItem key={e.id} value={e.id!} className="text-[10px]">{e.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="mt-1 text-xs font-medium text-[#64748B] bg-[#F4F6FB] px-2.5 py-1 rounded-md border border-[#E0E7FF]">Remaining: {remaining}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 text-sm text-[#64748B]">Planned Today:</div>
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
              <p className="text-sm text-[#94A3B8] italic">No moulds mapped for this order.</p>
            )}
          </div>

          {/* SECTION 2: Shift Time Table */}
          {selectedOrder && activeMoulds.length > 0 && (
            <div className="space-y-3">
              <Label className="text-[#64748B] text-xs font-semibold uppercase tracking-wider">Shift Time Table</Label>
              <div className="border border-[#E0E7FF] rounded-xl overflow-x-auto bg-[#F4F6FB]">
                <table className="w-full text-xs text-left whitespace-nowrap">
                  <thead className="bg-[#FFFFFF] border-b border-[#E0E7FF] text-[#64748B] uppercase tracking-wider font-bold">
                    <tr>
                      <th rowSpan={2} className="px-6 py-4 sticky left-0 bg-[#FFFFFF] z-10 w-40 whitespace-nowrap text-xs align-bottom pb-6">Time Slot</th>
                      {activeMoulds.map(cb => {
                        const pattern = patterns.find(p => p.code === cb.patternRef)
                        const mouldingType = pattern?.category || 'Machine Moulding'
                        return (
                          <th key={cb.patternRef} colSpan={2} className="px-4 py-3 text-center text-[#4285F4] font-mono text-base border-b border-[#E0E7FF]/50">
                            {cb.patternRef}
                            <div className="text-[9px] text-[#94A3B8] tracking-wider mt-1 font-semibold">{mouldingType}</div>
                          </th>
                        )
                      })}
                      <th rowSpan={2} className="px-6 py-4 text-center text-[#172554] whitespace-nowrap w-40 align-bottom pb-6">Slot Total</th>
                    </tr>
                    <tr>
                      {activeMoulds.map(cb => [
                        <th key={`${cb.patternRef}-hourly`} className="px-2 py-2 text-center text-[10px] text-[#94A3B8] w-32 font-medium border-r border-[#E0E7FF]/20">HOURLY PLAN</th>,
                        <th key={`${cb.patternRef}-assign`} className="px-2 py-2 text-center text-[10px] text-[#94A3B8] w-56 font-medium">LABOURER ASSIGNMENT</th>
                      ])}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E7FF]">
                    {TIME_SLOTS.map((slot, index) => (
                      <tr key={slot.time} className="hover:bg-[#FFFFFF]/50 transition-colors">
                        <td className="px-6 py-3 font-mono font-semibold text-sm text-[#172554] sticky left-0 bg-[#F4F6FB] z-10 whitespace-nowrap">
                          {slot.time}
                        </td>
                        {activeMoulds.map(cb => {
                          const val = hourlyMatrix[cb.patternRef!]?.[slot.time]
                          const workerCount = workers[cb.patternRef!]?.[slot.time] || 0
                          
                          return [
                            <td key={`${cb.patternRef}-input`} className="px-2 py-2 text-center border-r border-[#E0E7FF]/20">
                              <Input
                                type="number"
                                min="0"
                                value={val === undefined ? 0 : val}
                                onChange={e => handleHourlyChange(cb.patternRef!, slot.time, e.target.value)}
                                className={cn(
                                  "w-20 h-9 mx-auto bg-[#FFFFFF] font-mono text-center px-2 text-sm shadow-inner",
                                  (val === undefined || val === 0) ? "border-[#E0E7FF]/50 text-[#94A3B8]" : "border-[#E0E7FF] text-[#172554]"
                                )}
                              />
                            </td>,
                            <td key={`${cb.patternRef}-assign`} className="px-2 py-2 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="h-6 w-6 bg-[#F4F6FB] border-[#E0E7FF] text-[#172554] hover:bg-[#EEF2FF]"
                                  onClick={() => handleWorkerChange(cb.patternRef!, slot.time, -1)}
                                >
                                  -
                                </Button>
                                <span className="font-mono font-medium text-[#172554] w-4 text-center text-sm">{workerCount}</span>
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="h-6 w-6 bg-[#F4F6FB] border-[#E0E7FF] text-[#172554] hover:bg-[#EEF2FF]"
                                  onClick={() => handleWorkerChange(cb.patternRef!, slot.time, 1)}
                                >
                                  +
                                </Button>
                              </div>
                            </td>
                          ]
                        })}
                        <td className="px-6 py-3 font-mono font-bold text-center text-[#64748B] bg-[#FFFFFF]/30">
                          {getRowTotal(slot.time)}
                        </td>
                      </tr>
                    ))}
                    {/* Totals Row */}
                    <tr className="bg-[#EEF2FF] border-t-2 border-[#E0E7FF]">
                      <td className="px-6 py-4 font-bold text-sm text-[#172554] sticky left-0 bg-[#EEF2FF] z-10">COLUMN TOTAL</td>
                      {activeMoulds.map(cb => {
                        const plannedTarget = getColTotal(cb.patternRef!)
                        const pattern = patterns.find(p => p.code === cb.patternRef)
                        
                        const selectedEqId = selectedEquipments[cb.patternRef!]
                        const selectedEq = equipments.find(e => e.id === selectedEqId)
                        const avgProd = selectedEq?.avgPiecesPerHour || Number(pattern?.avgMouldsPerHour) || 10
                        
                        const expectedOutput = getExpectedOutput(cb.patternRef!, avgProd)
                        
                        const isOverrun = expectedOutput > plannedTarget && expectedOutput > 0 && expectedOutput > (plannedTarget * 1.1)
                        const isOnTrack = expectedOutput >= plannedTarget && expectedOutput > 0 && !isOverrun
                        
                        const totalWorkers = Math.max(0, ...Object.values(workers[cb.patternRef!] || {}))

                        return [
                          <td key={`${cb.patternRef}-total`} className="px-4 py-4 text-center font-mono font-bold text-lg text-[#4285F4] border-r border-[#E0E7FF]/20">
                            {plannedTarget}
                          </td>,
                          <td key={`${cb.patternRef}-expected`} className="bg-[#EEF2FF] px-2 py-4 align-middle">
                            <div className="flex flex-col items-center justify-center space-y-1.5">
                              <span className="text-[10px] text-[#172554] font-mono font-bold">Exp: {expectedOutput.toFixed(0)}</span>
                              {totalWorkers === 0 ? (
                                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-[#F4F6FB] text-[#64748B] border border-[#E0E7FF]">Unassigned</span>
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
                      <td className="px-6 py-4 font-mono font-bold text-center text-[#172554] text-xl bg-[#4F46E5]/20">
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
            <div className="border border-[#E0E7FF] rounded-xl overflow-hidden mt-8">
              <div className="w-full flex items-center justify-between bg-[#EEF2FF] p-4 text-[#172554]">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm">End of Day — Actual Entry</h3>
                  <span className="text-xs text-[#64748B]">Enter produced quantities</span>
                </div>
              </div>
              
              <div className="p-4 bg-[#F4F6FB] space-y-3">
                  {activeMoulds.map(cb => {
                    const planned = getColTotal(cb.patternRef!)
                    const act = actuals[cb.patternRef!]
                    const hasAct = act !== undefined
                    const variance = hasAct ? act - planned : 0
                    
                    return (
                      <div key={cb.patternRef} className="flex items-center gap-4 p-3 bg-[#FFFFFF] border border-[#E0E7FF] rounded-lg">
                        <div className="w-32">
                          <h4 className="text-[#172554] font-mono font-bold text-sm">{cb.patternRef}</h4>
                        </div>
                        <div className="w-24">
                          <span className="text-[10px] text-[#64748B] block uppercase font-bold mb-1">Planned</span>
                          <span className="font-mono text-[#172554]">{planned}</span>
                        </div>
                        <div className="w-32">
                          <span className="text-[10px] text-[#4285F4] block uppercase font-bold mb-1">Actual</span>
                          <Input
                            type="number"
                            min="0"
                            value={act === undefined ? '' : act}
                            onChange={e => setActuals(prev => ({ ...prev, [cb.patternRef!]: e.target.value === '' ? undefined : Number(e.target.value) })) as any}
                            className={cn(
                              "h-8 bg-[#F4F6FB] text-[#172554] font-mono px-2 text-sm w-full",
                              act === undefined ? "border-red-500/50 focus:border-red-500" : "border-[#E0E7FF]"
                            )}
                            placeholder="Required"
                          />
                        </div>
                        <div className="w-24 text-right ml-auto">
                          <span className="text-[10px] text-[#64748B] block uppercase font-bold mb-1">Variance</span>
                          {hasAct ? (
                            <span className={cn(
                              "font-mono font-bold text-lg",
                              variance > 0 ? "text-green-500" : variance < 0 ? "text-red-500" : "text-[#64748B]"
                            )}>
                              {variance > 0 ? '+' : ''}{variance}
                            </span>
                          ) : (
                            <span className="text-[#94A3B8]">-</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  <p className="text-[10px] text-[#64748B] italic mt-2">
                    * If Actual &lt; Planned, the deficit will be carried forward to tomorrow as Pending.
                  </p>
                </div>
            </div>
          )}
        </div>

        <DialogFooter className="m-0 p-4 border-t border-[#E0E7FF] bg-[#FFFFFF] shrink-0 rounded-b-xl sm:justify-end">
          <Button variant="outline" onClick={onClose} className="border-[#E0E7FF] text-[#64748B] hover:text-[#172554]">Cancel</Button>
          <Button onClick={handleSave} className="bg-[#4F46E5] text-white hover:bg-[#4F46E5]/90 shadow-[0_0_15px_rgba(212,82,26,0.3)]">Save Day Plan</Button>
        </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
