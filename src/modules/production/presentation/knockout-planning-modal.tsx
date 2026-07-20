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
import { CubeTransparent, Trash, CaretDown, CaretLeft, CaretRight, MagicWand } from '@phosphor-icons/react'
import { cn } from '@/shared/lib/utils'
import { generateTimeSlots, TimeSlot, resolveAvgProductionRate } from '@/shared/lib/utils'
import type { Shift } from './shift-master-page'

interface KnockoutPlanningModalProps {
  isOpen: boolean
  onClose: () => void
  date: string
  openOrders: any[]
  backlogData: BacklogItem[] // pieces, not moulds - required = poured moulds x cavities
  dailyPlans: any[] // existing plans for this date and stage
  onSaveDayPlan: (date: string, plans: any[]) => void
  // Lets the header arrows step to the adjacent day without closing the
  // modal. Optional so the modal still works for any caller that hasn't
  // wired up day navigation.
  onNavigateDate?: (direction: 1 | -1) => void
}

interface PlannedRow {
  id: string
  planId?: string
  orderId: string
  orderNo: string
  itemId: string
  productName: string
  patternRef: string
  machineId: string
  // Display-only possible-quantity text (PQ). Seeded from the computed
  // capacity (avgPiecesPerHour x shift hours) but freely editable afterward -
  // never used for capacity validation, which always uses the live
  // equipment-computed value instead.
  possibleQtyText: string
  hourlyTargets: Record<string, number>
  hourlyWorkers: Record<string, number>
  isConfirmed: boolean
  // Quantity (in pieces) this row already contributed to the backlog's
  // totalScheduled when the modal opened - needed to compute how much MORE
  // this row can take without double-subtracting its own prior contribution.
  originalQty: number
}

export function KnockoutPlanningModal({
  isOpen,
  onClose,
  date,
  openOrders,
  backlogData,
  dailyPlans,
  onSaveDayPlan,
  onNavigateDate
}: KnockoutPlanningModalProps) {
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
            const knockoutEquips = data.filter((e: any) => e.type === 'Knockout' && e.isActive)
            setEquipments(knockoutEquips)
          })
          .catch(console.error)
      }
    }
  }, [isOpen])

  // Stepping to a different day (via the header arrows) defaults back to the
  // first shift (Day Shift) instead of carrying over whatever shift was last
  // selected - each day's plan starts fresh rather than silently staying on
  // Night Shift because that's what the previous day happened to be on.
  useEffect(() => {
    if (shifts.length > 0) setSelectedShiftId(shifts[0].id!)
  }, [date])

  const selectedShift = shifts.find(s => s.id === selectedShiftId) || shifts[0]
  const TIME_SLOTS: TimeSlot[] = selectedShift
    ? generateTimeSlots(selectedShift.startTime, selectedShift.endTime, selectedShift.breaks || [])
    : []

  // Night Shift gets its own warm light-orange theme (same light structure as
  // Day Shift, just the violet accent swapped for orange) so the whole card
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
    dialog: 'bg-[#F5F3FF] border-[#E9D5FF]',
    header: 'bg-white border-[#E9D5FF]',
    title: 'text-[#3B0764]',
    label: 'text-[#64748B]',
    selectTrigger: 'border-[#E9D5FF] bg-[#FFFFFF] text-[#3B0764] hover:bg-[#FAF5FF]',
    selectContent: 'bg-[#FFFFFF] border-[#E9D5FF]',
    selectItem: 'text-[#3B0764]',
    metricsBar: 'bg-[#FFFFFF] border-[#E9D5FF]',
    metricsDivider: 'bg-[#E9D5FF]',
    metricLabel: 'text-[#94A3B8]',
    metricValue: 'text-[#3B0764]',
    tabActive: 'bg-[#7C3AED] text-white shadow-[0_-4px_10px_-2px_rgba(124,58,237,0.2)]',
    tabInactive: 'bg-[#FFFFFF] border-[#E9D5FF] text-[#64748B] hover:bg-[#FAF5FF] hover:text-[#3B0764]',
    emptyCard: 'bg-white border-[#E9D5FF] text-[#94A3B8]',
    emptyCardTitle: 'text-[#64748B]',
    card: 'bg-white border-[#E9D5FF]',
    cardHeader: 'bg-gradient-to-r from-[#FAF5FF] to-white border-[#E9D5FF]',
    cardTitle: 'text-[#3B0764]',
    rateBadge: 'text-[#7C3AED] bg-[#F3E8FF] border-[#E9D5FF]',
    addButton: 'bg-[#7C3AED] text-white hover:bg-[#7C3AED]/90',
    popoverContent: 'bg-white border-[#E9D5FF] text-[#3B0764]',
    popoverItemBorder: 'border-[#F5F3FF]',
    tableHead: 'bg-[#FAF5FF] border-[#E9D5FF] text-[#64748B]',
    tableBorder: 'border-[#E9D5FF]',
    tableDivide: 'divide-[#E9D5FF]',
    rowHover: 'hover:bg-[#F5F3FF]',
    rowText: 'text-[#3B0764]',
    rowMuted: 'text-[#94A3B8]',
    pendingQtyCell: 'bg-[#F3E8FF] border-[#E9D5FF]',
    pendingQtyDefault: 'bg-[#FFFFFF] border-[#D8B4FE] text-[#7C3AED]',
    pendingQtyRing: 'focus-visible:ring-[#7C3AED] focus-visible:border-[#7C3AED]',
    mismatch: 'bg-rose-50 border-rose-400 text-rose-700 focus-visible:ring-rose-400 focus-visible:border-rose-400',
    mismatchCell: 'bg-rose-50 border-rose-400 text-rose-700',
    mismatchLabel: 'text-rose-600',
    autoFillButton: 'text-[#7C3AED] border-[#D8B4FE] hover:bg-[#F3E8FF] hover:border-[#7C3AED]',
    hourlyFilled: 'bg-[#F5F3FF] border-[#E9D5FF] text-[#3B0764]',
    footer: 'bg-[#FFFFFF] border-[#E9D5FF]',
    cancelButton: 'text-[#64748B] hover:text-[#3B0764] hover:bg-[#FAF5FF]',
  }

  // Initialize plans - scoped to the currently selected shift too, not just
  // date/stage. Without this, Day and Night shift showed the exact same
  // rows (whichever shift was selected at save time silently overwrote the
  // other's shiftId), same bug already fixed for Core/Mould/Melt. Plans
  // saved before shiftId existed (no value at all) still show under any
  // shift, since we can't know which one they belonged to.
  useEffect(() => {
    if (isOpen && dailyPlans && selectedShiftId) {
      const existingKnockoutPlans = dailyPlans.filter(p => p.stage === 'Knockout' && (!p.shiftId || p.shiftId === selectedShiftId))
      const initRows: PlannedRow[] = existingKnockoutPlans.map(p => {
        const order = openOrders.find(o => (o.id || o._id) === p.orderId)
        const b = backlogData.find(b => b.itemId === p.itemId)
        return {
          id: Math.random().toString(),
          planId: p.id || p._id,
          orderId: p.orderId || '',
          orderNo: order?.customerOrderNo || '',
          itemId: p.itemId || '',
          productName: b?.productName || '',
          patternRef: p.patternRef || '',
          machineId: p.equipmentId || '',
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
  }, [isOpen, date, dailyPlans, openOrders, backlogData, selectedShiftId])

  // Top panel metrics (Global across all planned items)
  const topMetrics = useMemo(() => {
    let beginningOfDay = 0
    let dayProduction = 0
    let endOfDay = 0

    backlogData.forEach(b => {
      beginningOfDay += Math.max(0, b.totalRequired - b.totalScheduled)
    })

    plannedRows.forEach(r => {
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
    itemId: r.itemId,
    possibleQtyText: r.possibleQtyText,
    hourlyTargets: r.hourlyTargets,
    hourlyWorkers: r.hourlyWorkers
  })

  const isDirty = useMemo(
    () => JSON.stringify(plannedRows.map(toSnapshotRow)) !== initialSnapshotRef.current,
    [plannedRows]
  )

  // Warn before discarding unsaved edits when hopping days via the header
  // arrows - otherwise just switch immediately.
  const handleNavigateDate = (direction: 1 | -1) => {
    if (isDirty && !confirm('You have unsaved changes on this day. Discard them and switch days?')) return
    onNavigateDate?.(direction)
  }

  // Real, equipment-derived ceiling for a machine this shift - the only
  // number ever used for capacity validation (PQ text is display-only).
  const computePossibleQty = (machineId: string) => {
    const eq = equipments.find(e => e.id === machineId)
    const avgProd = resolveAvgProductionRate(undefined, eq?.avgPiecesPerHour)
    const shiftHours = TIME_SLOTS.reduce((s, sl) => s + sl.hours, 0)
    return Math.round(avgProd * shiftHours)
  }

  // One backlog entry per item (representativeId), no merging needed like
  // Core's core-box-shared-across-products case - itemId is already unique.
  const getBacklogAggregate = (orderNo: string, itemId: string) => {
    const matches = backlogData.filter(b => b.orderNo === orderNo && b.itemId === itemId)
    return {
      totalRequired: matches.reduce((s, b) => s + b.totalRequired, 0),
      totalScheduled: matches.reduce((s, b) => s + b.totalScheduled, 0)
    }
  }

  // How much of a product's requirement this session has already newly
  // committed, across EVERY machine (not just the active one) - backlogData
  // only reflects what's actually saved to the server, so without this a
  // product added to a second machine this session would look like the full
  // amount is still available, letting the same requirement be over-claimed.
  const getSessionCommittedQty = (orderNo: string, itemId: string) => plannedRows
    .filter(r => r.orderNo === orderNo && r.itemId === itemId)
    .reduce((sum, r) => sum + (Object.values(r.hourlyTargets).reduce((s, v) => s + (v || 0), 0) - r.originalQty), 0)

  // Validates and builds the save payload; returns null if blocked (a
  // capacity-error popup was already shown). Shared by both Save Day Plan
  // (closes the modal) and Save & Refresh (keeps it open).
  const buildPlansToSave = (): any[] | null => {
    // Checked per PRODUCT (grouped across every machine), not per row - a
    // product can legitimately be split across two knockout machines to
    // speed things up, but checking each row in isolation would let every
    // row look "fine" on its own while the combined total blew past what
    // was actually required.
    const rowGroups = new Map<string, { itemId: string, productName: string, scheduledSum: number, originalQty: number }>()
    plannedRows.forEach(r => {
      const key = `${r.orderNo}|${r.itemId}`
      const g = rowGroups.get(key) || { itemId: r.itemId, productName: r.productName, scheduledSum: 0, originalQty: 0 }
      g.scheduledSum += Object.values(r.hourlyTargets).reduce((s, v) => s + (v || 0), 0)
      g.originalQty += r.originalQty
      rowGroups.set(key, g)
    })

    const overQuantityGroups = Array.from(rowGroups.entries()).map(([key, g]) => {
      const [orderNo] = key.split('|')
      const { totalRequired, totalScheduled } = getBacklogAggregate(orderNo, g.itemId)
      const cap = Math.max(0, totalRequired - (totalScheduled - g.originalQty))
      return { g, cap }
    }).filter(({ g, cap }) => g.scheduledSum > cap)

    if (overQuantityGroups.length > 0) {
      setCapacityErrorLines(overQuantityGroups.map(({ g, cap }) =>
        cap <= 0
          ? `${g.productName}: product quantity already fully planned`
          : `${g.productName}: product quantity satisfied - only ${cap} more can be scheduled across your rows`
      ))
      return null
    }

    const plansToSave = plannedRows.map(r => {
      // Only what's actually distributed into achievable hourly slots counts
      // as scheduled - not the (possibly higher) TQ the user typed, which may
      // include more than the machine can produce today.
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
        itemId: r.itemId,
        stage: 'Knockout',
        patternRef: r.patternRef,
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
    return [...plansToSave, ...deletions]
  }

  const handleSave = () => {
    const plans = buildPlansToSave()
    if (!plans) return
    onSaveDayPlan(date, plans)
    onClose()
  }

  // Saves exactly like Save Day Plan, but keeps the modal open and re-loads
  // this shift's rows fresh from the just-saved backend state (the dailyPlans
  // prop update naturally re-triggers the init effect), instead of closing.
  const handleSaveAndRefresh = () => {
    const plans = buildPlansToSave()
    if (!plans) return
    onSaveDayPlan(date, plans)
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

  // Fills `target` (pieces) into this machine's shift slots up to its own
  // per-hour capacity (avg pieces/hr from Equipment Master x slot hours) -
  // not an even split. A slot only spills into the next once it's actually
  // full, so a second product added to the same machine tops off whatever
  // headroom the first one left behind rather than restarting the split.
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

      const { totalRequired, totalScheduled } = getBacklogAggregate(row.orderNo, row.itemId)
      // Net out every OTHER row's session commitment (any machine, not just
      // this one) too - otherwise auto-fill could claim the full remaining
      // pool for this row even though another row already claimed part of it
      // this session, over-committing the moment both get saved.
      const thisRowCommitted = Object.values(row.hourlyTargets).reduce((s, v) => s + (v || 0), 0) - row.originalQty
      const otherRowsCommitted = getSessionCommittedQty(row.orderNo, row.itemId) - thisRowCommitted
      const pendingQty = Math.max(0, totalRequired - (totalScheduled - row.originalQty) - otherRowsCommitted)
      if (pendingQty <= 0) return prev

      const { hourlyTargets, hourlyWorkers } = distributeQty(pendingQty, row.machineId, row.id, prev)
      return prev.map(r => r.id === rowId ? { ...r, hourlyTargets, hourlyWorkers } : r)
    })
  }

  // Quantity-cap violations are only reported at Save time (buildPlansToSave) -
  // no live popup while typing, since interrupting the user mid-edit with a
  // "Cannot Save" dialog before they've finished distributing today's plan is
  // more disruptive than helpful. Save's own hard block stays authoritative.
  const handleHourlyChange = (rowId: string, timeSlot: string, value: string) => {
    const num = value === '' ? undefined : parseInt(value, 10)
    setPlannedRows(prev => prev.map(r => {
      if (r.id !== rowId) return r
      const newValue = Math.max(0, num || 0)
      return { ...r, hourlyTargets: { ...r.hourlyTargets, [timeSlot]: newValue } }
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

  const addProductToMachine = (backlogItemKey: string) => {
    if (!backlogItemKey) return
    const [orderNo, itemId] = backlogItemKey.split('|')
    const b = backlogData.find(b => b.orderNo === orderNo && b.itemId === itemId)
    if (!b) return
    const { totalRequired, totalScheduled } = getBacklogAggregate(orderNo, itemId)
    const order = openOrders.find(o => o.customerOrderNo === orderNo)

    const remaining = Math.max(0, totalRequired - totalScheduled - getSessionCommittedQty(orderNo, itemId))

    setPlannedRows(prev => {
      const { hourlyTargets, hourlyWorkers } = remaining > 0
        ? distributeQty(remaining, activeMachineId, undefined, prev)
        : { hourlyTargets: {}, hourlyWorkers: {} }

      return [...prev, {
        id: Math.random().toString(),
        orderId: order?.id || order?._id || '',
        orderNo,
        itemId,
        productName: b.productName,
        patternRef: b.patternRef || '',
        machineId: activeMachineId,
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

  // Combobox options for backlog items needing scheduling - no per-machine
  // restriction like Core's mapped core boxes, any Knockout machine can take
  // any product.
  const backlogOptions = useMemo(() => {
    // Exclude products that already have a row on THIS machine this session -
    // adding the same one twice would double-book it and, on save, create a
    // second DB row instead of updating the first. A product can still be
    // offered for a DIFFERENT machine (splitting one product across two
    // machines is legitimate), but its displayed remaining is netted against
    // every session row for that product - on any machine - so it can't look
    // like the full amount is still available when part was already claimed
    // elsewhere this session.
    const alreadyOnMachine = new Set(activeRows.map(r => `${r.orderNo}|${r.itemId}`))
    return backlogData
      .filter(b => !alreadyOnMachine.has(`${b.orderNo}|${b.itemId}`))
      .map(b => ({ ...b, totalScheduled: b.totalScheduled + getSessionCommittedQty(b.orderNo, b.itemId) }))
      .filter(b => b.totalRequired > b.totalScheduled)
  }, [backlogData, activeRows, plannedRows])

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
                <DialogTitle className={cn("flex items-center gap-2 text-2xl font-heading transition-colors duration-500 ease-in-out", theme.title)}>
                  {onNavigateDate && (
                    <button
                      type="button"
                      onClick={() => handleNavigateDate(-1)}
                      className={cn("p-1 rounded-lg transition-colors", isNightShift ? "hover:bg-orange-100" : "hover:bg-[#F3E8FF]")}
                      aria-label="Previous day"
                    >
                      <CaretLeft size={20} weight="bold" />
                    </button>
                  )}
                  <span>{dateString} - Knockout Planning</span>
                  {onNavigateDate && (
                    <button
                      type="button"
                      onClick={() => handleNavigateDate(1)}
                      className={cn("p-1 rounded-lg transition-colors", isNightShift ? "hover:bg-orange-100" : "hover:bg-[#F3E8FF]")}
                      aria-label="Next day"
                    >
                      <CaretRight size={20} weight="bold" />
                    </button>
                  )}
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
                        Avg {activeMachine.avgPiecesPerHour} Pieces/hr
                      </span>
                    )}
                    <div className={cn("flex items-center gap-2 pl-4 ml-2 border-l transition-colors duration-500 ease-in-out", theme.tableBorder)}>
                      <Label htmlFor="viewLab" className={cn("text-[10px] font-bold uppercase tracking-wider transition-colors duration-500 ease-in-out", theme.label)}>Labourers</Label>
                      <Switch
                        id="viewLab"
                        checked={viewLabourers}
                        onCheckedChange={setViewLabourers}
                        className={cn("transition-colors duration-500 ease-in-out", isNightShift ? "data-checked:bg-orange-500" : "data-checked:bg-[#7C3AED]")}
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
                      + Add Product to Schedule
                      <CaretDown className="ml-2 h-4 w-4 shrink-0 opacity-70" />
                    </PopoverTrigger>
                    <PopoverContent className={cn("w-[320px] p-0 shadow-xl rounded-xl transition-colors duration-500 ease-in-out", theme.popoverContent)}>
                      <Command className="bg-transparent text-inherit">
                        <CommandInput placeholder="Search Order or Product..." className="border-none focus:ring-0 text-sm h-11" />
                        <CommandList className="max-h-[300px] overflow-y-auto">
                          <CommandEmpty className={cn("py-6 text-center text-sm px-4 transition-colors duration-500 ease-in-out", theme.rowMuted)}>
                            No pending products found.
                          </CommandEmpty>
                          <CommandGroup heading="Poured, Ready for Knockout" className={isNightShift ? "**:[[cmdk-group-heading]]:text-orange-600!" : "**:[[cmdk-group-heading]]:text-[#7C3AED]!"}>
                            {backlogOptions.map((b) => (
                              <CommandItem
                                key={`${b.orderNo}|${b.itemId}`}
                                value={`${b.orderNo} ${b.productName}`}
                                onSelect={() => addProductToMachine(`${b.orderNo}|${b.itemId}`)}
                                className={cn(
                                  "cursor-pointer py-3 px-4 flex items-center gap-3 border-b last:border-0 transition-colors duration-500 ease-in-out",
                                  theme.popoverItemBorder,
                                  isNightShift ? "hover:bg-orange-50 data-selected:bg-orange-50" : "hover:bg-[#F5F3FF]"
                                )}
                              >
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className={cn("font-bold transition-colors duration-500 ease-in-out", theme.rowText)}>{b.productName}</span>
                                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors duration-500 ease-in-out", isNightShift ? "text-orange-700 bg-orange-100" : "text-[#7C3AED] bg-[#F3E8FF]")}>
                                      Remaining: {b.totalRequired - b.totalScheduled} pcs
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
                    <p className={cn("text-lg font-medium transition-colors duration-500 ease-in-out", theme.emptyCardTitle)}>No products scheduled</p>
                    <p className="text-sm">Click the button above to add a product to this machine's schedule.</p>
                  </div>
                ) : (
                  <div className="w-full overflow-x-auto">
                    <table className="w-full min-w-[900px] table-fixed text-sm text-left">
                      <thead className={cn("border-b uppercase tracking-wider font-bold text-[11px] transition-colors duration-500 ease-in-out", theme.tableHead)}>
                        <tr>
                          <th className="px-3 py-3 w-[150px]">Product Details</th>
                          <th className={cn("px-1.5 py-3 text-center border-x w-[120px] transition-colors duration-500 ease-in-out", theme.tableBorder)}>Quantity Info (pcs)</th>
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
                          const { totalRequired: itemRequired, totalScheduled: itemScheduled } = getBacklogAggregate(row.orderNo, row.itemId)
                          const pendingQty = Math.max(0, itemRequired - itemScheduled)
                          return (
                          <tr key={row.id} className={cn("transition-colors duration-500 ease-in-out group", theme.rowHover)}>
                            <td className="px-3 py-3">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className={cn("font-bold text-sm truncate transition-colors duration-500 ease-in-out", theme.rowText)}>{row.productName}</span>
                                  <button
                                    onClick={() => removeRow(row.id)}
                                    title="Remove from schedule"
                                    className={cn("hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all shrink-0", theme.rowMuted)}
                                  >
                                    <Trash className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <span className={cn("text-[10px] truncate transition-colors duration-500 ease-in-out", theme.rowMuted)}>{row.orderNo} | {row.patternRef}</span>
                              </div>
                            </td>
                            <td className={cn("px-2 py-3 text-center border-x transition-colors duration-500 ease-in-out", theme.pendingQtyCell)}>
                              <div className="flex flex-col items-stretch justify-center gap-1.5 w-full max-w-[100px] mx-auto">
                                <div className="grid grid-cols-[20px_1fr] gap-1 items-center">
                                  <span className={cn("h-7 flex items-center text-[9px] font-bold leading-none text-left transition-colors duration-500 ease-in-out", theme.rowMuted)}>PQ</span>
                                  <div
                                    title="Pending quantity (pieces) - remaining required for this item across all dates, view only"
                                    className={cn("h-7 flex items-center justify-center font-mono font-semibold text-xs px-1 rounded-md border transition-colors duration-500 ease-in-out", theme.pendingQtyDefault)}
                                  >
                                    {pendingQty}
                                  </div>
                                  <span className={cn("h-7 flex items-center text-[9px] font-bold leading-none text-left transition-colors duration-500 ease-in-out", theme.rowMuted)}>TP</span>
                                  <div
                                    title="Today's production (pieces) - sum of all scheduled hourly targets for today, view only"
                                    className={cn("h-7 flex items-center justify-center font-mono font-semibold text-xs px-1 rounded-md border transition-colors duration-500 ease-in-out", theme.pendingQtyDefault)}
                                  >
                                    {scheduledSum}
                                  </div>
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
                                          : "hover:border-[#E9D5FF] focus:border-[#7C3AED] focus:bg-white",
                                        ownValue > 0 && theme.hourlyFilled
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
              variant="outline"
              onClick={handleSaveAndRefresh}
              disabled={!isDirty}
              className={cn(
                "h-10 px-6 text-sm transition-colors duration-500 ease-in-out disabled:opacity-40 disabled:cursor-not-allowed",
                isNightShift ? "border-orange-500 text-orange-600 hover:bg-orange-50" : "border-[#7C3AED] text-[#7C3AED] hover:bg-[#7C3AED]/5"
              )}
            >
              Save & Refresh
            </Button>
            <Button
              onClick={handleSave}
              disabled={!isDirty}
              className={cn(
                "shadow-[0_4px_10px_-2px_rgba(124,58,237,0.3)] h-10 px-8 text-sm transition-colors duration-500 ease-in-out disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none",
                isNightShift ? "bg-orange-500 text-white hover:bg-orange-500/90" : "bg-[#7C3AED] text-white hover:bg-[#7C3AED]/90"
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
