import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/ui/dialog'
import { Button, buttonVariants } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/shared/ui/command'
import { BacklogItem } from './daily-planning-modal'
import { CubeTransparent, Trash, CaretDown, MagicWand } from '@phosphor-icons/react'
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

interface PlannedRow {
  id: string
  planId?: string
  orderId: string
  orderNo: string
  productName: string
  patternRef: string
  machineId: string
  targetQty: string
  hourlyTargets: Record<string, number>
  hourlyWorkers: Record<string, number>
  hourlyActuals: Record<string, number>
  actualQuantity?: number
  isConfirmed: boolean
  // Quantity this row already contributed to the backlog's totalScheduled when the
  // modal opened - needed to compute how much MORE this row can take without
  // double-subtracting its own prior contribution from the remaining pending qty.
  originalQty: number
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
  // Master Data
  const [shifts, setShifts] = useState<Shift[]>([])
  const [equipments, setEquipments] = useState<any[]>([])
  
  // Selection
  const [selectedShiftId, setSelectedShiftId] = useState<string>('')
  const [activeMachineId, setActiveMachineId] = useState<string>('')
  
  // Rows
  const [plannedRows, setPlannedRows] = useState<PlannedRow[]>([])

  // UI Toggles
  const [viewLabourers, setViewLabourers] = useState<boolean>(false)
  const [comboboxOpen, setComboboxOpen] = useState(false)

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
              setSelectedShiftId(activeShifts[0].id!)
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
            if (mouldEquips.length > 0 && !activeMachineId) {
              setActiveMachineId(mouldEquips[0].id)
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

  // Initialize plans
  useEffect(() => {
    if (isOpen && dailyPlans) {
      const existingMouldPlans = dailyPlans.filter(p => p.stage === 'Mould')
      const initRows: PlannedRow[] = existingMouldPlans.map(p => {
        const order = openOrders.find(o => o.id === p.orderId)
        return {
          id: Math.random().toString(),
          planId: p.id || p._id,
          orderId: p.orderId || '',
          orderNo: order?.customerOrderNo || '',
          productName: order?.productName || '',
          patternRef: p.patternRef || '',
          machineId: p.equipmentId || '',
          targetQty: p.quantityScheduled ? String(p.quantityScheduled) : '',
          hourlyTargets: p.hourlyTargets || {},
          hourlyWorkers: p.hourlyWorkers || {},
          hourlyActuals: p.hourlyActuals || {},
          actualQuantity: p.actualQuantity,
          isConfirmed: !!p.isConfirmed,
          originalQty: p.quantityScheduled || 0
        }
      })
      setPlannedRows(initRows)
    }
  }, [isOpen, dailyPlans, openOrders])

  // Top panel metrics (Global across all planned items)
  const topMetrics = useMemo(() => {
    let beginningOfDay = 0
    let dayProduction = 0
    let endOfDay = 0
    
    // Group backlog items
    const groupedBacklog = new Map<string, BacklogItem>()
    backlogData.forEach(b => {
      if (!b.patternRef) return
      const key = `${b.orderNo}-${b.patternRef}`
      if (groupedBacklog.has(key)) {
        const existing = groupedBacklog.get(key)!
        existing.totalRequired += b.totalRequired
        existing.totalScheduled += b.totalScheduled
      } else {
        groupedBacklog.set(key, { ...b })
      }
    })
    
    Array.from(groupedBacklog.values()).forEach(b => {
      beginningOfDay += Math.max(0, b.totalRequired - b.totalScheduled)
    })
    
    plannedRows.forEach(r => {
      const target = parseInt(r.targetQty, 10) || 0
      dayProduction += target
    })
    
    endOfDay = Math.max(0, beginningOfDay - dayProduction)
    
    return { beginningOfDay, dayProduction, endOfDay }
  }, [backlogData, plannedRows])

  const handleSave = () => {
    const plansToSave = plannedRows.map(r => {
      const totalScheduled = parseInt(r.targetQty, 10) || 0
      const maxWorkers = Math.max(1, ...Object.values(r.hourlyWorkers))
      
      const eq = equipments.find(e => e.id === r.machineId)
      const pattern = patterns.find(p => p.code === r.patternRef)
      const avgProd = Number(pattern?.avgMouldsPerHour) || eq?.avgPiecesPerHour || 10
      const shiftHours = TIME_SLOTS.reduce((s, sl) => s + sl.hours, 0)
      const possibleQty = Math.round(avgProd * shiftHours)

      const hourlyEquipments: Record<string, string> = {}
      TIME_SLOTS.forEach(slot => {
        if (r.hourlyTargets[slot.time] > 0) {
          hourlyEquipments[slot.time] = r.machineId
        }
      })

      return {
        id: r.planId,
        _id: r.planId,
        orderId: r.orderId,
        itemId: `${r.orderId}-0`,
        stage: 'Mould',
        patternRef: r.patternRef,
        quantityScheduled: totalScheduled,
        shiftId: selectedShiftId,
        laborersAssigned: maxWorkers,
        workersAssigned: maxWorkers,
        equipmentId: r.machineId,
        hourlyEquipments,
        hourlyTargets: r.hourlyTargets,
        hourlyWorkers: r.hourlyWorkers,
        hourlyActuals: r.hourlyActuals,
        actualQuantity: r.actualQuantity,
        isConfirmed: r.isConfirmed,
        possibleQuantity: possibleQty
      }
    })
    
    onSaveDayPlan(date, plansToSave)
    onClose()
  }

  // How much more this row can be scheduled for without exceeding the pending
  // backlog quantity. backlogData.totalScheduled already includes this row's own
  // prior saved value (if it existed before this session), so that's added back in
  // - otherwise editing an existing row would immediately look "over budget" by its
  // own amount.
  const getMaxAllowedQty = (row: PlannedRow) => {
    const backlogItem = backlogData.find(b => b.orderNo === row.orderNo && b.patternRef === row.patternRef)
    if (!backlogItem) return Infinity
    return Math.max(0, backlogItem.totalRequired - backlogItem.totalScheduled + row.originalQty)
  }

  // Auto-fill logic
  const handleTargetQtyInput = (rowId: string, value: string) => {
    setPlannedRows(prev => prev.map(r => {
      if (r.id !== rowId) return r
      if (value === '') return { ...r, targetQty: value }
      const num = parseInt(value, 10)
      if (isNaN(num)) return { ...r, targetQty: value }
      const capped = Math.min(num, getMaxAllowedQty(r))
      return { ...r, targetQty: String(capped) }
    }))
  }

  // Shared hourly distribution: spreads target qty evenly across time slots using
  // avg-moulds-production for worker counts. The first slot of the shift is always
  // left out - the machine isn't actually productive at the shift's nominal start
  // time (warm-up/changeover), real output starts from the second slot.
  const distributeQty = (target: number, patternRef: string, machineId: string) => {
    const pattern = patterns.find(p => p.code === patternRef)
    const eq = equipments.find(e => e.id === machineId)
    const avgProd = Number(pattern?.avgMouldsPerHour) || eq?.avgPiecesPerHour || 10

    const hourlyTargets: Record<string, number> = {}
    const hourlyWorkers: Record<string, number> = {}

    const fillableSlots = TIME_SLOTS.slice(1)
    if (TIME_SLOTS[0]) {
      hourlyTargets[TIME_SLOTS[0].time] = 0
      hourlyWorkers[TIME_SLOTS[0].time] = 0
    }

    const basePerSlot = fillableSlots.length > 0 ? Math.floor(target / fillableSlots.length) : 0
    let remainder = target - (basePerSlot * fillableSlots.length)

    fillableSlots.forEach(slot => {
      const qty = basePerSlot + (remainder > 0 ? 1 : 0)
      if (remainder > 0) remainder--

      hourlyTargets[slot.time] = qty
      hourlyWorkers[slot.time] = qty > 0 ? Math.max(1, Math.ceil(qty / (avgProd * slot.hours))) : 0
    })

    return { hourlyTargets, hourlyWorkers }
  }

  const autoFillRow = (rowId: string) => {
    setPlannedRows(prev => {
      const row = prev.find(r => r.id === rowId)
      if (!row) return prev

      const target = parseInt(row.targetQty, 10)
      if (isNaN(target) || target <= 0) return prev

      const { hourlyTargets, hourlyWorkers } = distributeQty(target, row.patternRef, row.machineId)
      return prev.map(r => r.id === rowId ? { ...r, hourlyTargets, hourlyWorkers } : r)
    })
  }

  const handleActualChange = (rowId: string, value: string) => {
    const num = value === '' ? undefined : parseInt(value, 10)
    setPlannedRows(prev => prev.map(r => r.id === rowId ? { ...r, actualQuantity: num } : r))
  }

  const handleHourlyChange = (rowId: string, timeSlot: string, value: string) => {
    const num = value === '' ? undefined : parseInt(value, 10)
    setPlannedRows(prev => prev.map(r => {
      if (r.id !== rowId) return r
      const otherSlotsTotal = Object.entries(r.hourlyTargets).reduce((a, [slot, v]) => slot === timeSlot ? a : a + (v || 0), 0)
      const maxAllowed = getMaxAllowedQty(r)
      const cappedValue = Math.max(0, Math.min(num || 0, maxAllowed - otherSlotsTotal))
      const newTargets = { ...r.hourlyTargets, [timeSlot]: cappedValue }
      const newTotal = otherSlotsTotal + cappedValue
      return { ...r, hourlyTargets: newTargets, targetQty: String(newTotal) }
    }))
  }
  
  const handleWorkerChange = (rowId: string, timeSlot: string, delta: number) => {
    setPlannedRows(prev => prev.map(r => {
      if (r.id !== rowId) return r
      const current = r.hourlyWorkers[timeSlot] || 0
      const next = Math.max(0, current + delta)
      return { ...r, hourlyWorkers: { ...r.hourlyWorkers, [timeSlot]: next } }
    }))
  }

  const addPatternToMachine = (backlogItemKey: string) => {
    if (!backlogItemKey) return
    const [orderNo, patternRef] = backlogItemKey.split('|')
    const b = backlogData.find(b => b.orderNo === orderNo && b.patternRef === patternRef)
    if (!b) return
    const order = openOrders.find(o => o.customerOrderNo === orderNo)

    const remaining = Math.max(0, b.totalRequired - b.totalScheduled)
    const { hourlyTargets, hourlyWorkers } = remaining > 0
      ? distributeQty(remaining, patternRef, activeMachineId)
      : { hourlyTargets: {}, hourlyWorkers: {} }

    setPlannedRows(prev => [...prev, {
      id: Math.random().toString(),
      orderId: order?.id || '',
      orderNo: orderNo,
      productName: order?.productName || '',
      patternRef: patternRef,
      machineId: activeMachineId,
      targetQty: remaining > 0 ? String(remaining) : '',
      hourlyTargets,
      hourlyWorkers,
      hourlyActuals: {},
      isConfirmed: false,
      originalQty: 0
    }])
    setComboboxOpen(false)
  }

  const removeRow = (rowId: string) => {
    setPlannedRows(prev => prev.filter(r => r.id !== rowId))
  }

  const dateObj = new Date(date || new Date())
  const dateString = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  
  const activeRows = plannedRows.filter(r => r.machineId === activeMachineId)

  // Combobox options for backlog items needing scheduling
  const backlogOptions = useMemo(() => {
    // Exclude patterns that already have a row on this machine this session -
    // adding the same one twice would double-book it and, on save, create a second
    // DB row instead of updating the first (since neither carries the other's id),
    // silently doubling what counts as "already scheduled" from then on.
    const alreadyOnMachine = new Set(activeRows.map(r => `${r.orderNo}|${r.patternRef}`))
    const options = new Map<string, BacklogItem>()
    backlogData.filter(b => b.totalRequired > b.totalScheduled).forEach(b => {
      const key = `${b.orderNo}|${b.patternRef}`
      if (!alreadyOnMachine.has(key)) options.set(key, b)
    })
    return Array.from(options.values())
  }, [backlogData, activeRows])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[98vw] sm:max-w-[98vw] min-h-[60vh] max-h-[95vh] bg-[#F4F6FB] border-[#E0E7FF] text-foreground p-0 shadow-2xl flex flex-col">
        <div className="flex flex-col w-full h-full">
          <DialogHeader className="p-6 pb-4 border-b border-[#E0E7FF] shrink-0 bg-white">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl font-heading text-[#172554]">
                  {dateString} - Mould Planning
                </DialogTitle>
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-[#64748B] text-xs font-semibold uppercase tracking-wider">Select Shift:</span>
                  {shifts.length > 0 && (
                    <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                      <SelectTrigger className="h-9 px-4 text-sm font-semibold rounded-lg border border-[#E0E7FF] bg-[#FFFFFF] text-[#172554] shadow-sm hover:bg-[#F8FAFC]">
                        <SelectValue placeholder="Select Shift" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#FFFFFF] border-[#E0E7FF]">
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
              
              <div className="flex gap-6 bg-[#FFFFFF] p-4 rounded-xl border border-[#E0E7FF] shadow-sm">
                <div className="text-center px-4">
                  <p className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider mb-1">Beginning of Day</p>
                  <p className="text-2xl font-mono font-bold text-[#172554]">{topMetrics.beginningOfDay}</p>
                </div>
                <div className="w-px bg-[#E0E7FF]"></div>
                <div className="text-center px-4">
                  <p className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider mb-1">Day Production</p>
                  <p className="text-2xl font-mono font-bold text-[#4285F4]">{topMetrics.dayProduction}</p>
                </div>
                <div className="w-px bg-[#E0E7FF]"></div>
                <div className="text-center px-4">
                  <p className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider mb-1">End of Day</p>
                  <p className="text-2xl font-mono font-bold text-[#10B981]">{topMetrics.endOfDay}</p>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-6">
            {/* Machine Tabs */}
            <div className="flex items-center justify-between border-b border-[#E0E7FF] pb-2">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {equipments.map(eq => (
                  <Button
                    key={eq.id}
                    variant={activeMachineId === eq.id ? "default" : "outline"}
                    className={cn(
                      "h-11 px-8 text-sm font-bold transition-all rounded-t-xl rounded-b-none border-b-0",
                      activeMachineId === eq.id 
                        ? "bg-[#4F46E5] text-white shadow-[0_-4px_10px_-2px_rgba(79,70,229,0.2)]" 
                        : "bg-[#FFFFFF] border-[#E0E7FF] text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#172554]"
                    )}
                    onClick={() => setActiveMachineId(eq.id)}
                  >
                    <CubeTransparent weight={activeMachineId === eq.id ? "fill" : "regular"} className="w-5 h-5 mr-2" />
                    {eq.name}
                  </Button>
                ))}
              </div>
              
              <div className="flex items-center gap-3 pr-4 bg-white px-4 py-2 rounded-full border border-[#E0E7FF] shadow-sm">
                 <Label htmlFor="viewLabMould" className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Labourers</Label>
                 <Switch id="viewLabMould" checked={viewLabourers} onCheckedChange={setViewLabourers} className="data-[state=checked]:bg-[#4F46E5]" />
              </div>
            </div>

            {/* Active Machine Content */}
            {activeMachineId && (
              <>
              <div className="bg-white rounded-xl border border-[#E0E7FF] shadow-lg overflow-hidden">
                <div className="p-5 border-b border-[#E0E7FF] flex items-center justify-between bg-gradient-to-r from-[#F8FAFC] to-white">
                  <h3 className="font-bold text-[#172554] text-lg flex items-center gap-2">
                    Schedule for {equipments.find(e => e.id === activeMachineId)?.name}
                  </h3>
                  
                  <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                    <PopoverTrigger
                      role="combobox"
                      aria-expanded={comboboxOpen}
                      className={cn(buttonVariants(), "w-[320px] justify-between h-10 bg-[#4F46E5] text-white hover:bg-[#4F46E5]/90 font-semibold shadow-md")}
                    >
                      + Add Pattern to Schedule
                      <CaretDown className="ml-2 h-4 w-4 shrink-0 opacity-70" />
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] p-0 bg-white border-[#E0E7FF] shadow-xl rounded-xl">
                      <Command>
                        <CommandInput placeholder="Search Order or Pattern..." className="border-none focus:ring-0 text-sm h-11" />
                        <CommandList className="max-h-[300px] overflow-y-auto">
                          <CommandEmpty className="py-6 text-center text-sm text-[#94A3B8]">No pending patterns found.</CommandEmpty>
                          <CommandGroup heading="Pending Backlog">
                            {backlogOptions.map((b) => (
                              <CommandItem
                                key={`${b.orderNo}|${b.patternRef}`}
                                value={`${b.orderNo} ${b.patternRef}`}
                                onSelect={() => addPatternToMachine(`${b.orderNo}|${b.patternRef}`)}
                                className="cursor-pointer py-3 px-4 hover:bg-[#F4F6FB] flex items-center gap-3 border-b border-[#F4F6FB] last:border-0"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-[#172554]">{b.patternRef}</span>
                                    <span className="text-[10px] font-semibold text-[#64748B] bg-[#F4F6FB] px-2 py-0.5 rounded-full">
                                      Remaining: {b.totalRequired - b.totalScheduled}
                                    </span>
                                  </div>
                                  <div className="text-xs text-[#64748B] mt-1">Order: <span className="text-[#4285F4] font-mono">{b.orderNo}</span></div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {activeRows.length === 0 ? (
                  <div className="p-16 flex flex-col items-center justify-center text-[#94A3B8]">
                    <CubeTransparent className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-lg font-medium text-[#64748B]">No patterns scheduled</p>
                    <p className="text-sm">Click the button above to add a pattern to this machine's schedule.</p>
                  </div>
                ) : (
                  <div className="w-full">
                    <table className="w-full table-fixed text-sm text-left">
                      <thead className="bg-[#F8FAFC] border-b border-[#E0E7FF] text-[#64748B] uppercase tracking-wider font-bold text-[11px]">
                        <tr>
                          <th className="px-3 py-4 w-[150px]">Pattern Details</th>
                          <th className="px-1.5 py-4 text-center border-x border-[#E0E7FF] w-[68px]">Pending Qty</th>
                          {TIME_SLOTS.map(slot => (
                            <th key={slot.time} className="px-1 py-4 text-center border-r border-[#E0E7FF] leading-tight">
                              <div>{slot.time}</div>
                              <div className="text-[9px] font-normal normal-case text-[#94A3B8]">to {slot.endTime}</div>
                            </th>
                          ))}
                          <th className="px-1.5 py-4 text-center border-l border-[#E0E7FF] w-[44px]">Del</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E0E7FF]">
                        {activeRows.map(row => {
                          const pattern = patterns.find(p => p.code === row.patternRef)
                          const eq = equipments.find(e => e.id === row.machineId)
                          const avgProd = Number(pattern?.avgMouldsPerHour) || eq?.avgPiecesPerHour || 10
                          const shiftHours = TIME_SLOTS.reduce((acc, sl) => acc + sl.hours, 0)
                          const possibleQty = Math.round(avgProd * shiftHours)

                          return (
                            <tr key={row.id} className="hover:bg-[#F4F6FB] transition-colors group">
                              <td className="px-3 py-4">
                                <div className="flex flex-col gap-1">
                                  <span className="font-bold text-[#172554] text-sm truncate">{row.patternRef}</span>
                                  <span className="text-[10px] text-[#94A3B8] truncate">{row.orderNo} | {row.productName}</span>
                                  <span className="text-[10px] text-[#10B981] font-semibold tracking-wide">QTY: {possibleQty}</span>
                                </div>
                              </td>
                              <td className="px-1.5 py-4 text-center border-x border-[#E0E7FF] bg-[#EEF2FF]">
                                <div className="flex flex-col items-center justify-center gap-1">
                                  <Input
                                    type="number"
                                    min="0"
                                    max={getMaxAllowedQty(row) === Infinity ? undefined : getMaxAllowedQty(row)}
                                    value={row.targetQty}
                                    onChange={e => handleTargetQtyInput(row.id, e.target.value)}
                                    placeholder="0"
                                    title={getMaxAllowedQty(row) === Infinity ? undefined : `Max ${getMaxAllowedQty(row)} pending`}
                                    className="w-14 h-7 bg-[#FFFFFF] border-[#C7D2FE] font-mono text-center text-[#4F46E5] font-bold text-sm focus-visible:ring-1 focus-visible:ring-[#4F46E5] px-1"
                                  />
                                  <Button
                                    onClick={() => autoFillRow(row.id)}
                                    size="icon"
                                    variant="outline"
                                    title="Auto-fill time slots"
                                    className="h-6 w-14 shrink-0 text-[#4F46E5] border-[#C7D2FE] hover:bg-[#EEF2FF] hover:border-[#4F46E5]"
                                  >
                                    <MagicWand weight="fill" className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </td>
                              {TIME_SLOTS.map(slot => {
                                 // Check conflict across multiple rows on this machine
                                 const otherActiveRowsInSlot = activeRows.filter(or => or.id !== row.id && (or.hourlyTargets[slot.time] || 0) > 0)
                                 const isConflict = otherActiveRowsInSlot.length > 0 && (row.hourlyTargets[slot.time] || 0) > 0
                                 
                                 return (
                                  <td key={slot.time} className={cn("px-1 py-2 text-center border-r border-[#E0E7FF]", isConflict && "bg-red-50")}>
                                    <div className="flex flex-col gap-1 items-center justify-center">
                                      <Input
                                        type="number"
                                        min="0"
                                        value={row.hourlyTargets[slot.time] || ''}
                                        onChange={e => handleHourlyChange(row.id, slot.time, e.target.value)}
                                        placeholder="-"
                                        className={cn(
                                          "w-full max-w-[52px] mx-auto h-8 text-center font-mono text-xs px-1 bg-transparent border-transparent hover:border-[#E0E7FF] focus:border-[#4285F4] focus:bg-white transition-all shadow-none",
                                          (row.hourlyTargets[slot.time] || 0) > 0 && "font-bold text-[#172554] bg-[#F4F6FB] border-[#E0E7FF]",
                                          isConflict && "text-red-600 font-bold border-red-200 bg-red-100"
                                        )}
                                      />
                                      {viewLabourers && (
                                        <div className="flex items-center justify-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
                                          <button onClick={() => handleWorkerChange(row.id, slot.time, -1)} className="w-4 h-4 flex items-center justify-center bg-[#E2E8F0] rounded text-[#475569] hover:bg-[#CBD5E1] text-xs font-bold leading-none">-</button>
                                          <span className="text-[10px] w-3 text-center font-mono font-medium">{row.hourlyWorkers[slot.time] || 0}</span>
                                          <button onClick={() => handleWorkerChange(row.id, slot.time, 1)} className="w-4 h-4 flex items-center justify-center bg-[#E2E8F0] rounded text-[#475569] hover:bg-[#CBD5E1] text-xs font-bold leading-none">+</button>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                 )
                              })}
                              <td className="px-1.5 py-4 text-center border-l border-[#E0E7FF]">
                                <Button variant="ghost" size="icon" onClick={() => removeRow(row.id)} className="text-[#94A3B8] hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all h-8 w-8">
                                  <Trash className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              
              <div className="border border-[#E0E7FF] rounded-xl overflow-hidden mt-8">
                <div className="w-full flex items-center justify-between bg-[#EEF2FF] p-4 text-[#172554]">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm">End of Day - Actual Entry ({equipments.find(e => e.id === activeMachineId)?.name})</h3>
                    <span className="text-xs text-[#64748B]">Enter produced quantities</span>
                  </div>
                </div>
                <div className="p-4 bg-[#F4F6FB] space-y-3">
                  {activeRows.map(row => {
                    const planned = parseInt(row.targetQty, 10) || 0
                    const act = row.actualQuantity
                    const hasAct = act !== undefined && act !== null
                    const variance = hasAct ? act - planned : 0
                    
                    return (
                      <div key={row.id} className="flex items-center gap-4 p-3 bg-[#FFFFFF] border border-[#E0E7FF] rounded-lg">
                        <div className="w-48 flex flex-col">
                          <h4 className="text-[#172554] font-mono font-bold text-sm">{row.patternRef}</h4>
                          <span className="text-[10px] text-[#64748B] truncate">{row.orderNo} | {row.productName}</span>
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
                            onChange={e => handleActualChange(row.id, e.target.value)}
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
                  {activeRows.length === 0 && (
                     <div className="text-center text-[#94A3B8] py-4 text-sm">No items scheduled yet.</div>
                  )}
                </div>
              </div>
              </>
            )}
          </div>

          <DialogFooter className="m-0 p-5 border-t border-[#E0E7FF] bg-[#FFFFFF] shrink-0 sm:justify-end rounded-b-2xl">
            <Button variant="ghost" onClick={onClose} className="text-[#64748B] hover:text-[#172554] hover:bg-[#F8FAFC]">Cancel</Button>
            <Button onClick={handleSave} className="bg-[#4F46E5] text-white hover:bg-[#4F46E5]/90 shadow-[0_4px_10px_-2px_rgba(79,70,229,0.3)] h-10 px-8 text-sm">Save Day Plan</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
