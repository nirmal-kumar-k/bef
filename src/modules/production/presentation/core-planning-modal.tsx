import { useState, useEffect, useMemo, useRef } from 'react'
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
import { Switch } from '@/shared/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/shared/ui/command'
import { CapacityErrorDialog } from '@/shared/ui/capacity-error-dialog'
import { BacklogItem } from './daily-planning-modal'
import { CubeTransparent, Trash, CaretDown, MagicWand } from '@phosphor-icons/react'
import { cn } from '@/shared/lib/utils'
import { generateTimeSlots, TimeSlot, resolveAvgProductionRate } from '@/shared/lib/utils'
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

interface PlannedRow {
  id: string
  planId?: string
  orderId: string
  orderNo: string
  productName: string
  patternRef: string
  coreBoxCode: string
  machineId: string
  totalQty: string
  // Display-only possible-quantity text (PQ). Seeded from the computed
  // capacity (avgPiecesPerHour x shift hours) but freely editable afterward -
  // never used for capacity validation, which always uses the live
  // equipment-computed value instead.
  possibleQtyText: string
  hourlyTargets: Record<string, number>
  hourlyWorkers: Record<string, number>
  isConfirmed: boolean
  // Quantity this row already contributed to the backlog's totalScheduled when the
  // modal opened - needed to compute how much MORE this row can take without
  // double-subtracting its own prior contribution from the remaining pending qty.
  originalQty: number
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
  const [capacityErrorLines, setCapacityErrorLines] = useState<string[] | null>(null)

  // Plan ids removed from the schedule via the trash icon this session -
  // plansToSave only ever contains rows still on screen, so a removed row's
  // existing DB record would otherwise never be told to delete itself.
  const [removedPlanIds, setRemovedPlanIds] = useState<string[]>([])

  // Snapshot of the fields that matter for saving, captured once when the
  // modal's rows are (re)initialized - compared against current state to
  // gate the Save button until something actually changes.
  const initialSnapshotRef = useRef<string>('')

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
            const coreEquips = data.filter((e: any) => e.type === 'Core Machine' && e.isActive)
            setEquipments(coreEquips)
          })
          .catch(console.error)
      }
    }
  }, [isOpen])

  const selectedShift = shifts.find(s => s.id === selectedShiftId) || shifts[0]
  const TIME_SLOTS: TimeSlot[] = selectedShift
    ? generateTimeSlots(selectedShift.startTime, selectedShift.endTime, selectedShift.breaks || [])
    : []

  // Night Shift gets its own warm light-orange theme (same light structure as
  // Day Shift, just the indigo accent swapped for orange) so the whole card
  // visibly signals which shift you're planning for, without the contrast
  // pitfalls of a dark theme. Every themed element carries transition-colors
  // so switching shifts fades smoothly instead of snapping.
  const isNightShift = selectedShift?.name === 'Night Shift'
  const theme = isNightShift ? {
    dialog: 'bg-orange-50 border-orange-200',
    header: 'bg-white border-orange-200',
    title: 'text-stone-800',
    label: 'text-stone-500',
    selectTrigger: 'border-orange-200 bg-white text-stone-800 hover:bg-orange-50',
    selectContent: 'bg-white border-orange-200',
    selectItem: 'text-stone-800',
    metricsBar: 'bg-white border-orange-200',
    metricsDivider: 'bg-orange-200',
    metricLabel: 'text-stone-400',
    metricValue: 'text-stone-800',
    tabActive: 'bg-orange-500 text-white',
    tabInactive: 'bg-white border-orange-200 text-stone-500 hover:bg-orange-50 hover:text-stone-800',
    emptyCard: 'bg-white border-orange-200 text-stone-400',
    emptyCardTitle: 'text-stone-500',
    card: 'bg-white border-orange-200',
    cardHeader: 'bg-gradient-to-r from-orange-50 to-white border-orange-200',
    cardTitle: 'text-stone-800',
    rateBadge: 'text-orange-700 bg-orange-100 border-orange-200',
    addButton: 'bg-orange-500 text-white hover:bg-orange-500/90',
    popoverContent: 'bg-white border-orange-200 text-stone-800',
    popoverItemBorder: 'border-orange-100',
    tableHead: 'bg-orange-50 border-orange-200 text-stone-500',
    tableBorder: 'border-orange-200',
    tableDivide: 'divide-orange-100',
    rowHover: 'hover:bg-orange-50',
    rowText: 'text-stone-800',
    rowMuted: 'text-stone-400',
    pendingQtyCell: 'bg-orange-100 border-orange-200',
    pendingQtyDefault: 'bg-white border-orange-300 text-orange-700',
    pendingQtyRing: 'focus-visible:ring-orange-400 focus-visible:border-orange-400',
    mismatch: 'bg-rose-50 border-rose-400 text-rose-700 focus-visible:ring-rose-400 focus-visible:border-rose-400',
    mismatchCell: 'bg-rose-50 border-rose-400 text-rose-700',
    mismatchLabel: 'text-rose-600',
    autoFillButton: 'bg-white text-orange-600 border-orange-300 hover:bg-orange-50 hover:border-orange-500',
    hourlyFilled: 'bg-orange-50 border-orange-200 text-stone-800',
    footer: 'bg-white border-orange-200',
    cancelButton: 'text-stone-500 hover:text-stone-800 hover:bg-orange-50',
  } : {
    dialog: 'bg-[#F4F6FB] border-[#E0E7FF]',
    header: 'bg-white border-[#E0E7FF]',
    title: 'text-[#172554]',
    label: 'text-[#64748B]',
    selectTrigger: 'border-[#E0E7FF] bg-[#FFFFFF] text-[#172554] hover:bg-[#F8FAFC]',
    selectContent: 'bg-[#FFFFFF] border-[#E0E7FF]',
    selectItem: 'text-[#172554]',
    metricsBar: 'bg-[#FFFFFF] border-[#E0E7FF]',
    metricsDivider: 'bg-[#E0E7FF]',
    metricLabel: 'text-[#94A3B8]',
    metricValue: 'text-[#172554]',
    tabActive: 'bg-[#4F46E5] text-white shadow-[0_-4px_10px_-2px_rgba(79,70,229,0.2)]',
    tabInactive: 'bg-[#FFFFFF] border-[#E0E7FF] text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#172554]',
    emptyCard: 'bg-white border-[#E0E7FF] text-[#94A3B8]',
    emptyCardTitle: 'text-[#64748B]',
    card: 'bg-white border-[#E0E7FF]',
    cardHeader: 'bg-gradient-to-r from-[#F8FAFC] to-white border-[#E0E7FF]',
    cardTitle: 'text-[#172554]',
    rateBadge: 'text-[#4F46E5] bg-[#EEF2FF] border-[#E0E7FF]',
    addButton: 'bg-[#4F46E5] text-white hover:bg-[#4F46E5]/90',
    popoverContent: 'bg-white border-[#E0E7FF] text-[#172554]',
    popoverItemBorder: 'border-[#F4F6FB]',
    tableHead: 'bg-[#F8FAFC] border-[#E0E7FF] text-[#64748B]',
    tableBorder: 'border-[#E0E7FF]',
    tableDivide: 'divide-[#E0E7FF]',
    rowHover: 'hover:bg-[#F4F6FB]',
    rowText: 'text-[#172554]',
    rowMuted: 'text-[#94A3B8]',
    pendingQtyCell: 'bg-[#EEF2FF] border-[#E0E7FF]',
    pendingQtyDefault: 'bg-[#FFFFFF] border-[#C7D2FE] text-[#4F46E5]',
    pendingQtyRing: 'focus-visible:ring-[#4F46E5] focus-visible:border-[#4F46E5]',
    mismatch: 'bg-rose-50 border-rose-400 text-rose-700 focus-visible:ring-rose-400 focus-visible:border-rose-400',
    mismatchCell: 'bg-rose-50 border-rose-400 text-rose-700',
    mismatchLabel: 'text-rose-600',
    autoFillButton: 'text-[#4F46E5] border-[#C7D2FE] hover:bg-[#EEF2FF] hover:border-[#4F46E5]',
    hourlyFilled: 'bg-[#F4F6FB] border-[#E0E7FF] text-[#172554]',
    footer: 'bg-[#FFFFFF] border-[#E0E7FF]',
    cancelButton: 'text-[#64748B] hover:text-[#172554] hover:bg-[#F8FAFC]',
  }

  // Initialize plans
  useEffect(() => {
    if (isOpen && dailyPlans) {
      const existingCorePlans = dailyPlans.filter(p => p.stage === 'Core')
      const initRows: PlannedRow[] = existingCorePlans.map(p => {
        const order = openOrders.find(o => o.id === p.orderId)
        return {
          id: Math.random().toString(),
          planId: p.id || p._id,
          orderId: p.orderId || '',
          orderNo: order?.customerOrderNo || '',
          productName: order?.productName || '',
          patternRef: p.patternRef || '',
          coreBoxCode: p.coreBoxCode || '',
          machineId: p.equipmentId || '',
          totalQty: p.quantityScheduled ? String(p.quantityScheduled) : '',
          possibleQtyText: p.possibleQuantity !== undefined ? String(p.possibleQuantity) : '',
          hourlyTargets: p.hourlyTargets || {},
          hourlyWorkers: p.hourlyWorkers || {},
          isConfirmed: !!p.isConfirmed,
          originalQty: p.quantityScheduled || 0
        }
      })
      setPlannedRows(initRows)
      setRemovedPlanIds([])
      initialSnapshotRef.current = JSON.stringify(initRows.map(toSnapshotRow))
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
      if (!b.coreBoxCode) return
      const key = `${b.orderNo}-${b.coreBoxCode}`
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
      // Actual hourly-scheduled total, not the (possibly higher) TQ -
      // matches what handleSave actually records, so this preview isn't
      // misleading about what will really get produced/saved.
      const scheduled = Object.values(r.hourlyTargets).reduce((s, v) => s + (v || 0), 0)
      dayProduction += scheduled
    })

    endOfDay = Math.max(0, beginningOfDay - dayProduction)

    return { beginningOfDay, dayProduction, endOfDay }
  }, [backlogData, plannedRows])

  // Fields whose values determine what actually gets saved - used both for
  // the dirty snapshot and its live comparison.
  const toSnapshotRow = (r: PlannedRow) => ({
    machineId: r.machineId,
    coreBoxCode: r.coreBoxCode,
    totalQty: r.totalQty,
    possibleQtyText: r.possibleQtyText,
    hourlyTargets: r.hourlyTargets,
    hourlyWorkers: r.hourlyWorkers
  })

  const isDirty = useMemo(
    () => JSON.stringify(plannedRows.map(toSnapshotRow)) !== initialSnapshotRef.current,
    [plannedRows]
  )

  // Real, equipment-derived ceiling for a machine this shift - the only
  // number ever used for capacity validation (PQ text is display-only).
  const computePossibleQty = (machineId: string) => {
    const eq = equipments.find(e => e.id === machineId)
    const avgProd = resolveAvgProductionRate(undefined, eq?.avgPiecesPerHour)
    const shiftHours = TIME_SLOTS.reduce((s, sl) => s + sl.hours, 0)
    return Math.round(avgProd * shiftHours)
  }

  // Multiple cart lines can map to the same core box within one order, each
  // producing its own backlog entry - sum every match so this reflects the
  // real total, same aggregation used when adding a core box to the schedule.
  const getBacklogAggregate = (orderNo: string, coreBoxCode: string) => {
    const matches = backlogData.filter(b => b.orderNo === orderNo && b.coreBoxCode === coreBoxCode)
    return {
      totalRequired: matches.reduce((s, b) => s + b.totalRequired, 0),
      totalScheduled: matches.reduce((s, b) => s + b.totalScheduled, 0)
    }
  }

  const handleSave = () => {
    // Equipment-capacity blocking is deliberately disabled for now (removed
    // per product decision, to be reintroduced later) - only the product's
    // total required quantity is enforced below, across all dates combined.
    const overQuantityRows = plannedRows.map(r => {
      const scheduledSum = Object.values(r.hourlyTargets).reduce((s, v) => s + (v || 0), 0)
      const { totalRequired, totalScheduled } = getBacklogAggregate(r.orderNo, r.coreBoxCode)
      // totalScheduled already includes this row's own prior contribution
      // (originalQty) - subtract it back out so we're comparing against what
      // every OTHER row/date has claimed, not double-counting this one.
      const cap = Math.max(0, totalRequired - (totalScheduled - r.originalQty))
      return { r, scheduledSum, cap }
    }).filter(({ scheduledSum, cap }) => scheduledSum > cap)

    if (overQuantityRows.length > 0) {
      setCapacityErrorLines(overQuantityRows.map(({ r, cap }) =>
        cap <= 0
          ? `${r.coreBoxCode}: product quantity already fully planned`
          : `${r.coreBoxCode}: product quantity satisfied - only ${cap} more can be scheduled`
      ))
      return
    }

    const plansToSave = plannedRows.map(r => {
      // Only what's actually distributed into achievable hourly slots counts
      // as scheduled - not the (possibly higher) TQ the user typed, which may
      // include more than the machine can produce today. Using TQ here would
      // wrongly mark unachievable quantity as done, erasing backlog that
      // should remain pending for future days.
      const totalScheduled = Object.values(r.hourlyTargets).reduce((s, v) => s + (v || 0), 0)
      const maxWorkers = Math.max(1, ...Object.values(r.hourlyWorkers))

      const possibleQty = computePossibleQty(r.machineId)
      const parsedPossibleQty = parseInt(r.possibleQtyText, 10)
      const possibleQtyToSave = isNaN(parsedPossibleQty) ? possibleQty : parsedPossibleQty

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
        itemId: `${r.orderId}-0`, // simplistic
        stage: 'Core',
        patternRef: r.patternRef,
        coreBoxCode: r.coreBoxCode,
        quantityScheduled: totalScheduled,
        shiftId: selectedShiftId,
        laborersAssigned: maxWorkers,
        workersAssigned: maxWorkers,
        equipmentId: r.machineId,
        hourlyEquipments,
        hourlyTargets: r.hourlyTargets,
        hourlyWorkers: r.hourlyWorkers,
        isConfirmed: r.isConfirmed,
        possibleQuantity: possibleQtyToSave
      }
    })

    // Rows removed via the trash icon this session need an explicit delete
    // instruction - they're not in plansToSave at all, so without this their
    // existing DB record would just sit there untouched forever.
    const deletions = removedPlanIds.map(id => ({ id, _id: id, _delete: true }))

    onSaveDayPlan(date, [...plansToSave, ...deletions])
    onClose()
  }

  // Value change only - freely editable, not capped to the pending backlog
  // quantity, so users can schedule ahead or correct a miscount when needed.
  const handleTotalQtyInput = (rowId: string, value: string) => {
    setPlannedRows(prev => prev.map(r => {
      if (r.id !== rowId) return r
      if (value === '') return { ...r, totalQty: value }
      const num = parseInt(value, 10)
      if (isNaN(num)) return { ...r, totalQty: value }
      return { ...r, totalQty: String(Math.max(0, num)) }
    }))
  }

  // How much of this machine's per-slot capacity is already claimed by OTHER
  // rows scheduled on it (excludeRowId lets a row re-fill around its own prior
  // allocation instead of double-counting it).
  const getUsedBySlot = (machineId: string, excludeRowId: string | undefined, rows: PlannedRow[]) => {
    const used: Record<string, number> = {}
    rows.forEach(r => {
      if (r.machineId !== machineId || r.id === excludeRowId) return
      Object.entries(r.hourlyTargets).forEach(([slot, qty]) => {
        used[slot] = (used[slot] || 0) + (qty || 0)
      })
    })
    return used
  }

  // Fills `target` into this machine's shift slots up to its own per-hour
  // capacity (avg cores/hr from Equipment Master x slot hours) - not an even
  // split of the quantity. A slot only spills into the next once it's actually
  // full, so a second core box added to the same machine tops off whatever
  // headroom the first one left behind in a slot rather than restarting the
  // split from scratch. Every slot, including the shift's first, is fillable.
  const distributeQty = (target: number, machineId: string, excludeRowId: string | undefined, rows: PlannedRow[]) => {
    const eq = equipments.find(e => e.id === machineId)
    const avgProd = resolveAvgProductionRate(undefined, eq?.avgPiecesPerHour)
    const usedBySlot = getUsedBySlot(machineId, excludeRowId, rows)

    const hourlyTargets: Record<string, number> = {}
    const hourlyWorkers: Record<string, number> = {}

    let remaining = target
    TIME_SLOTS.forEach(slot => {
      const capacity = avgProd * slot.hours
      const available = Math.max(0, capacity - (usedBySlot[slot.time] || 0))
      const qty = Math.max(0, Math.min(available, remaining))
      remaining -= qty

      hourlyTargets[slot.time] = qty
      hourlyWorkers[slot.time] = qty > 0 ? 1 : 0
    })

    return { hourlyTargets, hourlyWorkers }
  }

  // Auto-fill logic triggered on button click
  const autoFillRow = (rowId: string) => {
    setPlannedRows(prev => {
      const row = prev.find(r => r.id === rowId)
      if (!row) return prev

      const target = parseInt(row.totalQty, 10)
      if (isNaN(target) || target <= 0) return prev

      const { hourlyTargets, hourlyWorkers } = distributeQty(target, row.machineId, row.id, prev)
      return prev.map(r => r.id === rowId ? { ...r, hourlyTargets, hourlyWorkers } : r)
    })
  }

  // Editing an hourly cell no longer re-syncs TQ to match - the two are
  // tracked independently, so the mismatch indicator on TQ fires whichever
  // side you edit, instead of always being satisfied because the other side
  // silently followed along.
  const handleHourlyChange = (rowId: string, timeSlot: string, value: string) => {
    const num = value === '' ? undefined : parseInt(value, 10)
    setPlannedRows(prev => prev.map(r => {
      if (r.id !== rowId) return r
      const newValue = Math.max(0, num || 0)
      const newTargets = { ...r.hourlyTargets, [timeSlot]: newValue }

      // Live product-quantity warning: fire only on the crossing (previous
      // total within the remaining product quantity, new total over it), not
      // on every keystroke made while already over - Save's own hard block
      // stays authoritative. Equipment-capacity blocking is disabled for now.
      const prevTotal = Object.values(r.hourlyTargets).reduce((s, v) => s + (v || 0), 0)
      const newTotal = Object.values(newTargets).reduce((s, v) => s + (v || 0), 0)
      const { totalRequired, totalScheduled } = getBacklogAggregate(r.orderNo, r.coreBoxCode)
      const cap = Math.max(0, totalRequired - (totalScheduled - r.originalQty))
      if (prevTotal <= cap && newTotal > cap) {
        setCapacityErrorLines([
          cap <= 0
            ? `${r.coreBoxCode}: product quantity already fully planned`
            : `${r.coreBoxCode}: product quantity satisfied - only ${cap} more can be scheduled`
        ])
      }

      return { ...r, hourlyTargets: newTargets }
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

  const addCoreBoxToMachine = (backlogItemKey: string) => {
    if (!backlogItemKey) return
    const [orderNo, coreBoxCode] = backlogItemKey.split('|')
    const matches = backlogData.filter(b => b.orderNo === orderNo && b.coreBoxCode === coreBoxCode)
    if (matches.length === 0) return
    const { totalRequired, totalScheduled } = getBacklogAggregate(orderNo, coreBoxCode)
    const order = openOrders.find(o => o.customerOrderNo === orderNo)

    const remaining = Math.max(0, totalRequired - totalScheduled)
    const patternRef = matches[0].patternRef || ''

    setPlannedRows(prev => {
      const { hourlyTargets, hourlyWorkers } = remaining > 0
        ? distributeQty(remaining, activeMachineId, undefined, prev)
        : { hourlyTargets: {}, hourlyWorkers: {} }

      return [...prev, {
        id: Math.random().toString(),
        orderId: order?.id || '',
        orderNo: orderNo,
        productName: order?.productName || '',
        patternRef,
        coreBoxCode: coreBoxCode,
        machineId: activeMachineId,
        totalQty: remaining > 0 ? String(remaining) : '',
        possibleQtyText: String(computePossibleQty(activeMachineId)),
        hourlyTargets,
        hourlyWorkers,
        isConfirmed: false,
        originalQty: 0
      }]
    })
    setComboboxOpen(false)
  }

  const removeRow = (rowId: string) => {
    setPlannedRows(prev => {
      const row = prev.find(r => r.id === rowId)
      if (row?.planId) setRemovedPlanIds(ids => [...ids, row.planId!])
      return prev.filter(r => r.id !== rowId)
    })
  }

  const dateObj = new Date(date || new Date())
  const dateString = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const activeRows = plannedRows.filter(r => r.machineId === activeMachineId)
  const activeMachine = equipments.find(e => e.id === activeMachineId)

  // Combobox options for backlog items needing scheduling - restricted to core boxes
  // mapped to the active machine in Equipment Master. A machine with no core boxes
  // mapped yet offers nothing, rather than silently allowing anything.
  const mappedCoreBoxes: string[] = activeMachine?.restrictedCoreBoxes || []
  const backlogOptions = useMemo(() => {
    if (mappedCoreBoxes.length === 0) return []
    // Exclude core boxes that already have a row on this machine this session -
    // adding the same one twice would double-book it and, on save, create a second
    // DB row instead of updating the first (since neither carries the other's id),
    // silently doubling what counts as "already scheduled" from then on.
    const alreadyOnMachine = new Set(activeRows.map(r => `${r.orderNo}|${r.coreBoxCode}`))
    // Multiple cart lines can map to the same core box within one order, each
    // producing its own backlog entry - sum them into one aggregated option
    // instead of the last one silently overwriting the others in the map.
    const options = new Map<string, BacklogItem>()
    backlogData
      .filter(b => !!b.coreBoxCode && mappedCoreBoxes.includes(b.coreBoxCode))
      .forEach(b => {
        const key = `${b.orderNo}|${b.coreBoxCode}`
        if (alreadyOnMachine.has(key)) return
        const existing = options.get(key)
        if (existing) {
          existing.totalRequired += b.totalRequired
          existing.totalScheduled += b.totalScheduled
        } else {
          options.set(key, { ...b })
        }
      })
    return Array.from(options.values()).filter(b => b.totalRequired > b.totalScheduled)
  }, [backlogData, mappedCoreBoxes, activeRows])

  // Per-row wrapper, shared between the column header and the blocking check below
  const rowMeta = useMemo(() => {
    return activeRows.map(row => ({ row }))
  }, [activeRows])

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn("w-full h-full max-w-full rounded-none sm:w-[98vw] sm:max-w-[98vw] sm:h-[95vh] sm:rounded-2xl text-foreground p-0 shadow-2xl flex flex-col overflow-hidden transition-colors duration-500 ease-in-out", theme.dialog)}>
        <div className="flex flex-col w-full h-full">
          <DialogHeader className={cn("p-8 pb-6 border-b shrink-0 transition-colors duration-500 ease-in-out", theme.header)}>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 sm:gap-6">
              <div className="space-y-4">
                <DialogTitle className={cn("text-2xl font-heading transition-colors duration-500 ease-in-out", theme.title)}>
                  {dateString} - Core Planning
                </DialogTitle>

                <div className="flex items-center gap-3">
                  <span className={cn("text-xs font-semibold uppercase tracking-wider transition-colors duration-500 ease-in-out", theme.label)}>Select Shift:</span>
                  {shifts.length > 0 && (
                    <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                      <SelectTrigger className={cn("h-9 px-4 text-sm font-semibold rounded-lg border shadow-sm transition-colors duration-500 ease-in-out", theme.selectTrigger)}>
                        <SelectValue placeholder="Select Shift">
                          {(id: string) => {
                            const s = shifts.find(sh => sh.id === id)
                            return s ? `${s.name} (${s.startTime} - ${s.endTime})` : 'Select Shift'
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className={theme.selectContent}>
                        {shifts.map(s => (
                          <SelectItem key={s.id} value={s.id!} className={cn("text-sm", theme.selectItem)}>
                            {s.name} ({s.startTime} - {s.endTime})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

              </div>

              <div className={cn("flex gap-4 p-3 rounded-xl border shadow-sm transition-colors duration-500 ease-in-out w-full sm:w-auto", theme.metricsBar)}>
                <div className="text-center px-3">
                  <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-1 transition-colors duration-500 ease-in-out", theme.metricLabel)}>Beginning of Day</p>
                  <p className={cn("text-xl font-mono font-bold transition-colors duration-500 ease-in-out", theme.metricValue)}>{topMetrics.beginningOfDay}</p>
                </div>
                <div className={cn("w-px transition-colors duration-500 ease-in-out", theme.metricsDivider)}></div>
                <div className="text-center px-3">
                  <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-1 transition-colors duration-500 ease-in-out", theme.metricLabel)}>Day Production</p>
                  <p className="text-xl font-mono font-bold text-[#4285F4]">{topMetrics.dayProduction}</p>
                </div>
                <div className={cn("w-px transition-colors duration-500 ease-in-out", theme.metricsDivider)}></div>
                <div className="text-center px-3">
                  <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-1 transition-colors duration-500 ease-in-out", theme.metricLabel)}>End of Day</p>
                  <p className="text-xl font-mono font-bold text-[#10B981]">{topMetrics.endOfDay}</p>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 p-8 space-y-8">
            {/* Machine Tabs */}
            <div className={cn("flex items-center justify-between border-b pb-2 transition-colors duration-500 ease-in-out", theme.tableBorder)}>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {equipments.map(eq => (
                  <Button
                    key={eq.id}
                    variant={activeMachineId === eq.id ? "default" : "outline"}
                    className={cn(
                      "h-11 px-8 text-sm font-bold transition-all rounded-t-xl rounded-b-none border-b-0 duration-500 ease-in-out",
                      activeMachineId === eq.id ? theme.tabActive : theme.tabInactive
                    )}
                    onClick={() => setActiveMachineId(eq.id)}
                  >
                    <CubeTransparent weight={activeMachineId === eq.id ? "fill" : "regular"} className="w-5 h-5 mr-2" />
                    {eq.name}
                  </Button>
                ))}
              </div>
            </div>

            {!activeMachineId ? (
              <div className={cn("rounded-xl border shadow-lg p-16 flex flex-col items-center justify-center transition-colors duration-500 ease-in-out", theme.emptyCard)}>
                <CubeTransparent className="w-12 h-12 mb-4 opacity-20" />
                <p className={cn("text-lg font-medium transition-colors duration-500 ease-in-out", theme.emptyCardTitle)}>No machine selected</p>
                <p className="text-sm">Choose a machine above to view and edit its schedule.</p>
              </div>
            ) : (
              <>
              <div className={cn("rounded-xl border shadow-lg overflow-hidden transition-colors duration-500 ease-in-out", theme.card)}>
                <div className={cn("p-6 border-b flex items-center justify-between gap-4 transition-colors duration-500 ease-in-out", theme.cardHeader)}>
                  <div className="flex items-center gap-3">
                    <h3 className={cn("font-bold text-lg transition-colors duration-500 ease-in-out", theme.cardTitle)}>
                      Schedule for {activeMachine?.name}
                    </h3>
                    {activeMachine?.avgPiecesPerHour && (
                      <span className={cn("text-xs font-bold border px-2.5 py-1 rounded-full whitespace-nowrap transition-colors duration-500 ease-in-out", theme.rateBadge)}>
                        Avg {activeMachine.avgPiecesPerHour} Cores/hr
                      </span>
                    )}
                    <div className={cn("flex items-center gap-2 pl-4 ml-2 border-l transition-colors duration-500 ease-in-out", theme.tableBorder)}>
                      <Label htmlFor="viewLab" className={cn("text-[10px] font-bold uppercase tracking-wider transition-colors duration-500 ease-in-out", theme.label)}>Labourers</Label>
                      <Switch
                        id="viewLab"
                        checked={viewLabourers}
                        onCheckedChange={setViewLabourers}
                        className={cn("transition-colors duration-500 ease-in-out", isNightShift ? "data-checked:bg-orange-500" : "data-checked:bg-[#4F46E5]")}
                      />
                    </div>
                  </div>

                  <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                    <PopoverTrigger
                      render={
                        <Button
                          role="combobox"
                          aria-expanded={comboboxOpen}
                          className={cn("w-[320px] justify-between h-10 font-semibold shadow-md transition-colors duration-500 ease-in-out", theme.addButton)}
                        />
                      }
                    >
                      + Add Core Box to Schedule
                      <CaretDown className="ml-2 h-4 w-4 shrink-0 opacity-70" />
                    </PopoverTrigger>
                    <PopoverContent className={cn("w-[320px] p-0 shadow-xl rounded-xl transition-colors duration-500 ease-in-out", theme.popoverContent)}>
                      <Command className="bg-transparent text-inherit">
                        <CommandInput placeholder="Search Order or Core Box..." className="border-none focus:ring-0 text-sm h-11" />
                        <CommandList className="max-h-[300px] overflow-y-auto">
                          <CommandEmpty className={cn("py-6 text-center text-sm px-4 transition-colors duration-500 ease-in-out", theme.rowMuted)}>
                            {mappedCoreBoxes.length === 0
                              ? 'No core boxes are mapped to this machine yet. Map them in Equipment Master first.'
                              : 'No pending core boxes found.'}
                          </CommandEmpty>
                          <CommandGroup heading="Pending Backlog" className={isNightShift ? "**:[[cmdk-group-heading]]:text-orange-600!" : undefined}>
                            {backlogOptions.map((b) => (
                              <CommandItem
                                key={`${b.orderNo}|${b.coreBoxCode}`}
                                value={`${b.orderNo} ${b.coreBoxCode}`}
                                onSelect={() => addCoreBoxToMachine(`${b.orderNo}|${b.coreBoxCode}`)}
                                className={cn(
                                  "cursor-pointer py-3 px-4 flex items-center gap-3 border-b last:border-0 transition-colors duration-500 ease-in-out",
                                  theme.popoverItemBorder,
                                  isNightShift ? "hover:bg-orange-50 data-selected:bg-orange-50" : "hover:bg-[#F4F6FB]"
                                )}
                              >
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className={cn("font-bold transition-colors duration-500 ease-in-out", theme.rowText)}>{b.coreBoxCode}</span>
                                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors duration-500 ease-in-out", isNightShift ? "text-orange-700 bg-orange-100" : "text-[#64748B] bg-[#F4F6FB]")}>
                                      Remaining: {b.totalRequired - b.totalScheduled}
                                    </span>
                                  </div>
                                  <div className={cn("text-xs mt-1 transition-colors duration-500 ease-in-out", theme.rowMuted)}>Order: <span className="text-[#4285F4] font-mono">{b.orderNo}</span></div>
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
                  <div className={cn("p-16 flex flex-col items-center justify-center transition-colors duration-500 ease-in-out", theme.rowMuted)}>
                    <CubeTransparent className="w-12 h-12 mb-4 opacity-20" />
                    <p className={cn("text-lg font-medium transition-colors duration-500 ease-in-out", theme.emptyCardTitle)}>No core boxes scheduled</p>
                    <p className="text-sm">Click the button above to add a core box to this machine's schedule.</p>
                  </div>
                ) : (
                  <div className="w-full overflow-x-auto">
                    <table className="w-full min-w-[900px] table-fixed text-sm text-left">
                      <thead className={cn("border-b uppercase tracking-wider font-bold text-[11px] transition-colors duration-500 ease-in-out", theme.tableHead)}>
                        <tr>
                          <th className="px-3 py-3 w-[150px]">Core Box Details</th>
                          <th className={cn("px-1.5 py-3 text-center border-x w-[120px] transition-colors duration-500 ease-in-out", theme.tableBorder)}>Quantity Info</th>
                          {TIME_SLOTS.map(slot => (
                            <th key={slot.time} className={cn("px-1 py-3 text-center border-r leading-tight transition-colors duration-500 ease-in-out", theme.tableBorder)}>
                              <div>{slot.time}</div>
                              <div className={cn("text-[9px] font-normal normal-case transition-colors duration-500 ease-in-out", theme.rowMuted)}>to {slot.endTime}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className={cn("divide-y transition-colors duration-500 ease-in-out", theme.tableDivide)}>
                        {rowMeta.map(({ row }) => {
                          const scheduledSum = Object.values(row.hourlyTargets).reduce((s, v) => s + (v || 0), 0)
                          const target = parseInt(row.totalQty, 10) || 0
                          const delta = target - scheduledSum
                          const isMismatched = delta !== 0 && row.totalQty !== ''
                          return (
                          <tr key={row.id} className={cn("transition-colors duration-500 ease-in-out group", theme.rowHover)}>
                            <td className="px-3 py-3">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className={cn("font-bold text-sm truncate transition-colors duration-500 ease-in-out", theme.rowText)}>{row.coreBoxCode}</span>
                                  <button
                                    onClick={() => removeRow(row.id)}
                                    title="Remove from schedule"
                                    className={cn("hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all shrink-0", theme.rowMuted)}
                                  >
                                    <Trash className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <span className={cn("text-[10px] truncate transition-colors duration-500 ease-in-out", theme.rowMuted)}>{row.orderNo} | {row.productName}</span>
                              </div>
                            </td>
                            <td className={cn("px-2 py-3 text-center border-x transition-colors duration-500 ease-in-out", theme.pendingQtyCell)}>
                              <div className="flex flex-col items-stretch justify-center gap-1.5 w-full max-w-[100px] mx-auto">
                                <div className="grid grid-cols-[20px_1fr] gap-1 items-center">
                                  <span className={cn("h-7 flex items-center text-[9px] font-bold leading-none text-left transition-colors duration-500 ease-in-out", theme.rowMuted)}>PQ</span>
                                  <div
                                    title="Possible quantity - equipment-derived capacity, view only"
                                    className={cn("h-7 flex items-center justify-center font-mono font-semibold text-xs px-1 rounded-md border transition-colors duration-500 ease-in-out", theme.pendingQtyDefault)}
                                  >
                                    {row.possibleQtyText || 0}
                                  </div>
                                  <span className={cn("h-7 flex items-center text-[9px] font-bold leading-none text-left transition-colors duration-500 ease-in-out", theme.rowMuted)}>TQ</span>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={row.totalQty}
                                    onChange={e => handleTotalQtyInput(row.id, e.target.value)}
                                    onBlur={() => autoFillRow(row.id)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') {
                                        autoFillRow(row.id)
                                        e.currentTarget.blur()
                                      }
                                    }}
                                    placeholder="0"
                                    title={isMismatched ? (delta > 0 ? `${delta} not yet scheduled to a time slot` : `${-delta} more scheduled than the total qty`) : undefined}
                                    className={cn(
                                      "h-7 font-mono text-center font-bold text-xs px-1 transition-colors duration-500 ease-in-out focus-visible:ring-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                      isMismatched ? theme.mismatch : theme.pendingQtyDefault,
                                      !isMismatched && theme.pendingQtyRing
                                    )}
                                  />
                                  <span />
                                  <Button
                                    onClick={() => autoFillRow(row.id)}
                                    size="icon"
                                    variant="outline"
                                    title="Auto-fill time slots"
                                    className={cn("h-6 w-full shrink-0 transition-colors duration-500 ease-in-out", theme.autoFillButton)}
                                  >
                                    <MagicWand weight="fill" className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                                {isMismatched && (
                                  <span className={cn("block w-full text-[9px] font-bold leading-none whitespace-nowrap text-center transition-colors duration-500 ease-in-out", theme.mismatchLabel)}>
                                    {delta > 0 ? `+${delta} unscheduled` : `${-delta} over`}
                                  </span>
                                )}
                              </div>
                            </td>
                            {TIME_SLOTS.map(slot => {
                              const ownValue = row.hourlyTargets[slot.time] || 0

                              return (
                                <td key={slot.time} className={cn("px-1 py-2 text-center border-r transition-colors duration-500 ease-in-out", theme.tableBorder)}>
                                  <div className="flex flex-col gap-1 items-center justify-center">
                                    <Input
                                      type="number"
                                      min="0"
                                      value={row.hourlyTargets[slot.time] || ''}
                                      onChange={e => handleHourlyChange(row.id, slot.time, e.target.value)}
                                      placeholder="-"
                                      className={cn(
                                        "w-full max-w-[52px] mx-auto h-8 text-center font-mono text-xs px-1 bg-transparent border-transparent transition-all shadow-none",
                                        isNightShift
                                          ? "hover:border-orange-200 focus:border-orange-400 focus:bg-white"
                                          : "hover:border-[#E0E7FF] focus:border-[#4285F4] focus:bg-white",
                                        ownValue > 0 && (isMismatched ? theme.mismatchCell : theme.hourlyFilled)
                                      )}
                                    />
                                    {viewLabourers && (
                                      <div className="flex items-center justify-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => handleWorkerChange(row.id, slot.time, -1)}
                                          className={cn(
                                            "w-4 h-4 flex items-center justify-center rounded text-xs font-bold leading-none transition-colors duration-500 ease-in-out",
                                            isNightShift ? "bg-orange-100 text-orange-700 hover:bg-orange-200" : "bg-[#E2E8F0] text-[#475569] hover:bg-[#CBD5E1]"
                                          )}
                                        >-</button>
                                        <span className="text-[10px] w-3 text-center font-mono font-medium text-inherit">{row.hourlyWorkers[slot.time] || 0}</span>
                                        <button
                                          onClick={() => handleWorkerChange(row.id, slot.time, 1)}
                                          className={cn(
                                            "w-4 h-4 flex items-center justify-center rounded text-xs font-bold leading-none transition-colors duration-500 ease-in-out",
                                            isNightShift ? "bg-orange-100 text-orange-700 hover:bg-orange-200" : "bg-[#E2E8F0] text-[#475569] hover:bg-[#CBD5E1]"
                                          )}
                                        >+</button>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              )
                            })}
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              </>
            )}
          </div>

          <DialogFooter className={cn("m-0 p-6 border-t shrink-0 sm:justify-end rounded-b-2xl transition-colors duration-500 ease-in-out", theme.footer)}>
            <Button variant="ghost" onClick={onClose} className={cn("transition-colors duration-500 ease-in-out", theme.cancelButton)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={!isDirty}
              className={cn(
                "shadow-[0_4px_10px_-2px_rgba(79,70,229,0.3)] h-10 px-8 text-sm transition-colors duration-500 ease-in-out disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none",
                isNightShift ? "bg-orange-500 text-white hover:bg-orange-500/90" : "bg-[#4F46E5] text-white hover:bg-[#4F46E5]/90"
              )}
            >
              Save Day Plan
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
    <CapacityErrorDialog lines={capacityErrorLines} onClose={() => setCapacityErrorLines(null)} />
    </>
  )
}
