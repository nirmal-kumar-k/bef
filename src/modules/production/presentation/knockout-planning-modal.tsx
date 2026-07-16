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
import { CubeTransparent } from '@phosphor-icons/react'
import { cn } from '@/shared/lib/utils'

import { generateTimeSlots, TimeSlot, resolveAvgProductionRate } from '@/shared/lib/utils'
import type { Shift } from './shift-master-page'

interface KnockoutPlanningModalProps {
  isOpen: boolean
  onClose: () => void
  date: string
  openOrders: any[]
  backlogData: BacklogItem[]
  dailyPlans: any[] // existing plans for this date and stage
  patterns: any[]
  onSaveDayPlan: (date: string, plans: any[]) => void
}

export function KnockoutPlanningModal({
  isOpen,
  onClose,
  date,
  openOrders,
  backlogData,
  dailyPlans,
  patterns,
  onSaveDayPlan
}: KnockoutPlanningModalProps) {
  const [selectedOrder, setSelectedOrder] = useState<string>('')
  
  // Shifts
  const [shifts, setShifts] = useState<Shift[]>([])
  const [selectedShiftId, setSelectedShiftId] = useState<string>('')

  // Equipment
  const [equipments, setEquipments] = useState<any[]>([])
  const [activeMachineTab, setActiveMachineTab] = useState<string>('')
  
  // State maps keyed by `${machineId}_${patternRef}`
  const [hourlyMatrix, setHourlyMatrix] = useState<Record<string, Record<string, number | undefined>>>({})
  const [workers, setWorkers] = useState<Record<string, Record<string, number | undefined>>>({})
  const [hourlyActuals, setHourlyActuals] = useState<Record<string, Record<string, number | undefined>>>({})
  const [actuals, setActuals] = useState<Record<string, number | undefined>>({})
  

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
            const knockoutEquips = data.filter((e: any) => e.type === 'Knockout Machine' && e.isActive)
            setEquipments(knockoutEquips)
            if (knockoutEquips.length > 0 && !activeMachineTab) {
              setActiveMachineTab(knockoutEquips[0].id)
            }
          })
          .catch(console.error)
      }
    }
  }, [isOpen])

  const selectedShift = shifts.find(s => s.id === selectedShiftId) || shifts[0]
  const TIME_SLOTS: TimeSlot[] = selectedShift 
    ? generateTimeSlots(selectedShift.startTime, selectedShift.endTime, selectedShift.breaks || []) 
    : []

  // Initialization when order changes or modal opens
  useEffect(() => {
    if (isOpen && !selectedOrder && openOrders.length > 0) {
      setHourlyMatrix({})
      setWorkers({})
      setHourlyActuals({})
      setActuals({})
    }
  }, [isOpen, selectedOrder, openOrders.length])

  useEffect(() => {
    if (!selectedOrder) return

    const order = openOrders.find(o => o.id === selectedOrder)
    if (!order) return

    const existingPlans = dailyPlans.filter(p => p.orderId === selectedOrder && p.stage === 'Knockout')
    
    const initMatrix: Record<string, Record<string, number>> = {}
    const initWorkers: Record<string, Record<string, number>> = {}
    const initHourlyActuals: Record<string, Record<string, number>> = {}
    const initActuals: Record<string, number> = {}

    existingPlans.forEach(p => {
      if (p.patternRef && p.equipmentId) {
        const key = `${p.equipmentId}_${p.patternRef}`
        initMatrix[key] = p.hourlyTargets || {}
        initWorkers[key] = p.hourlyWorkers || {}
        initHourlyActuals[key] = p.hourlyActuals || {}
        if (p.actualQuantity !== undefined && p.actualQuantity !== null) {
          initActuals[key] = p.actualQuantity
        }
      }
    })

    setHourlyMatrix(initMatrix)
    setWorkers(initWorkers)
    setHourlyActuals(initHourlyActuals)
    setActuals(initActuals)
  }, [selectedOrder, dailyPlans, openOrders])

  const handleSave = () => {
    if (!selectedOrder) return

    const order = openOrders.find(o => o.id === selectedOrder)
    if (!order) return

    const orderKnockoutBacklog = backlogData.filter(b => b.orderNo === order.customerOrderNo)
    const plansToSave: any[] = []

    Object.keys(hourlyMatrix).forEach(key => {
      const [machineId, code] = key.split('_')
      const hours = hourlyMatrix[key] || {}
      const totalScheduled = Object.values(hours).reduce((sum: number, val) => sum + (val || 0), 0)
      
      if (totalScheduled > 0 || (workers[key] && Object.values(workers[key]).some(w => (w || 0) > 0)) || actuals[key] !== undefined) {
        const backlog = orderKnockoutBacklog.find(b => b.patternRef === code)
        const maxWorkers = workers[key] && Object.values(workers[key]).length > 0
          ? Math.max(...Object.values(workers[key]).map(w => w || 0))
          : 1
          
        const existingPlan = dailyPlans.find(p => p.orderId === selectedOrder && p.stage === 'Knockout' && p.patternRef === code && p.equipmentId === machineId)
          
        plansToSave.push({
          orderId: selectedOrder,
          itemId: backlog?.itemId || `${selectedOrder}-0`,
          stage: 'Knockout',
          patternRef: code,
          quantityScheduled: totalScheduled || existingPlan?.quantityScheduled || 0,
          laborersAssigned: maxWorkers,
          workersAssigned: maxWorkers,
          equipmentId: machineId,
          hourlyTargets: hours,
          hourlyWorkers: workers[key] || {},
          hourlyActuals: hourlyActuals[key] || {},
          actualQuantity: actuals[key]
        })
      }
    })

    onSaveDayPlan(date, plansToSave)
    onClose()
  }

  const order = openOrders.find(o => o.id === selectedOrder)
  const orderKnockoutBacklogs = order ? backlogData.filter(b => b.orderNo === order.customerOrderNo) : []
  
  // Get active knockouts (group by patternRef to merge identical pattern requirements)
  const activeKnockouts = useMemo(() => {
    const grouped = new Map<string, typeof orderKnockoutBacklogs[0]>()
    orderKnockoutBacklogs.forEach(b => {
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
  }, [orderKnockoutBacklogs])

  // Get total for a pattern across ALL machines (for checking remaining quota)
  const getPatternTotalAcrossMachines = (patternRef: string) => {
    let total = 0
    Object.keys(hourlyMatrix).forEach(key => {
      if (key.endsWith(`_${patternRef}`)) {
        const hours = hourlyMatrix[key] || {}
        total += Object.values(hours).reduce((sum: number, val) => sum + (val || 0), 0)
      }
    })
    return total
  }

  // Smart Auto-fill logic when machine tab changes
  useEffect(() => {
    if (!activeMachineTab || activeKnockouts.length === 0 || TIME_SLOTS.length === 0) return

    setHourlyMatrix(prevMatrix => {
      let hasExistingPlan = false
      activeKnockouts.forEach(cb => {
        const key = `${activeMachineTab}_${cb.patternRef}`
        const hours = prevMatrix[key] || {}
        if (Object.values(hours).some(v => v !== undefined && v > 0)) hasExistingPlan = true
      })
      if (hasExistingPlan) return prevMatrix

      const newMatrix = { ...prevMatrix }
      let updated = false
      
      activeKnockouts.forEach(cb => {
        const key = `${activeMachineTab}_${cb.patternRef}`
        const pattern = patterns.find(p => p.code === cb.patternRef)
        const selectedEq = equipments.find(e => e.id === activeMachineTab)
        const avgProd = resolveAvgProductionRate(Number(pattern?.avgKnockoutsPerHour) || undefined, selectedEq?.avgPiecesPerHour)

        let patternTotal = 0
        Object.keys(prevMatrix).forEach(k => {
          if (k.endsWith(`_${cb.patternRef}`)) {
            const hours = prevMatrix[k] || {}
            patternTotal += Object.values(hours).reduce((sum: number, val) => sum + (val || 0), 0)
          }
        })
        
        const remaining = Math.max(0, cb.totalRequired - cb.totalScheduled - patternTotal)
        if (remaining > 0) {
          const machineMatrix: Record<string, number> = {}
          let toFill = remaining
          TIME_SLOTS.forEach(slot => {
            if (toFill > 0) {
              const fillAmt = Math.min(toFill, avgProd)
              machineMatrix[slot.time] = fillAmt
              toFill -= fillAmt
            }
          })
          newMatrix[key] = machineMatrix
          updated = true
        }
      })
      return updated ? newMatrix : prevMatrix
    })

    setWorkers(prevWorkers => {
      let hasExistingWorkers = false
      activeKnockouts.forEach(cb => {
        const key = `${activeMachineTab}_${cb.patternRef}`
        const w = prevWorkers[key] || {}
        if (Object.values(w).some(v => v !== undefined && v > 0)) hasExistingWorkers = true
      })
      if (hasExistingWorkers) return prevWorkers

      const newWorkers = { ...prevWorkers }
      let updated = false
      
      activeKnockouts.forEach(cb => {
        const key = `${activeMachineTab}_${cb.patternRef}`
        const pattern = patterns.find(p => p.code === cb.patternRef)
        const selectedEq = equipments.find(e => e.id === activeMachineTab)
        const avgProd = resolveAvgProductionRate(Number(pattern?.avgKnockoutsPerHour) || undefined, selectedEq?.avgPiecesPerHour)

        let patternTotal = 0
        Object.keys(hourlyMatrix).forEach(k => {
          if (k.endsWith(`_${cb.patternRef}`)) {
            const hours = hourlyMatrix[k] || {}
            patternTotal += Object.values(hours).reduce((sum: number, val) => sum + (val || 0), 0)
          }
        })
        
        const remaining = Math.max(0, cb.totalRequired - cb.totalScheduled - patternTotal)
        if (remaining > 0) {
          const machineWorkers: Record<string, number> = {}
          let toFill = remaining
          TIME_SLOTS.forEach(slot => {
            if (toFill > 0) {
              machineWorkers[slot.time] = 1
              toFill -= Math.min(toFill, avgProd)
            } else {
              machineWorkers[slot.time] = 0
            }
          })
          newWorkers[key] = machineWorkers
          updated = true
        }
      })
      
      return updated ? newWorkers : prevWorkers
    })
  }, [activeMachineTab, activeKnockouts.length, TIME_SLOTS.length, patterns])

  const getColTotal = (patternRef: string) => {
    const key = `${activeMachineTab}_${patternRef}`
    const hours = hourlyMatrix[key] || {}
    const sum = Object.values(hours).reduce((sum: number, val) => sum + (val || 0), 0)
    if (sum === 0) {
      const existingPlan = dailyPlans.find(p => p.orderId === selectedOrder && p.stage === 'Knockout' && p.patternRef === patternRef && p.equipmentId === activeMachineTab)
      return existingPlan?.quantityScheduled || 0
    }
    return sum
  }

  const getRowTotal = (timeSlot: string) => {
    return activeKnockouts.reduce((sum, cb) => {
      const key = `${activeMachineTab}_${cb.patternRef}`
      return sum + (hourlyMatrix[key]?.[timeSlot] || 0)
    }, 0)
  }

  const getGrandTotal = () => {
    return activeKnockouts.reduce((sum, cb) => sum + getColTotal(cb.patternRef!), 0)
  }

  const handleHourlyChange = (patternRef: string, timeSlot: string, value: string) => {
    const numValue = value === '' ? undefined : parseInt(value, 10)
    const key = `${activeMachineTab}_${patternRef}`

    // Cap at the pending backlog quantity, counting what's already entered for this
    // pattern across every machine (not just this one) so the total across the whole
    // day's plan can't exceed what's actually still needed.
    const cb = activeKnockouts.find(k => k.patternRef === patternRef)
    const pendingTotal = cb ? Math.max(0, cb.totalRequired - cb.totalScheduled) : Infinity
    const currentThisCell = hourlyMatrix[key]?.[timeSlot] || 0
    const totalAcrossMachinesExcludingThisCell = getPatternTotalAcrossMachines(patternRef) - currentThisCell
    const maxForThisCell = Math.max(0, pendingTotal - totalAcrossMachinesExcludingThisCell)
    const cappedValue = numValue === undefined ? undefined : Math.max(0, Math.min(numValue, maxForThisCell))

    setHourlyMatrix(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [timeSlot]: cappedValue
      }
    }))
  }

  const handleHourlyActualChange = (patternRef: string, timeSlot: string, value: string) => {
    const numValue = value === '' ? undefined : parseInt(value, 10)
    const key = `${activeMachineTab}_${patternRef}`
    setHourlyActuals(prev => {
      const updated = {
        ...prev,
        [key]: {
          ...(prev[key] || {}),
          [timeSlot]: numValue
        }
      }
      
      // Auto-update End of Day actuals when hourly actuals change
      const totalAct = Object.values(updated[key]).reduce((sum: number, val) => sum + (val || 0), 0)
      if (totalAct > 0) {
         setActuals(a => ({ ...a, [key]: totalAct }))
      }
      
      return updated
    })
  }

  const handleWorkerChange = (patternRef: string, timeSlot: string, delta: number) => {
    if (!activeMachineTab) return
    const key = `${activeMachineTab}_${patternRef}`
    
    setWorkers(prev => {
      const codeWorkers = prev[key] || {}
      const current = codeWorkers[timeSlot] || 0
      const next = Math.max(0, current + delta)
      

      
      return { ...prev, [key]: { ...codeWorkers, [timeSlot]: next } }
    })
  }

  const getExpectedOutput = (patternRef: string, avgProd: number) => {
    const key = `${activeMachineTab}_${patternRef}`
    const codeWorkers = workers[key] || {}
    let totalExpected = 0
    TIME_SLOTS.forEach(slot => {
      const w = codeWorkers[slot.time] || 0
      totalExpected += w * avgProd * slot.hours
    })
    return Math.round(totalExpected)
  }

  const dateObj = new Date(date || new Date())
  const dateString = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[98vw] sm:max-w-[98vw] min-h-[60vh] max-h-[95vh] bg-[#F4F6FB] border-[#E0E7FF] text-foreground p-0 shadow-2xl">
        <div className="flex flex-col w-full max-h-[90vh]">
          <DialogHeader className="p-6 pb-4 border-b border-[#E0E7FF] shrink-0">
          <div>
            <DialogTitle className="text-xl font-heading text-[#172554]">
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
                    <SelectValue placeholder="Select Shift">
                      {(id: string) => shifts.find(sh => sh.id === id)?.name || 'Select Shift'}
                    </SelectValue>
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
          {/* SECTION 1: Order & Machine Tabs */}
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

            {selectedOrder && activeKnockouts.length > 0 && (
              <div className="flex border-b border-[#E0E7FF] mt-4 overflow-x-auto">
                {equipments.map(eq => (
                  <button
                    key={eq.id}
                    onClick={() => setActiveMachineTab(eq.id)}
                    className={cn(
                      "px-6 py-3 font-semibold text-sm transition-colors border-b-2 whitespace-nowrap",
                      activeMachineTab === eq.id
                        ? "border-[#4285F4] text-[#4285F4] bg-[#F4F6FB]"
                        : "border-transparent text-[#64748B] hover:text-[#172554] hover:bg-[#F4F6FB]/50"
                    )}
                  >
                    {eq.name}
                  </button>
                ))}
              </div>
            )}
            
            {selectedOrder && activeKnockouts.length === 0 && (
              <p className="text-sm text-[#94A3B8] italic">No knockouts mapped for this order.</p>
            )}
          </div>

          {/* SECTION 2: Shift Time Table */}
          {selectedOrder && activeKnockouts.length > 0 && activeMachineTab && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-[#64748B] text-xs font-semibold uppercase tracking-wider">Shift Time Table</Label>

              </div>
              
              <div className="border border-[#E0E7FF] rounded-xl overflow-x-auto bg-[#F4F6FB]">
                <table className="w-full text-xs text-left whitespace-nowrap">
                  <thead className="bg-[#FFFFFF] border-b border-[#E0E7FF] text-[#64748B] uppercase tracking-wider font-bold">
                    <tr>
                      <th rowSpan={2} className="px-6 py-4 sticky left-0 bg-[#FFFFFF] z-10 w-40 whitespace-nowrap text-xs align-bottom pb-6">Time Slot</th>
                      {activeKnockouts.map(cb => {
                        const pattern = patterns.find(p => p.code === cb.patternRef)
                        const knockoutingType = pattern?.category || 'Machine Knockouting'
                        
                        const totalAcross = getPatternTotalAcrossMachines(cb.patternRef!)
                        const remaining = Math.max(0, cb.totalRequired - cb.totalScheduled)
                        
                        return (
                          <th key={cb.patternRef} colSpan={3} className="px-4 py-3 text-center text-[#4285F4] font-mono text-base border-b border-[#E0E7FF]/50">
                            <div>{cb.patternRef}</div>
                            <div className="text-[9px] text-[#94A3B8] tracking-wider mt-1 font-semibold">{knockoutingType}</div>
                            <div className="text-[10px] text-[#10B981] mt-1 font-medium bg-[#10B981]/10 rounded px-1 py-0.5 inline-block">Rem: {remaining - totalAcross}</div>
                          </th>
                        )
                      })}
                      <th rowSpan={2} className="px-6 py-4 text-center text-[#172554] whitespace-nowrap w-40 align-bottom pb-6">Slot Total</th>
                    </tr>
                    <tr>
                      {activeKnockouts.map(cb => [
                        <th key={`${cb.patternRef}-hourly`} className="px-2 py-2 text-center text-[10px] text-[#94A3B8] w-32 font-medium border-r border-[#E0E7FF]/20">HOURLY PLAN</th>,
                        <th key={`${cb.patternRef}-assign`} className="px-2 py-2 text-center text-[10px] text-[#94A3B8] w-56 font-medium border-r border-[#E0E7FF]/20">
                          LABOURER ASSIGN.
                        </th>,
                        <th key={`${cb.patternRef}-actuals`} className="px-2 py-2 text-center text-[10px] text-[#4285F4] w-32 font-medium">ACTUALS</th>
                      ])}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E7FF]">
                    {TIME_SLOTS.map((slot, index) => (
                      <tr key={slot.time} className="hover:bg-[#FFFFFF]/50 transition-colors">
                        <td className="px-6 py-3 font-mono font-semibold text-sm text-[#172554] sticky left-0 bg-[#F4F6FB] z-10 whitespace-nowrap">
                          {slot.time}
                        </td>
                        {activeKnockouts.map(cb => {
                          const key = `${activeMachineTab}_${cb.patternRef}`
                          const val = hourlyMatrix[key]?.[slot.time]
                          const workerCount = workers[key]?.[slot.time] || 0
                          
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
                            </td>,
                            <td key={`${cb.patternRef}-actuals`} className="px-2 py-2 text-center border-l border-[#E0E7FF]/20">
                              <Input
                                type="number"
                                min="0"
                                value={hourlyActuals[key]?.[slot.time] ?? ''}
                                onChange={e => handleHourlyActualChange(cb.patternRef!, slot.time, e.target.value)}
                                className="w-20 h-9 mx-auto bg-[#F4F6FB] border-[#4285F4]/30 focus:border-[#4285F4] font-mono text-[#4285F4] text-center px-2 text-sm shadow-inner placeholder:text-[#94A3B8]"
                                placeholder="Act"
                              />
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
                      {activeKnockouts.map(cb => {
                        const plannedTarget = getColTotal(cb.patternRef!)
                        const pattern = patterns.find(p => p.code === cb.patternRef)
                        
                        const selectedEq = equipments.find(e => e.id === activeMachineTab)
                        const avgProd = resolveAvgProductionRate(Number(pattern?.avgKnockoutsPerHour) || undefined, selectedEq?.avgPiecesPerHour)
                        
                        const expectedOutput = getExpectedOutput(cb.patternRef!, avgProd)
                        
                        const isAtRisk = expectedOutput < plannedTarget && plannedTarget > 0
                        const isOnTrack = expectedOutput >= plannedTarget && plannedTarget > 0
                        
                        const key = `${activeMachineTab}_${cb.patternRef}`
                        const totalWorkers = Math.max(0, ...Object.values(workers[key] || {}).map(w => w || 0))

                        return [
                          <td key={`${cb.patternRef}-total`} className="px-4 py-4 text-center font-mono font-bold text-lg text-[#4285F4] border-r border-[#E0E7FF]/20">
                            {plannedTarget}
                          </td>,
                          <td key={`${cb.patternRef}-expected`} className="bg-[#EEF2FF] px-2 py-4 align-middle">
                            <div className="flex flex-col items-center justify-center space-y-1.5">
                              <span className="text-[10px] text-[#172554] font-mono font-bold">Cap: {expectedOutput.toFixed(0)}</span>
                              {totalWorkers === 0 ? (
                                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-[#F4F6FB] text-[#64748B] border border-[#E0E7FF]">Unassigned</span>
                              ) : isAtRisk ? (
                                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">At Risk</span>
                              ) : (
                                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20">On Track</span>
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
          {selectedOrder && activeKnockouts.length > 0 && activeMachineTab && (
            <div className="border border-[#E0E7FF] rounded-xl overflow-hidden mt-8">
              <div className="w-full flex items-center justify-between bg-[#EEF2FF] p-4 text-[#172554]">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm">End of Day — Actual Entry ({equipments.find(e => e.id === activeMachineTab)?.name})</h3>
                  <span className="text-xs text-[#64748B]">Enter produced quantities</span>
                </div>
              </div>
              
              <div className="p-4 bg-[#F4F6FB] space-y-3">
                  {activeKnockouts.map(cb => {
                    const planned = getColTotal(cb.patternRef!)
                    const key = `${activeMachineTab}_${cb.patternRef}`
                    const act = actuals[key]
                    const hasAct = act !== undefined && act !== null
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
                            value={hasAct ? act : ''}
                            onChange={e => setActuals(prev => ({ ...prev, [key]: e.target.value === '' ? undefined : Number(e.target.value) })) as any}
                            className={cn(
                              "h-8 bg-[#F4F6FB] text-[#172554] font-mono px-2 text-sm w-full",
                              !hasAct ? "border-red-500/50 focus:border-red-500" : "border-[#E0E7FF]"
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
