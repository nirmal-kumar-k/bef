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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { CapacityErrorDialog } from '@/shared/ui/capacity-error-dialog'
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
  actualMeltWeight?: number
  grade: string
  heatCode: string
  // Persistent, never-auto-resets - the furnace's running heat count at the
  // moment this heat was created (see the Heat Sequence Counter in Equipment
  // Master). Distinct from heatCode's date segment, which resets daily.
  sequenceNumber?: number
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

const MONTH_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

// Default heat code: YY-MonthLetter-DD-DailySequence, e.g. 26-G-13-01 for the
// 1st heat run on this furnace on 13 Jul 2026. The daily sequence resets each
// day (it's just this furnace's heat count for the plan's date), unlike the
// separate, never-resetting sequence number shown on the card.
const buildDefaultHeatCode = (planDate: string, dailySequence: number) => {
  const d = new Date(planDate)
  const yy = String(d.getFullYear()).slice(-2)
  const monthLetter = MONTH_LETTERS[d.getMonth()]
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}-${monthLetter}-${dd}-${String(dailySequence).padStart(2, '0')}`
}

// Explicit first/regular heat durations win when set; otherwise fall back to
// the furnace's Avg Heats Per Hour (60 / avgPiecesPerHour minutes per heat),
// same fallback role avgPiecesPerHour plays for Core/Mould/Knockout equipment,
// before finally defaulting to a hardcoded duration.
const getHeatDurationMins = (furnace: any, isFirstHeat: boolean) => {
  const explicit = isFirstHeat ? furnace?.firstHeatDurationMins : furnace?.regularHeatDurationMins
  if (explicit) return explicit
  if (furnace?.avgPiecesPerHour) return Math.round(60 / furnace.avgPiecesPerHour)
  return isFirstHeat ? 120 : 90
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
  const [grades, setGrades] = useState<{ id: string; code: string; name: string }[]>([])

  const [allocationHeatId, setAllocationHeatId] = useState<string | null>(null)
  // Which heat's full detail card is showing below the compact chip grid -
  // falls back to the furnace's first heat whenever this doesn't point at one
  // of its heats (furnace switch, or the selected heat got deleted).
  const [selectedHeatId, setSelectedHeatId] = useState<string | null>(null)

  // Add Heat flow: pick a grade first, then a heat code field appears
  const [addHeatOpen, setAddHeatOpen] = useState(false)
  const [capacityErrorLines, setCapacityErrorLines] = useState<string[] | null>(null)
  const [newHeatGrade, setNewHeatGrade] = useState('')
  const [newHeatCode, setNewHeatCode] = useState('')

  // Fetch Master Data
  useEffect(() => {
    if (isOpen) {
      if (grades.length === 0) {
        fetch('/api/grades').then(r => r.json()).then(setGrades).catch(console.error)
      }
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
            endTime: p.endTime || '09:30 AM',
            actualMeltWeight: p.actualMeltWeight,
            grade: p.grade || '',
            heatCode: p.heatNo || '',
            sequenceNumber: p.heatSequenceNumber
          }
        }

        // Re-derive the exact cart item this plan row was saved for from its itemId
        // (`${orderId}-${cartIndex}`, the same convention used everywhere plans are
        // matched to orders) instead of guessing at "the first cart item with a
        // name", which silently picked the wrong product/grade whenever an order had
        // more than one line.
        const order = openOrders.find(o => o.id === p.orderId)
        const cartItem = order?.cart?.find((c: any, idx: number) => `${order.id}-${idx}` === p.itemId)
        const product = cartItem
          ? products.find(prod => prod.name === cartItem.productName || prod.code === cartItem.product)
          : undefined
        // Prefer the persisted pattern_ref column; fall back to deriving it from the
        // resolved product for rows saved before that column existed.
        const pattern = (p.patternRef && patterns.find(pat => pat.code === p.patternRef))
          || patterns.find(pat => pat.mappedProducts?.some((mp: any) => mp.name === product?.name))
        const mouldWeight = pattern?.totalWeight || 20

        loadedPours.push({
          id: Math.random().toString(),
          planId: p.id || p._id,
          furnaceId: eqId,
          heatId: hId,
          orderId: p.orderId || '',
          orderNo: order?.customerOrderNo || '',
          patternRef: pattern?.code || '',
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
  // equipments.length (not equipments itself) is the dependency deliberately -
  // this should only re-run when equipment data first loads, not every time
  // its contents change (e.g. addHeat updating a furnace's heatSequence
  // locally), which would otherwise wipe out any heat added but not yet saved.
  }, [isOpen, dailyPlans, equipments.length, openOrders, products, patterns])

  // Add a heat manually: grade is picked first, then a heat code is entered for it.
  // Start time cascades off the last existing heat for this furnace (or the shift
  // start if this is the first one), matching the timing logic heats always used.
  const addHeat = async () => {
    if (!activeFurnaceId || !newHeatGrade || !newHeatCode.trim()) return
    const furnace = equipments.find(e => e.id === activeFurnaceId)
    const furnaceHeats = heats.filter(h => h.furnaceId === activeFurnaceId).sort((a, b) => a.heatNumber - b.heatNumber)
    const nextNumber = (furnaceHeats[furnaceHeats.length - 1]?.heatNumber || 0) + 1
    const nextSequence = (furnace?.heatSequence || 0) + 1

    let currentStart: number
    if (furnaceHeats.length > 0) {
      currentStart = parseTime(furnaceHeats[furnaceHeats.length - 1].endTime)
    } else {
      const shift = shifts.find(s => s.id === selectedShiftId)
      currentStart = parseTime(shift?.startTime || '08:00 AM')
    }
    const duration = getHeatDurationMins(furnace, nextNumber === 1)

    setHeats(prev => [...prev, {
      id: `${activeFurnaceId}-heat-${nextNumber}`,
      furnaceId: activeFurnaceId,
      heatNumber: nextNumber,
      startTime: formatTime(currentStart),
      endTime: formatTime(currentStart + duration),
      grade: newHeatGrade,
      heatCode: newHeatCode.trim(),
      sequenceNumber: nextSequence
    }])
    setAddHeatOpen(false)
    setNewHeatCode('')

    // Persist the furnace's running heat count immediately - it must survive
    // across days/sessions, unlike the rest of this modal's in-memory state.
    setEquipments(prev => prev.map(e => e.id === activeFurnaceId ? { ...e, heatSequence: nextSequence } : e))
    try {
      await fetch(`/api/equipment/${activeFurnaceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heatSequence: nextSequence }),
      })
    } catch (error) {
      console.error('Failed to persist heat sequence:', error)
    }
  }

  // Deleting a heat also drops any pours already allocated to it - a heat
  // with dangling pours pointing at a heat that no longer exists would be
  // broken, not just orphaned.
  const removeHeat = (heatId: string) => {
    setHeats(prev => prev.filter(h => h.id !== heatId))
    setPours(prev => prev.filter(p => p.heatId !== heatId))
  }

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
    // Same hard capacity guard as Core/Mould planning - a heat's charge weight
    // already gets flagged red on screen when over capacity, but that was
    // only a visual warning; block the actual save too so an over-capacity
    // heat can't silently get recorded as if it were achievable.
    const overCapacityHeats = heats.map(h => {
      const heatPours = pours.filter(p => p.heatId === h.id)
      const totalWeight = heatPours.reduce((sum, p) => sum + (p.mouldsScheduled * p.mouldWeight), 0)
      const furnace = equipments.find(e => e.id === h.furnaceId)
      const cap = furnace?.maxMeltCapacityKg || 150
      return { h, totalWeight, cap }
    }).filter(({ totalWeight, cap }) => totalWeight > cap)

    if (overCapacityHeats.length > 0) {
      setCapacityErrorLines(overCapacityHeats.map(({ h, totalWeight, cap }) => `Heat ${h.heatNumber} (${h.heatCode}): ${totalWeight.toFixed(1)} kg scheduled, max ${cap} kg`))
      return
    }

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
        actualMeltWeight: h?.actualMeltWeight,
        grade: h?.grade,
        heatNo: h?.heatCode,
        heatSequenceNumber: h?.sequenceNumber,
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
      const firstDur = getHeatDurationMins(furnace, true)
      const regDur = getHeatDurationMins(furnace, false)

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

  const handleActualMeltChange = (heatId: string, value: string) => {
    const val = value === '' ? undefined : Number(value)
    setHeats(prev => prev.map(h => h.id === heatId ? { ...h, actualMeltWeight: val } : h))
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
  }

  const removePour = (pourId: string) => {
    setPours(prev => prev.filter(p => p.id !== pourId))
  }

  const dateObj = new Date(date || new Date())
  const dateString = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  
  const furnace = equipments.find(e => e.id === activeFurnaceId)
  const maxCapacity = furnace?.maxMeltCapacityKg || 150

  const activeHeats = heats.filter(h => h.furnaceId === activeFurnaceId).sort((a, b) => a.heatNumber - b.heatNumber)
  const selectedHeat = activeHeats.find(h => h.id === selectedHeatId) || activeHeats[0]
  const selectedHeatPours = selectedHeat ? pours.filter(p => p.heatId === selectedHeat.id) : []
  const selectedHeatWeight = selectedHeatPours.reduce((sum, p) => sum + (p.mouldsScheduled * p.mouldWeight), 0)
  const selectedHeatOverCapacity = selectedHeatWeight > maxCapacity

  // Melt Planning is amber-branded by default (Furnace/heat cards), so Night
  // Shift doesn't need a new accent color like Core/Mould do - it just gets
  // the same warm cream background wash used elsewhere, while the existing
  // amber buttons/badges stay as they are.
  const selectedShift = shifts.find(s => s.id === selectedShiftId)
  const isNightShift = selectedShift?.name === 'Night Shift'
  const warmBg = isNightShift ? 'bg-orange-50' : 'bg-[#F4F6FB]'
  const warmBorder = isNightShift ? 'border-orange-200' : 'border-[#E0E7FF]'

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn("w-[95vw] sm:max-w-[1200px] min-h-[60vh] max-h-[90vh] text-foreground p-0 shadow-2xl flex flex-col transition-colors duration-500 ease-in-out", warmBg, warmBorder)}>
        <div className="flex flex-col w-full h-full">
          {/* Header */}
          <DialogHeader className={cn("p-6 pb-4 border-b shrink-0 bg-white transition-colors duration-500 ease-in-out", warmBorder)}>
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
                        <SelectValue placeholder="Select Shift">
                          {(id: string) => {
                            const s = shifts.find(sh => sh.id === id)
                            return s ? `${s.name} (${s.startTime} - ${s.endTime})` : 'Select Shift'
                          }}
                        </SelectValue>
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
            <div className={cn("flex gap-2 overflow-x-auto pb-2 border-b transition-colors duration-500 ease-in-out", warmBorder)}>
              {equipments.map(eq => (
                <Button
                  key={eq.id}
                  variant={activeFurnaceId === eq.id ? "default" : "outline"}
                  className={cn(
                    "h-11 px-8 text-sm font-bold transition-all rounded-t-xl rounded-b-none border-b-0",
                    activeFurnaceId === eq.id
                      ? "bg-amber-500 text-white shadow-[0_-4px_10px_-2px_rgba(245,158,11,0.2)] hover:bg-amber-600"
                      : cn("bg-[#FFFFFF] text-[#64748B] hover:bg-amber-50 hover:text-amber-700", warmBorder)
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
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-[#64748B] font-semibold flex items-center gap-4">
                      {furnace?.avgPiecesPerHour && (
                        <span>Avg Heats/Hr: <span className="text-amber-600">{furnace.avgPiecesPerHour}</span></span>
                      )}
                      <span>First Heat: <span className="text-amber-600">{getHeatDurationMins(furnace, true)}m</span></span>
                      <span>Regular Heat: <span className="text-amber-600">{getHeatDurationMins(furnace, false)}m</span></span>
                      <div className="flex items-center gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Grade</label>
                        <Select value={newHeatGrade} onValueChange={setNewHeatGrade}>
                          <SelectTrigger className="h-8 w-[130px] text-sm">
                            <SelectValue placeholder="Select grade" />
                          </SelectTrigger>
                          <SelectContent>
                            {grades.map(g => (
                              <SelectItem key={g.id} value={g.code}>{g.code} - {g.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <span>Max Capacity: <span className="text-amber-600">{maxCapacity} kg</span></span>
                    </div>
                    <Popover open={addHeatOpen} onOpenChange={(open) => {
                      setAddHeatOpen(open)
                      if (open) {
                        const furnaceHeats = heats.filter(h => h.furnaceId === activeFurnaceId)
                        setNewHeatCode(buildDefaultHeatCode(date, furnaceHeats.length + 1))
                      } else {
                        setNewHeatCode('')
                      }
                    }}>
                      <PopoverTrigger
                        disabled={!newHeatGrade}
                        title={!newHeatGrade ? 'Select a grade first' : undefined}
                        className={cn(buttonVariants({ variant: "default" }), "h-9 px-4 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold disabled:opacity-50 disabled:pointer-events-none")}
                      >
                        <Plus className="w-4 h-4 mr-1" /> Add Heat
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] p-4 shadow-2xl border-[#E0E7FF] rounded-xl" side="bottom" align="end">
                        <div className="space-y-3">
                          <div className="text-xs text-[#64748B]">Grade: <span className="font-bold text-amber-600">{newHeatGrade}</span></div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Heat Code</label>
                            <Input
                              value={newHeatCode}
                              onChange={e => setNewHeatCode(e.target.value)}
                              placeholder="e.g. H001"
                              className="h-9 text-sm font-mono"
                            />
                          </div>
                          <Button
                            onClick={addHeat}
                            disabled={!newHeatGrade || !newHeatCode.trim()}
                            className="w-full h-9 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold disabled:opacity-50"
                          >
                            Add Heat
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {activeHeats.length === 0 && (
                  <div className={cn("p-10 text-center text-[#94A3B8] text-sm italic bg-white rounded-xl border border-dashed transition-colors duration-500 ease-in-out", warmBorder)}>
                    No heats added yet for this furnace. Click &quot;Add Heat&quot; to create one.
                  </div>
                )}

                {/* Compact chip grid - one small box per heat, click to view its full card below */}
                <div className="flex flex-wrap gap-2">
                  {activeHeats.map(heat => {
                    const heatPours = pours.filter(p => p.heatId === heat.id)
                    const totalWeight = heatPours.reduce((sum, p) => sum + (p.mouldsScheduled * p.mouldWeight), 0)
                    const isOverCapacity = totalWeight > maxCapacity
                    const isSelected = selectedHeat?.id === heat.id

                    return (
                      <button
                        key={heat.id}
                        onClick={() => setSelectedHeatId(heat.id)}
                        title={heat.grade}
                        className={cn(
                          "w-[108px] shrink-0 text-left bg-white rounded-lg border border-l-4 px-2.5 py-2 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
                          isOverCapacity ? "border-l-red-400" : "border-l-amber-300",
                          isSelected ? "border-amber-400 ring-2 ring-amber-200" : warmBorder
                        )}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-mono font-bold text-xs text-[#172554] truncate">{heat.heatCode || `Heat ${heat.heatNumber}`}</span>
                          <span
                            title="Furnace's running heat count - never resets on its own (reset in Equipment Master)"
                            className="font-mono text-[9px] font-bold text-amber-700 bg-amber-100 px-1 py-0.5 rounded shrink-0"
                          >
                            #{heat.sequenceNumber ?? heat.heatNumber}
                          </span>
                        </div>
                        <div className="text-[10px] font-semibold text-[#64748B] truncate mt-0.5">{heat.grade}</div>
                        {isOverCapacity && (
                          <div className="text-[9px] font-bold text-red-600 mt-1 flex items-center gap-0.5">
                            <WarningCircle weight="fill" className="w-2.5 h-2.5" /> Over
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Selected heat's full detail card */}
                {selectedHeat && (
                  <div className={cn(
                    "bg-white rounded-xl border shadow-sm flex flex-col overflow-hidden transition-all max-w-2xl",
                    selectedHeatOverCapacity ? "border-red-300 ring-1 ring-red-300" : warmBorder
                  )}>
                    {/* Heat Header - identity row */}
                    <div className={cn(
                      "px-4 py-3 border-b flex items-center gap-2.5 transition-colors duration-500 ease-in-out",
                      selectedHeatOverCapacity ? "bg-red-50 border-red-200" : cn("bg-gradient-to-r from-amber-50/70 to-white", warmBorder)
                    )}>
                      <div className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                        selectedHeatOverCapacity ? "bg-red-100" : "bg-amber-100"
                      )}>
                        <Fire weight="fill" className={cn("w-5 h-5", selectedHeatOverCapacity ? "text-red-500" : "text-amber-600")} />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-mono font-black text-base text-[#172554] leading-tight truncate">{selectedHeat.heatCode || `Heat ${selectedHeat.heatNumber}`}</span>
                        <span className="text-[11px] font-semibold text-[#64748B] truncate mt-0.5">{selectedHeat.grade}</span>
                      </div>
                      <span
                        title="Furnace's running heat count - never resets on its own (reset in Equipment Master)"
                        className="font-mono text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded shrink-0"
                      >
                        #{selectedHeat.sequenceNumber ?? selectedHeat.heatNumber}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeHeat(selectedHeat.id)}
                        title="Delete heat"
                        className="h-7 w-7 shrink-0 text-[#94A3B8] hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Heat Header - metrics strip (fixed 3-column grid so values never wrap/orphan) */}
                    <div className={cn(
                      "grid grid-cols-3 divide-x border-b transition-colors duration-500 ease-in-out",
                      selectedHeatOverCapacity ? "divide-red-200 bg-red-50/50 border-red-200" : cn("bg-[#F8FAFC]", warmBorder, isNightShift ? "divide-orange-200" : "divide-[#E0E7FF]")
                    )}>
                      <div className="px-2 py-2.5 flex flex-col items-center gap-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8] flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Pour Window
                        </span>
                        <div className="flex items-center gap-1">
                          <Input
                            value={selectedHeat.startTime}
                            onChange={e => handleHeatTimeChange(selectedHeat.id, e.target.value)}
                            className="w-[62px] h-6 px-1 py-0 text-[11px] font-mono border-none bg-transparent text-center shadow-none focus-visible:ring-1 focus-visible:ring-amber-500"
                          />
                          <span className="text-[#CBD5E1] text-xs shrink-0">→</span>
                          <span className="w-[62px] text-center text-[11px] font-mono text-[#64748B] shrink-0">{selectedHeat.endTime}</span>
                        </div>
                      </div>

                      <div className="px-2 py-2.5 flex flex-col items-center gap-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8]">Charge Weight</span>
                        <span className={cn("font-mono font-bold text-xs whitespace-nowrap", selectedHeatOverCapacity ? "text-red-600" : "text-[#172554]")}>
                          {selectedHeatWeight.toFixed(1)} <span className="text-[#94A3B8] font-normal">/ {maxCapacity} kg</span>
                        </span>
                        <div className="w-full max-w-[84px] h-1 rounded-full bg-[#E2E8F0] overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all", selectedHeatOverCapacity ? "bg-red-500" : "bg-emerald-500")}
                            style={{ width: `${Math.min(100, (selectedHeatWeight / (maxCapacity || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className="px-2 py-2.5 flex flex-col items-center gap-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#4285F4]">Actual Melt</span>
                        <Input
                          type="number"
                          min="0"
                          value={selectedHeat.actualMeltWeight ?? ''}
                          onChange={e => handleActualMeltChange(selectedHeat.id, e.target.value)}
                          className="w-20 h-6 text-[11px] font-mono text-center px-1 bg-white border-[#C7D2FE] focus-visible:ring-1 focus-visible:ring-[#4285F4]"
                          placeholder="kg"
                        />
                      </div>
                    </div>

                    {/* Heat Body */}
                    <div className="p-4 flex-1 flex flex-col gap-3">
                      {selectedHeatPours.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-[#94A3B8] text-sm italic py-4">
                          No moulds allocated to this heat yet.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selectedHeatPours.map(pour => (
                            <div key={pour.id} className={cn("flex items-center justify-between p-2 rounded-lg border transition-colors duration-500 ease-in-out", warmBg, warmBorder)}>
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

                      {/* Add Pour Button / Popover - locked to this heat's own grade */}
                      <Popover open={allocationHeatId === selectedHeat.id} onOpenChange={(open) => {
                        setAllocationHeatId(open ? selectedHeat.id : null)
                      }}>
                        <PopoverTrigger className={cn(buttonVariants({ variant: "outline" }), "w-full mt-auto border-dashed border-amber-300 text-amber-600 hover:bg-amber-50 hover:text-amber-700 font-semibold h-9")}>
                          <Plus className="w-4 h-4 mr-2" /> Add Pouring Allocation
                        </PopoverTrigger>
                        <PopoverContent className="w-[340px] p-0 shadow-2xl border-[#E0E7FF] rounded-xl" side="bottom" align="center">
                          <div className="flex flex-col bg-white rounded-xl overflow-hidden">
                            <div className="p-3 bg-gradient-to-r from-amber-50 to-white border-b border-[#E0E7FF]">
                              <h4 className="font-bold text-[#172554] text-sm flex items-center gap-2">
                                <Fire className="w-4 h-4 text-amber-500" /> Allocate to Heat {selectedHeat.heatNumber}
                              </h4>
                              <p className="text-[10px] text-[#94A3B8] mt-0.5">Grade: <span className="font-bold text-amber-600">{selectedHeat.grade}</span> - only matching moulds shown</p>
                            </div>
                            <div className="h-[300px] overflow-y-auto p-3 space-y-3 bg-white">
                              {(backlogByGrade.get(selectedHeat.grade) || []).length === 0 ? (
                                <div className="h-full flex items-center justify-center text-xs text-[#94A3B8] italic">
                                  No pending moulds for grade {selectedHeat.grade}.
                                </div>
                              ) : (
                                backlogByGrade.get(selectedHeat.grade)?.map(b => {
                                    const pattern = patterns.find(p => p.code === b.patternRef)
                                    const boxWeight = pattern?.totalWeight || 20
                                    const remainingMoulds = Math.ceil((b.totalRequired - b.totalScheduled) / boxWeight)
                                    const remainingHeatCapacity = Math.max(0, maxCapacity - selectedHeatWeight)
                                    const possibleMoulds = Math.floor(remainingHeatCapacity / boxWeight)
                                    const maxAllowed = Math.min(remainingMoulds, possibleMoulds)

                                    return (
                                      <PourAllocationRow
                                        key={b.itemId}
                                        backlogItem={b}
                                        boxWeight={boxWeight}
                                        maxAllowed={maxAllowed}
                                        onAdd={(qty) => addPour(selectedHeat.id, b, qty)}
                                      />
                                    )
                                  })
                                )}
                              </div>
                            </div>
                        </PopoverContent>
                      </Popover>

                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className={cn("m-0 p-5 border-t bg-[#FFFFFF] shrink-0 sm:justify-end rounded-b-2xl transition-colors duration-500 ease-in-out", warmBorder)}>
            <Button variant="ghost" onClick={onClose} className="text-[#64748B] hover:text-[#172554] hover:bg-[#F8FAFC]">Cancel</Button>
            <Button onClick={handleSave} className="bg-amber-500 text-white hover:bg-amber-600 shadow-md h-10 px-8 text-sm font-bold">Save Day Plan</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
    <CapacityErrorDialog lines={capacityErrorLines} onClose={() => setCapacityErrorLines(null)} />
    </>
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
