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

interface CorePlanningModalProps {
  isOpen: boolean
  onClose: () => void
  date: string
  openOrders: any[]
  backlogData: BacklogItem[]
  dailyPlans: any[] // existing plans for this date and stage
  patterns: any[]
  onSaveDayPlan: (date: string, plans: any[]) => void
}

export function CorePlanningModal({
  isOpen,
  onClose,
  date,
  openOrders,
  backlogData,
  dailyPlans,
  patterns,
  onSaveDayPlan
}: CorePlanningModalProps) {
  const [selectedOrder, setSelectedOrder] = useState<string>('')
  
  // State maps keyed by Core Box Code
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
            const coreEquips = data.filter((e: any) => e.type === 'Core Machine' && e.isActive)
            setEquipments(coreEquips)
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
      if (p.coreBoxCode) {
        initMatrix[p.coreBoxCode] = p.hourlyTargets || {}
        initWorkers[p.coreBoxCode] = p.hourlyWorkers || {}
        if (p.actualQuantity !== undefined && p.actualQuantity !== null) {
          initActuals[p.coreBoxCode] = p.actualQuantity
        }
        if (p.equipmentId) {
          initEquipments[p.coreBoxCode] = p.equipmentId
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
        const backlog = orderCoreBacklog.find(b => b.coreBoxCode === code)
        const maxWorkers = workers[code] && Object.values(workers[code]).length > 0 
          ? Math.max(...Object.values(workers[code])) 
          : 1
          
        const existingPlan = dailyPlans.find(p => p.orderId === selectedOrder && p.stage === 'Core' && p.coreBoxCode === code)
          
        plansToSave.push({
          orderId: selectedOrder,
          itemId: backlog?.itemId || `${selectedOrder}-0`,
          stage: 'Core',
          coreBoxCode: code,
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
  const orderCoreBacklogs = order ? backlogData.filter(b => b.orderNo === order.customerOrderNo) : []
  
  const getColTotal = (code: string) => {
    const hours = hourlyMatrix[code] || {}
    const sum = Object.values(hours).reduce((sum, val) => sum + (val || 0), 0)
    if (sum === 0) {
      const existingPlan = dailyPlans.find(p => p.orderId === selectedOrder && p.stage === 'Core' && p.coreBoxCode === code)
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
       // A simple approach: Reduce the totalExpected proportionally by the break duration
       const totalShiftMins = TIME_SLOTS.reduce((acc, s) => acc + (s.hours * 60), 0)
       if (totalShiftMins > 0) {
         const effectiveRatio = Math.max(0, (totalShiftMins - selectedShift.breakDurationMins) / totalShiftMins)
         totalExpected = totalExpected * effectiveRatio
       }
    }
    return Math.round(totalExpected)
  }

  // Section 1: Top-level fill (distributes equally across hours for quick entry)
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

  // Active Core Boxes for the table: Group by coreBoxCode to avoid duplicate keys and merge requirements
  const activeCoreBoxes = useMemo(() => {
    const unique = new Map<string, typeof orderCoreBacklogs[0]>()
    orderCoreBacklogs.forEach(b => {
      const code = b.coreBoxCode || 'Unknown'
      if (!unique.has(code)) {
        unique.set(code, { ...b, coreBoxCode: code })
      } else {
        const existing = unique.get(code)!
        unique.set(code, {
          ...existing,
          totalRequired: existing.totalRequired + b.totalRequired,
          totalScheduled: existing.totalScheduled + b.totalScheduled,
        })
      }
    })
    return Array.from(unique.values())
  }, [orderCoreBacklogs])

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
                CORE PLANNING
              </span>
              {shifts.length > 0 && (
                <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                  <SelectTrigger className="h-6 px-2 text-[10px] font-bold uppercase rounded-md border border-amber-500/20 bg-amber-500/10 text-amber-500 ml-2 w-auto min-w-[100px] border-none focus:ring-0">
                    <SelectValue placeholder="Select Shift" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0C1221] border-[#243050]">
                    {shifts.map(s => (
                      <SelectItem key={s.id} value={s.id!} className="text-[#EEF3FF] hover:bg-[#1A263D] focus:bg-[#1A263D] text-xs">
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
          {/* SECTION 1: Order & Core Boxes */}
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

            {selectedOrder && activeCoreBoxes.length > 0 && (
              <div className="flex flex-wrap gap-4 mt-4">
                {activeCoreBoxes.map(cb => {
                  const remaining = Math.max(0, cb.totalRequired - cb.totalScheduled)
                  const plannedForDay = getColTotal(cb.coreBoxCode!)
                  
                  return (
                    <div key={cb.coreBoxCode} className="bg-gradient-to-br from-[#0C1221] to-[#1A263D] p-5 rounded-xl border border-[#243050] min-w-[280px] flex-1 shadow-md">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-[#EEF3FF] font-mono font-bold text-base">{cb.coreBoxCode}</h4>
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
                            onClick={() => handleFillRemaining(cb.coreBoxCode!, remaining)}
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
            {selectedOrder && activeCoreBoxes.length === 0 && (
              <p className="text-sm text-[#5A6E90] italic">No core boxes mapped for this order.</p>
            )}
          </div>

          {/* SECTION 2: Shift Time Table */}
          {selectedOrder && activeCoreBoxes.length > 0 && (
            <div className="space-y-3">
              <Label className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Shift Time Table</Label>
              <div className="border border-[#243050] rounded-xl overflow-x-auto bg-[#050810]">
                <table className="w-full text-xs text-left whitespace-nowrap">
                  <thead className="bg-[#0C1221] border-b border-[#243050] text-[#8B9FC4] uppercase tracking-wider font-bold">
                    <tr>
                      <th rowSpan={2} className="px-6 py-4 sticky left-0 bg-[#0C1221] z-10 w-40 whitespace-nowrap text-xs align-bottom pb-6">Time Slot</th>
                      {activeCoreBoxes.map(cb => (
                        <th key={cb.coreBoxCode} colSpan={2} className="px-4 py-3 text-center text-[#4285F4] font-mono text-base border-b border-[#243050]/50">
                          {cb.coreBoxCode}
                        </th>
                      ))}
                      <th rowSpan={2} className="px-6 py-4 text-center text-[#EEF3FF] whitespace-nowrap w-40 align-bottom pb-6">Slot Total</th>
                    </tr>
                    <tr>
                      {activeCoreBoxes.map(cb => [
                        <th key={`${cb.coreBoxCode}-hourly`} className="px-2 py-2 text-center text-[10px] text-[#5A6E90] w-32 font-medium border-r border-[#243050]/20">HOURLY PLAN</th>,
                        <th key={`${cb.coreBoxCode}-assign`} className="px-2 py-2 text-center text-[10px] text-[#5A6E90] w-56 font-medium">LABOURER ASSIGNMENT</th>
                      ])}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#243050]">
                    {TIME_SLOTS.map((slot, index) => (
                      <tr key={slot.time} className="hover:bg-[#0C1221]/50 transition-colors">
                        <td className="px-6 py-3 font-mono font-semibold text-sm text-[#EEF3FF] sticky left-0 bg-[#050810] z-10 whitespace-nowrap">
                          {slot.time}
                        </td>
                        {activeCoreBoxes.map(cb => {
                          const val = hourlyMatrix[cb.coreBoxCode!]?.[slot.time]
                          const workerCount = workers[cb.coreBoxCode!]?.[slot.time] || 0
                          
                          return [
                            <td key={`${cb.coreBoxCode}-input`} className="px-2 py-2 text-center border-r border-[#243050]/20">
                              <Input
                                type="number"
                                min="0"
                                value={val === undefined ? 0 : val}
                                onChange={e => handleHourlyChange(cb.coreBoxCode!, slot.time, e.target.value)}
                                className={cn(
                                  "w-20 h-9 mx-auto bg-[#0C1221] font-mono text-center px-2 text-sm shadow-inner",
                                  (val === undefined || val === 0) ? "border-[#243050]/50 text-[#5A6E90]" : "border-[#243050] text-[#EEF3FF]"
                                )}
                              />
                            </td>,
                            <td key={`${cb.coreBoxCode}-assign`} className="px-2 py-2 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="h-6 w-6 bg-[#050810] border-[#243050] text-[#EEF3FF] hover:bg-[#1A263D]"
                                  onClick={() => handleWorkerChange(cb.coreBoxCode!, slot.time, -1)}
                                >
                                  -
                                </Button>
                                <span className="font-mono font-medium text-[#EEF3FF] w-4 text-center text-sm">{workerCount}</span>
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="h-6 w-6 bg-[#050810] border-[#243050] text-[#EEF3FF] hover:bg-[#1A263D]"
                                  onClick={() => handleWorkerChange(cb.coreBoxCode!, slot.time, 1)}
                                >
                                  +
                                </Button>
                              </div>
                            </td>
                          ]
                        })}
                        <td className="px-6 py-3 font-mono font-bold text-center text-[#8B9FC4] bg-[#0C1221]/30">
                          {getRowTotal(slot.time)}
                        </td>
                      </tr>
                    ))}
                    {/* Totals Row */}
                    <tr className="bg-[#1A263D] border-t-2 border-[#243050]">
                      <td className="px-6 py-4 font-bold text-sm text-[#EEF3FF] sticky left-0 bg-[#1A263D] z-10">COLUMN TOTAL</td>
                      {activeCoreBoxes.map(cb => {
                        const plannedTarget = getColTotal(cb.coreBoxCode!)
                        const pattern = patterns.find(p => p.code === cb.patternRef)
                        const specificCoreBox = pattern?.sharedCoreBoxes?.find((scb: any) => scb.code === cb.coreBoxCode)
                        
                        const selectedEqId = selectedEquipments[cb.coreBoxCode!]
                        const selectedEq = equipments.find(e => e.id === selectedEqId)
                        const avgProd = selectedEq?.avgPiecesPerHour || Number(specificCoreBox?.avgCoreProduction) || Number((pattern as any)?.avgCoreProduction) || 10
                        
                        const expectedOutput = getExpectedOutput(cb.coreBoxCode!, avgProd)
                        
                        const isOverrun = expectedOutput > plannedTarget && expectedOutput > 0 && expectedOutput > (plannedTarget * 1.1)
                        const isOnTrack = expectedOutput >= plannedTarget && expectedOutput > 0 && !isOverrun
                        
                        const totalWorkers = Math.max(0, ...Object.values(workers[cb.coreBoxCode!] || {}))

                        return [
                          <td key={`${cb.coreBoxCode}-total`} className="px-4 py-4 text-center font-mono font-bold text-lg text-[#4285F4] border-r border-[#243050]/20">
                            {plannedTarget}
                          </td>,
                          <td key={`${cb.coreBoxCode}-expected`} className="bg-[#1A263D] px-2 py-4 align-middle">
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

          {/* SECTION 4: Actual Entry */}
          {selectedOrder && activeCoreBoxes.length > 0 && (
            <div className="border border-[#243050] rounded-xl overflow-hidden mt-8">
              <div className="w-full flex items-center justify-between bg-[#1A263D] p-4 text-[#EEF3FF]">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm">End of Day — Actual Entry</h3>
                  <span className="text-xs text-[#8B9FC4]">Enter produced quantities</span>
                </div>
              </div>
              
              <div className="p-4 bg-[#050810] space-y-3">
                  {activeCoreBoxes.map(cb => {
                    const planned = getColTotal(cb.coreBoxCode!)
                    const act = actuals[cb.coreBoxCode!]
                    const hasAct = act !== undefined
                    const variance = hasAct ? act - planned : 0
                    
                    return (
                      <div key={cb.coreBoxCode} className="flex items-center gap-4 p-3 bg-[#0C1221] border border-[#243050] rounded-lg">
                        <div className="w-32">
                          <div className="text-[#EEF3FF] font-bold text-sm bg-[#1A263D] p-2 rounded border border-[#243050]">
                            {cb.coreBoxCode}
                            {cb.patternRef && <span className="text-[10px] text-[#5A6E90] ml-2 block">{cb.patternRef}</span>}
                          </div>
                          <div className="mt-1">
                            <Select 
                              value={selectedEquipments[cb.coreBoxCode!] || ''} 
                              onValueChange={(val) => setSelectedEquipments(prev => ({...prev, [cb.coreBoxCode!]: val}))}
                            >
                              <SelectTrigger className="h-7 text-[10px] bg-[#050810] border-[#243050] text-[#8B9FC4]">
                                <SelectValue placeholder="Machine" />
                              </SelectTrigger>
                              <SelectContent className="bg-[#0C1221] border-[#243050]">
                                {equipments.map(e => <SelectItem key={e.id} value={e.id!} className="text-[10px]">{e.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
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
                            onChange={e => setActuals(prev => ({ ...prev, [cb.coreBoxCode!]: e.target.value === '' ? undefined : Number(e.target.value) })) as any}
                            className={cn(
                              "h-8 bg-[#050810] text-[#EEF3FF] font-mono px-2 text-sm w-full",
                              act === undefined ? "border-red-500/50 focus:border-red-500" : "border-[#243050]"
                            )}
                            placeholder="Required"
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
