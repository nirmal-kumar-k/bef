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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { BacklogItem } from './daily-planning-modal'
import { Fire, Trash, Plus, Clock, WarningCircle } from '@phosphor-icons/react'
import { cn } from '@/shared/lib/utils'
import type { Shift } from './shift-master-page'

interface MeltPlanningModalProps {
  isOpen: boolean
  onClose: () => void
  date: string
  openOrders: any[]
  backlogData: BacklogItem[]
  dailyPlans: any[]
  patterns: any[]
  products: any[]
  onSaveDayPlan: (date: string, plans: any[]) => void
}

interface Heat {
  id: string
  furnaceId: string
  heatNumber: number
  startTime: string
  endTime: string
}

interface Pour {
  id: string
  planId?: string
  furnaceId: string
  heatId: string
  orderId: string
  orderNo: string
  patternRef: string
  productName: string
  grade: string
  mouldWeight: number
  mouldsScheduled: number
  isConfirmed: boolean
  itemId: string
}

const parseTime = (timeStr: string) => {
  // Parses "HH:MM AM/PM" or "HH:MM" into minutes from midnight
  if (!timeStr) return 0
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i)
  if (!match) return 0
  let h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  const ampm = match[3]?.toUpperCase()
  if (ampm === 'PM' && h < 12) h += 12
  if (ampm === 'AM' && h === 12) h = 0
  return h * 60 + m
}

const formatTime = (mins: number) => {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`
}

export function MeltPlanningModal({
  isOpen,
  onClose,
  date,
  openOrders,
  backlogData,
  dailyPlans,
  patterns,
  products,
  onSaveDayPlan
}: MeltPlanningModalProps) {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [equipments, setEquipments] = useState<any[]>([])
  const [selectedShiftId, setSelectedShiftId] = useState<string>('')
  const [activeFurnaceId, setActiveFurnaceId] = useState<string>('')

  const [heats, setHeats] = useState<Heat[]>([])
  const [pours, setPours] = useState<Pour[]>([])

  const [allocationHeatId, setAllocationHeatId] = useState<string | null>(null)
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null)

  // Fetch Master Data
  useEffect(() => {
    if (isOpen) {
      if (shifts.length === 0) {
        fetch('/api/shifts').then(r => r.json()).then(data => {
          const active = data.filter((s: Shift) => s.isActive)
          setShifts(active)
          if (active.length > 0 && !selectedShiftId) setSelectedShiftId(active[0].id!)
        }).catch(console.error)
      }
      if (equipments.length === 0) {
        fetch('/api/equipment').then(r => r.json()).then(data => {
          const furnaces = data.filter((e: any) => e.type === 'Furnace' && e.isActive)
          setEquipments(furnaces)
          if (furnaces.length > 0 && !activeFurnaceId) setActiveFurnaceId(furnaces[0].id)
        }).catch(console.error)
      }
    }
  }, [isOpen])

  // Initialize from dailyPlans
  useEffect(() => {
    if (isOpen && dailyPlans && equipments.length > 0) {
      const existingMelt = dailyPlans.filter(p => p.stage === 'Melt')
      
      const loadedHeats: Record<string, Heat> = {}
      const loadedPours: Pour[] = []

      existingMelt.forEach(p => {
        const eqId = p.equipmentId || equipments[0].id
        const hNum = p.heatNumber || 1
        const hId = `${eqId}-heat-${hNum}`
        
        if (!loadedHeats[hId]) {
          loadedHeats[hId] = {
            id: hId,
            furnaceId: eqId,
            heatNumber: hNum,
            startTime: p.startTime || '08:00 AM',
            endTime: p.endTime || '09:30 AM'
          }
        }

        const order = openOrders.find(o => o.id === p.orderId)
        const product = products.find(prod => prod.name === order?.cart?.find((c:any) => c.productName)?.productName || prod.code === order?.cart?.find((c:any) => c.product)?.product)
        const pattern = patterns.find(pat => pat.code === p.patternRef)
        const mouldWeight = pattern?.totalWeight || 20

        loadedPours.push({
          id: Math.random().toString(),
          planId: p.id || p._id,
          furnaceId: eqId,
          heatId: hId,
          orderId: p.orderId || '',
          orderNo: order?.customerOrderNo || '',
          patternRef: p.patternRef || '',
          productName: product?.name || '',
          grade: product?.grade || 'Unassigned',
          mouldWeight: mouldWeight,
          mouldsScheduled: p.mouldsScheduled || Math.ceil(p.quantityScheduled / mouldWeight) || 0,
          isConfirmed: !!p.isConfirmed,
          itemId: p.itemId
        })
      })

      setHeats(Object.values(loadedHeats))
      setPours(loadedPours)
    }
  }, [isOpen, dailyPlans, equipments, openOrders, products, patterns])

  // Auto-generate Heats for active furnace if none exist
  useEffect(() => {
    if (activeFurnaceId && heats.filter(h => h.furnaceId === activeFurnaceId).length === 0) {
      const shift = shifts.find(s => s.id === selectedShiftId)
      const furnace = equipments.find(e => e.id === activeFurnaceId)
      if (shift && furnace) {
        let currentStart = parseTime(shift.startTime)
        const newHeats: Heat[] = []
        for (let i = 1; i <= 4; i++) { // Generate 4 heats by default
          const duration = i === 1 ? (furnace.firstHeatDurationMins || 120) : (furnace.regularHeatDurationMins || 90)
          const end = currentStart + duration
          newHeats.push({
            id: `${activeFurnaceId}-heat-${i}`,
            furnaceId: activeFurnaceId,
            heatNumber: i,
            startTime: formatTime(currentStart),
            endTime: formatTime(end)
          })
          currentStart = end
        }
        setHeats(prev => {
          if (prev.some(h => h.furnaceId === activeFurnaceId)) return prev
          return [...prev, ...newHeats]
        })
      }
    }
  }, [activeFurnaceId, selectedShiftId, shifts, equipments, heats.length])

  // Group backlog by Grade
  const backlogByGrade = useMemo(() => {
    const map = new Map<string, BacklogItem[]>()
    backlogData.filter(b => b.totalRequired > b.totalScheduled).forEach(b => {
      const product = products.find(p => p.name === b.productName)
      const grade = product?.grade || 'Unassigned'
      if (!map.has(grade)) map.set(grade, [])
      map.get(grade)!.push(b)
    })
    return map
  }, [backlogData, products])

  const handleSave = () => {
    const plansToSave = pours.map(p => {
      const h = heats.find(ht => ht.id === p.heatId)
      return {
        id: p.planId,
        _id: p.planId,
        orderId: p.orderId,
        itemId: p.itemId,
        stage: 'Melt',
        patternRef: p.patternRef,
        quantityScheduled: p.mouldsScheduled * p.mouldWeight,
        mouldsScheduled: p.mouldsScheduled,
        shiftId: selectedShiftId,
        laborersAssigned: 1,
        equipmentId: p.furnaceId,
        heatNumber: h?.heatNumber || 1,
        startTime: h?.startTime,
        endTime: h?.endTime,
        isConfirmed: p.isConfirmed
      }
    })
    onSaveDayPlan(date, plansToSave)
    onClose()
  }

  // Adjust cascade heat timings
  const handleHeatTimeChange = (heatId: string, newStartTime: string) => {
    setHeats(prev => {
      const furnaceHeats = [...prev.filter(h => h.furnaceId === activeFurnaceId)].sort((a, b) => a.heatNumber - b.heatNumber)
      const otherHeats = prev.filter(h => h.furnaceId !== activeFurnaceId)
      
      const targetIdx = furnaceHeats.findIndex(h => h.id === heatId)
      if (targetIdx === -1) return prev

      const furnace = equipments.find(e => e.id === activeFurnaceId)
      const firstDur = furnace?.firstHeatDurationMins || 120
      const regDur = furnace?.regularHeatDurationMins || 90

      let currentMins = parseTime(newStartTime)
      
      for (let i = targetIdx; i < furnaceHeats.length; i++) {
        const h = furnaceHeats[i]
        const dur = h.heatNumber === 1 ? firstDur : regDur
        h.startTime = formatTime(currentMins)
        currentMins += dur
        h.endTime = formatTime(currentMins)
      }

      return [...otherHeats, ...furnaceHeats]
    })
  }

  const addPour = (heatId: string, backlogItem: BacklogItem, mouldsToPour: number) => {
    if (mouldsToPour <= 0) return
    const order = openOrders.find(o => o.customerOrderNo === backlogItem.orderNo)
    const pattern = patterns.find(p => p.code === backlogItem.patternRef)
    const product = products.find(p => p.name === backlogItem.productName)

    setPours(prev => [...prev, {
      id: Math.random().toString(),
      furnaceId: activeFurnaceId,
      heatId: heatId,
      orderId: order?.id || '',
      orderNo: backlogItem.orderNo,
      patternRef: backlogItem.patternRef,
      productName: backlogItem.productName,
      grade: product?.grade || 'Unassigned',
      mouldWeight: pattern?.totalWeight || 20,
      mouldsScheduled: mouldsToPour,
      isConfirmed: false,
      itemId: backlogItem.itemId
    }])
    setAllocationHeatId(null)
    setSelectedGrade(null)
  }

  const removePour = (pourId: string) => {
    setPours(prev => prev.filter(p => p.id !== pourId))
  }

  const dateObj = new Date(date || new Date())
  const dateString = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  
  const furnace = equipments.find(e => e.id === activeFurnaceId)
  const maxCapacity = furnace?.maxMeltCapacityKg || 150
  
  const activeHeats = heats.filter(h => h.furnaceId === activeFurnaceId).sort((a, b) => a.heatNumber - b.heatNumber)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-[1200px] min-h-[60vh] max-h-[90vh] bg-[#F4F6FB] border-[#E0E7FF] text-foreground p-0 shadow-2xl flex flex-col">
        <div className="flex flex-col w-full h-full">
          {/* Header */}
          <DialogHeader className="p-6 pb-4 border-b border-[#E0E7FF] shrink-0 bg-white">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl font-heading text-[#172554]">
                  {dateString} - Melt Planning
                </DialogTitle>
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-[#64748B] text-xs font-semibold uppercase tracking-wider">Select Shift:</span>
                  {shifts.length > 0 && (
                    <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                      <SelectTrigger className="h-9 px-4 text-sm font-semibold rounded-lg border border-[#E0E7FF] bg-[#FFFFFF] text-[#172554] shadow-sm hover:bg-[#F8FAFC] w-48">
                        <SelectValue placeholder="Select Shift" />
                      </SelectTrigger>
                      <SelectContent>
                        {shifts.map(s => (
                          <SelectItem key={s.id} value={s.id!} className="text-[#172554] text-sm">
                            {s.name} ({s.startTime} - {s.endTime})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Body */}
          <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-6">
            {/* Furnace Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 border-b border-[#E0E7FF]">
              {equipments.map(eq => (
                <Button
                  key={eq.id}
                  variant={activeFurnaceId === eq.id ? "default" : "outline"}
                  className={cn(
                    "h-11 px-8 text-sm font-bold transition-all rounded-t-xl rounded-b-none border-b-0",
                    activeFurnaceId === eq.id 
                      ? "bg-amber-500 text-white shadow-[0_-4px_10px_-2px_rgba(245,158,11,0.2)] hover:bg-amber-600" 
                      : "bg-[#FFFFFF] border-[#E0E7FF] text-[#64748B] hover:bg-amber-50 hover:text-amber-700"
                  )}
                  onClick={() => setActiveFurnaceId(eq.id)}
                >
                  <Fire weight={activeFurnaceId === eq.id ? "fill" : "regular"} className="w-5 h-5 mr-2" />
                  {eq.name}
                </Button>
              ))}
            </div>

            {/* Furnace Schedule */}
            {activeFurnaceId && (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="font-bold text-[#172554] text-lg">Heat Schedule</h3>
                  <div className="text-sm text-[#64748B] font-semibold flex gap-4">
                    <span>First Heat: <span className="text-amber-600">{furnace?.firstHeatDurationMins || 120}m</span></span>
                    <span>Regular Heat: <span className="text-amber-600">{furnace?.regularHeatDurationMins || 90}m</span></span>
                    <span>Max Capacity: <span className="text-amber-600">{maxCapacity} kg</span></span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {activeHeats.map(heat => {
                    const heatPours = pours.filter(p => p.heatId === heat.id)
                    const totalWeight = heatPours.reduce((sum, p) => sum + (p.mouldsScheduled * p.mouldWeight), 0)
                    const isOverCapacity = totalWeight > maxCapacity

                    return (
                      <div key={heat.id} className={cn(
                        "bg-white rounded-xl border shadow-sm flex flex-col overflow-hidden transition-all",
                        isOverCapacity ? "border-red-300 ring-1 ring-red-300" : "border-[#E0E7FF]"
                      )}>
                        {/* Heat Header */}
                        <div className={cn(
                          "px-4 py-3 border-b flex items-center justify-between",
                          isOverCapacity ? "bg-red-50 border-red-200" : "bg-[#F8FAFC] border-[#E0E7FF]"
                        )}>
                          <div className="flex items-center gap-3">
                            <span className="font-black text-lg text-[#172554]">Heat {heat.heatNumber}</span>
                            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-[#E0E7FF] shadow-sm">
                              <Clock className="w-4 h-4 text-[#94A3B8]" />
                              <Input 
                                value={heat.startTime} 
                                onChange={e => handleHeatTimeChange(heat.id, e.target.value)}
                                className="w-20 h-6 px-1 py-0 text-xs font-mono border-none focus-visible:ring-1 focus-visible:ring-amber-500 text-center"
                              />
                              <span className="text-[#94A3B8] text-xs">-</span>
                              <span className="w-20 text-center text-xs font-mono text-[#64748B]">{heat.endTime}</span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] font-bold uppercase text-[#94A3B8]">Total Weight</span>
                            <span className={cn(
                              "font-mono font-bold text-sm",
                              isOverCapacity ? "text-red-600" : "text-[#10B981]"
                            )}>
                              {totalWeight.toFixed(1)} / {maxCapacity} kg
                            </span>
                          </div>
                        </div>

                        {/* Heat Body */}
                        <div className="p-4 flex-1 flex flex-col gap-3">
                          {heatPours.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center text-[#94A3B8] text-sm italic py-4">
                              No moulds allocated to this heat yet.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {heatPours.map(pour => (
                                <div key={pour.id} className="flex items-center justify-between bg-[#F4F6FB] p-2 rounded-lg border border-[#E0E7FF]">
                                  <div className="flex flex-col">
                                    <span className="font-bold text-sm text-[#172554]">{pour.patternRef} <span className="text-xs font-normal text-[#64748B]">({pour.grade})</span></span>
                                    <span className="text-[10px] text-[#94A3B8]">{pour.orderNo} | {pour.mouldWeight} kg/mould</span>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <span className="font-mono font-bold text-amber-600">{pour.mouldsScheduled} moulds</span>
                                    <Button variant="ghost" size="icon" onClick={() => removePour(pour.id)} className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50">
                                      <Trash className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Add Pour Button / Popover */}
                          <Popover open={allocationHeatId === heat.id} onOpenChange={(open) => {
                            if (open) setAllocationHeatId(heat.id)
                            else { setAllocationHeatId(null); setSelectedGrade(null) }
                          }}>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full mt-auto border-dashed border-amber-300 text-amber-600 hover:bg-amber-50 hover:text-amber-700 font-semibold h-9">
                                <Plus className="w-4 h-4 mr-2" /> Add Pouring Allocation
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[450px] p-0 shadow-2xl border-[#E0E7FF] rounded-xl" side="bottom" align="center">
                              <div className="flex flex-col bg-white rounded-xl overflow-hidden">
                                <div className="p-3 bg-gradient-to-r from-amber-50 to-white border-b border-[#E0E7FF]">
                                  <h4 className="font-bold text-[#172554] text-sm flex items-center gap-2">
                                    <Fire className="w-4 h-4 text-amber-500" /> Allocate to Heat {heat.heatNumber}
                                  </h4>
                                </div>
                                <div className="flex h-[300px]">
                                  {/* Grades Sidebar */}
                                  <div className="w-1/3 border-r border-[#E0E7FF] bg-[#F8FAFC] overflow-y-auto">
                                    <div className="p-2 text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">Grades</div>
                                    {Array.from(backlogByGrade.keys()).map(grade => (
                                      <button 
                                        key={grade}
                                        onClick={() => setSelectedGrade(grade)}
                                        className={cn(
                                          "w-full text-left px-3 py-2 text-sm font-semibold transition-colors border-l-4",
                                          selectedGrade === grade 
                                            ? "bg-amber-100/50 border-amber-500 text-amber-800" 
                                            : "border-transparent text-[#64748B] hover:bg-white"
                                        )}
                                      >
                                        {grade}
                                      </button>
                                    ))}
                                    {backlogByGrade.size === 0 && (
                                      <div className="p-3 text-xs text-[#94A3B8]">No pending backlog.</div>
                                    )}
                                  </div>
                                  {/* Moulds List */}
                                  <div className="w-2/3 overflow-y-auto p-3 space-y-3 bg-white">
                                    {!selectedGrade ? (
                                      <div className="h-full flex items-center justify-center text-xs text-[#94A3B8] italic">
                                        Select a grade to see moulds.
                                      </div>
                                    ) : (
                                      backlogByGrade.get(selectedGrade)?.map(b => {
                                        const pattern = patterns.find(p => p.code === b.patternRef)
                                        const boxWeight = pattern?.totalWeight || 20
                                        const remainingMoulds = Math.ceil((b.totalRequired - b.totalScheduled) / boxWeight)
                                        const remainingHeatCapacity = Math.max(0, maxCapacity - totalWeight)
                                        const possibleMoulds = Math.floor(remainingHeatCapacity / boxWeight)
                                        const maxAllowed = Math.min(remainingMoulds, possibleMoulds)
                                        
                                        return (
                                          <PourAllocationRow 
                                            key={b.itemId}
                                            backlogItem={b}
                                            boxWeight={boxWeight}
                                            maxAllowed={maxAllowed}
                                            onAdd={(qty) => addPour(heat.id, b, qty)}
                                          />
                                        )
                                      })
                                    )}
                                  </div>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>

                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="m-0 p-5 border-t border-[#E0E7FF] bg-[#FFFFFF] shrink-0 sm:justify-end rounded-b-2xl">
            <Button variant="ghost" onClick={onClose} className="text-[#64748B] hover:text-[#172554] hover:bg-[#F8FAFC]">Cancel</Button>
            <Button onClick={handleSave} className="bg-amber-500 text-white hover:bg-amber-600 shadow-md h-10 px-8 text-sm font-bold">Save Day Plan</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PourAllocationRow({ backlogItem, boxWeight, maxAllowed, onAdd }: { backlogItem: BacklogItem, boxWeight: number, maxAllowed: number, onAdd: (qty: number) => void }) {
  const [qty, setQty] = useState<string>('')

  const handleAdd = () => {
    const val = parseInt(qty, 10)
    if (!isNaN(val) && val > 0 && val <= maxAllowed) {
      onAdd(val)
    }
  }

  return (
    <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E0E7FF] flex flex-col gap-2">
      <div>
        <div className="font-bold text-[#172554] text-sm">{backlogItem.patternRef}</div>
        <div className="text-[10px] text-[#64748B]">{backlogItem.orderNo} | {boxWeight} kg/box</div>
      </div>
      <div className="flex items-center justify-between mt-1">
        <div className="text-[10px] font-semibold text-amber-600">Max Possible: {maxAllowed}</div>
        <div className="flex items-center gap-1">
          <Input 
            type="number" 
            min="1" 
            max={maxAllowed} 
            value={qty} 
            onChange={e => setQty(e.target.value)} 
            placeholder="Qty" 
            className="w-16 h-7 text-xs font-mono text-center focus-visible:ring-1 focus-visible:ring-amber-500"
          />
          <Button size="sm" onClick={handleAdd} disabled={!qty || parseInt(qty) > maxAllowed || parseInt(qty) <= 0} className="h-7 bg-[#172554] hover:bg-[#1E293B] text-white text-[10px] px-2">
            Add
          </Button>
        </div>
      </div>
      {parseInt(qty) > maxAllowed && (
        <div className="text-[9px] text-red-500 flex items-center gap-1">
          <WarningCircle weight="fill"/> Exceeds furnace capacity!
        </div>
      )}
    </div>
  )
}
