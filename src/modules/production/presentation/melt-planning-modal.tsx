import { useState, useEffect, useMemo, useRef } from 'react'
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
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/shared/ui/table'
import { CapacityErrorDialog } from '@/shared/ui/capacity-error-dialog'
import { BacklogItem } from './daily-planning-modal'
import { Fire, Trash, Plus, Clock, WarningCircle, CaretLeft, CaretRight, MagnifyingGlass } from '@phosphor-icons/react'
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
  // Moulds actually produced (Mould Planning's scheduled total) vs. moulds
  // already poured for in Melt across every date - caps how many mould-units
  // a product's pours can claim, same idea as Core/Mould's quantity cap.
  mouldCapBacklog: BacklogItem[]
  onSaveDayPlan: (date: string, plans: any[]) => void
  // Lets the header arrows step to the adjacent day without closing the
  // modal. Optional so the modal still works for any caller that hasn't
  // wired up day navigation.
  onNavigateDate?: (direction: 1 | -1) => void
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
  // Manual override for which heat on this furnace gets the longer "first
  // heat" duration (furnace startup takes longer than a heat poured into an
  // already-hot furnace). Defaults to the furnace's actual first heat, but
  // the user can move it - e.g. after deleting/reordering heats - since only
  // one heat per furnace/shift can ever be the first heat at a time.
  isFirstHeat: boolean
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
  // Moulds this pour already contributed to mouldCapBacklog's totalScheduled
  // when the modal opened - needed to compute how much MORE it can take
  // without double-subtracting its own prior contribution.
  originalQty: number
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
  mouldCapBacklog,
  onSaveDayPlan,
  onNavigateDate
}: MeltPlanningModalProps) {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [equipments, setEquipments] = useState<any[]>([])
  const [selectedShiftId, setSelectedShiftId] = useState<string>('')
  const [activeFurnaceId, setActiveFurnaceId] = useState<string>('')

  const [heats, setHeats] = useState<Heat[]>([])
  const [pours, setPours] = useState<Pour[]>([])
  const [grades, setGrades] = useState<{ id: string; code: string; name: string }[]>([])

  // Pours removed from the schedule (via heat/pour delete) this session -
  // kept in full (not just planId) for two reasons: (1) without an explicit
  // delete instruction, a removed pour's saved DB row was never told to
  // delete itself, so it kept counting against the mould cap forever even
  // after being removed from view; (2) its originalQty must still be
  // credited against the cap until that deletion is actually saved, or the
  // cap shrinks the moment a pour is deleted instead of growing.
  const [removedPours, setRemovedPours] = useState<Pour[]>([])

  // Which heat's detail card currently shows the "Allocate" table instead of
  // its normal pours list - null means every detail card shows pours as usual.
  const [allocationHeatId, setAllocationHeatId] = useState<string | null>(null)
  const [allocationSearch, setAllocationSearch] = useState('')
  // Which heat's full detail card is open in the popup - null means the popup
  // is closed and only the compact chip grid shows.
  const [detailHeatId, setDetailHeatId] = useState<string | null>(null)

  // Add Heat flow: pick a grade first, then a heat code field appears
  const [addHeatOpen, setAddHeatOpen] = useState(false)
  const [capacityErrorLines, setCapacityErrorLines] = useState<string[] | null>(null)
  const [newHeatGrade, setNewHeatGrade] = useState('')
  const [newHeatCode, setNewHeatCode] = useState('')

  // Snapshot of the fields that matter for saving, captured once when the
  // modal's heats/pours are (re)initialized - compared against current state
  // to know whether navigating away would discard unsaved edits.
  const initialSnapshotRef = useRef<string>('')

  // Auto-scroll target for the selected heat's detail card, and a one-shot
  // flag set only by addHeat() - scrolling should happen right after adding a
  // heat (so the user doesn't have to hunt for it below the fold), not on
  // every manual chip click where the user already knows where they clicked.
  const detailCardRef = useRef<HTMLDivElement>(null)
  const scrollToDetailNext = useRef(false)
  // Same idea, for opening the "Allocate to Heat" table - clicking "Add
  // Pouring Allocation" swaps the card's content in place, but the table
  // itself can still land below the fold, so this scrolls it fully into view
  // right after switching to it.
  const allocationPanelRef = useRef<HTMLDivElement>(null)
  const scrollToAllocationNext = useRef(false)

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

  // Stepping to a different day (via the header arrows) defaults back to the
  // first shift (Day Shift) instead of carrying over whatever shift was last
  // selected - each day's plan starts fresh rather than silently staying on
  // Night Shift because that's what the previous day happened to be on.
  useEffect(() => {
    if (shifts.length > 0) setSelectedShiftId(shifts[0].id!)
  }, [date])

  // Initialize from dailyPlans - scoped to the currently selected shift too,
  // not just date/stage. Without this, Day and Night shift showed the exact
  // same heats/pours (whichever shift was selected at save time silently
  // overwrote the other's shiftId), making the two indistinguishable. Plans
  // saved before shiftId existed (no value at all) still show under any
  // shift, since we can't know which one they belonged to.
  useEffect(() => {
    if (isOpen && dailyPlans && equipments.length > 0 && selectedShiftId) {
      const existingMelt = dailyPlans.filter(p => p.stage === 'Melt' && (!p.shiftId || p.shiftId === selectedShiftId))
      
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
            sequenceNumber: p.heatSequenceNumber,
            // heatNumber === 1 is only a fallback default for plan rows saved
            // before the isFirstHeat column existed.
            isFirstHeat: p.isFirstHeat ?? (hNum === 1)
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

        const loadedMoulds = p.mouldsScheduled || Math.ceil(p.quantityScheduled / mouldWeight) || 0
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
          mouldsScheduled: loadedMoulds,
          isConfirmed: !!p.isConfirmed,
          itemId: p.itemId,
          originalQty: loadedMoulds
        })
      })

      const loadedHeatsArr = Object.values(loadedHeats)
      setHeats(loadedHeatsArr)
      setPours(loadedPours)
      setRemovedPours([])
      initialSnapshotRef.current = JSON.stringify({
        heats: loadedHeatsArr.map(toHeatSnapshot),
        pours: loadedPours.map(toPourSnapshot)
      })
    }
  // equipments.length (not equipments itself) is the dependency deliberately -
  // this should only re-run when equipment data first loads, not every time
  // its contents change (e.g. addHeat updating a furnace's heatSequence
  // locally), which would otherwise wipe out any heat added but not yet saved.
  }, [isOpen, date, dailyPlans, equipments.length, openOrders, products, patterns, selectedShiftId])

  // Fields whose values determine what actually gets saved - used both for
  // the dirty snapshot and its live comparison.
  const toHeatSnapshot = (h: Heat) => ({
    furnaceId: h.furnaceId, heatNumber: h.heatNumber, startTime: h.startTime, endTime: h.endTime, grade: h.grade, heatCode: h.heatCode, isFirstHeat: h.isFirstHeat
  })
  const toPourSnapshot = (p: Pour) => ({
    heatId: p.heatId, mouldsScheduled: p.mouldsScheduled, isConfirmed: p.isConfirmed
  })

  const isDirty = useMemo(
    () => JSON.stringify({ heats: heats.map(toHeatSnapshot), pours: pours.map(toPourSnapshot) }) !== initialSnapshotRef.current,
    [heats, pours]
  )

  // Runs after the newly-added heat's detail card has rendered (detailHeatId
  // changing re-triggers this) - only actually scrolls when addHeat() set the
  // one-shot flag, not on ordinary chip clicks. block: 'center' (not 'end')
  // so the card sits with clear margin instead of flush against the very
  // bottom edge, and the rAF gives the just-added card one extra frame to
  // finish laying out before the browser measures where to scroll to.
  useEffect(() => {
    if (scrollToDetailNext.current && detailCardRef.current) {
      scrollToDetailNext.current = false
      const el = detailCardRef.current
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    }
  }, [detailHeatId])

  // Same pattern as above, but for opening the Allocate table - block: 'end'
  // here (not 'center') since the goal is specifically to bring the table's
  // full contents into view, not center the (much taller) whole panel.
  useEffect(() => {
    if (scrollToAllocationNext.current && allocationPanelRef.current) {
      scrollToAllocationNext.current = false
      const el = allocationPanelRef.current
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'end' })
      })
    }
  }, [allocationHeatId])

  // Warn before discarding unsaved edits when hopping days via the header
  // arrows - otherwise just switch immediately.
  const handleNavigateDate = (direction: 1 | -1) => {
    if (isDirty && !confirm('You have unsaved changes on this day. Discard them and switch days?')) return
    onNavigateDate?.(direction)
  }

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

    const newHeatId = `${activeFurnaceId}-heat-${nextNumber}`
    setHeats(prev => [...prev, {
      id: newHeatId,
      furnaceId: activeFurnaceId,
      heatNumber: nextNumber,
      startTime: formatTime(currentStart),
      endTime: formatTime(currentStart + duration),
      grade: newHeatGrade,
      heatCode: newHeatCode.trim(),
      sequenceNumber: nextSequence,
      isFirstHeat: nextNumber === 1
    }])
    setAddHeatOpen(false)
    setNewHeatCode('')
    // Select the heat just created and scroll its detail card into view -
    // otherwise it's added off-screen at the end of the chip grid and the
    // user has to hunt for it and scroll down manually every time.
    setDetailHeatId(newHeatId)
    setAllocationHeatId(null)
    setAllocationSearch('')
    scrollToDetailNext.current = true

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
  // broken, not just orphaned. Any of those pours that were already saved to
  // the DB (have a planId) must be queued for explicit deletion too - just
  // dropping them from local state would leave their saved row behind,
  // permanently and invisibly still counting against the mould cap.
  const removeHeat = (heatId: string) => {
    setHeats(prev => prev.filter(h => h.id !== heatId))
    setPours(prev => {
      const removed = prev.filter(p => p.heatId === heatId)
      if (removed.length > 0) setRemovedPours(pours => [...pours, ...removed])
      return prev.filter(p => p.heatId !== heatId)
    })
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

  // Moulds actually produced for this item vs. already poured for in Melt
  // across every date - the real ceiling on how many mould-units Melt can
  // ever claim, separate from the kg-based charge-weight capacity check.
  const getMouldCapAggregate = (orderNo: string, patternRef: string) => {
    const matches = mouldCapBacklog.filter(b => b.orderNo === orderNo && b.patternRef === patternRef)
    return {
      totalRequired: matches.reduce((s, b) => s + b.totalRequired, 0),
      totalScheduled: matches.reduce((s, b) => s + b.totalScheduled, 0)
    }
  }

  // How many moulds this session has already newly committed to a product,
  // across EVERY heat/furnace (not just the one currently open) - both
  // backlogData and mouldCapBacklog only reflect what's actually saved to the
  // server, so without this a product could be split across many heats with
  // each pour looking "fine" in isolation while the combined total blew past
  // what was actually required. Pours removed this session count as giving
  // back their full original claim (negative commitment) - otherwise
  // deleting a pour wouldn't free up any room until the delete was saved.
  const getSessionCommittedMoulds = (orderNo: string, patternRef: string) => {
    const presentCommitted = pours
      .filter(p => p.orderNo === orderNo && p.patternRef === patternRef)
      .reduce((sum, p) => sum + (p.mouldsScheduled - p.originalQty), 0)
    const removedCommitted = removedPours
      .filter(p => p.orderNo === orderNo && p.patternRef === patternRef)
      .reduce((sum, p) => sum - p.originalQty, 0)
    return presentCommitted + removedCommitted
  }

  // Validates and builds the save payload; returns null if blocked (a
  // capacity-error popup was already shown). Shared by both Save Day Plan
  // (closes the modal) and Save & Refresh (keeps it open).
  const buildPlansToSave = (): any[] | null => {
    // Block the save if a product's pours, ADDED UP ACROSS EVERY HEAT/FURNACE,
    // claim more mould-units than actually exist for it (produced by Mould
    // Planning, minus what's already poured for elsewhere across every date).
    // This has to be checked per PRODUCT, not per individual pour - checking
    // each pour in isolation let the same product be split across many heats,
    // with every single pour looking "fine" on its own while the combined
    // total blew past what was actually required.
    const pourGroups = new Map<string, { patternRef: string, scheduled: number, originalQty: number }>()
    pours.forEach(p => {
      const key = `${p.orderNo}|${p.patternRef}`
      const g = pourGroups.get(key) || { patternRef: p.patternRef, scheduled: 0, originalQty: 0 }
      g.scheduled += p.mouldsScheduled
      g.originalQty += p.originalQty
      pourGroups.set(key, g)
    })
    // Pours removed this session still contributed their originalQty to the
    // server's totalScheduled (the delete hasn't been saved yet) - credit it
    // back the same way a still-present pour's originalQty would be, or the
    // cap shrinks the moment something is deleted instead of growing.
    removedPours.forEach(p => {
      const key = `${p.orderNo}|${p.patternRef}`
      const g = pourGroups.get(key) || { patternRef: p.patternRef, scheduled: 0, originalQty: 0 }
      g.originalQty += p.originalQty
      pourGroups.set(key, g)
    })

    const overQuantityGroups = Array.from(pourGroups.entries()).map(([key, g]) => {
      const [orderNo] = key.split('|')
      const { totalRequired, totalScheduled } = getMouldCapAggregate(orderNo, g.patternRef)
      const cap = Math.max(0, totalRequired - (totalScheduled - g.originalQty))
      return { g, cap }
    }).filter(({ g, cap }) => g.scheduled > cap)

    if (overQuantityGroups.length > 0) {
      setCapacityErrorLines(overQuantityGroups.map(({ g, cap }) =>
        cap <= 0
          ? `${g.patternRef}: no moulds available to pour - none produced yet or all already poured`
          : `${g.patternRef}: only ${cap} moulds available to pour, ${g.scheduled} scheduled across your pours`
      ))
      return null
    }

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
      return null
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
        isFirstHeat: !!h?.isFirstHeat,
        isConfirmed: p.isConfirmed
      }
    })

    // Heats/pours removed via the trash icon this session need an explicit
    // delete instruction - they're not in plansToSave at all, so without this
    // their existing DB record would sit there untouched forever, silently
    // continuing to count against the mould cap on every future save.
    const deletions = removedPours.filter(p => p.planId).map(p => ({ id: p.planId, _id: p.planId, _delete: true }))
    return [...plansToSave, ...deletions]
  }

  const handleSave = () => {
    const plansToSave = buildPlansToSave()
    if (!plansToSave) return
    onSaveDayPlan(date, plansToSave)
    onClose()
  }

  // Saves exactly like Save Day Plan, but keeps the modal open and re-loads
  // this shift's heats/pours fresh from the just-saved backend state (the
  // dailyPlans prop update naturally re-triggers the init effect), instead
  // of closing.
  const handleSaveAndRefresh = () => {
    const plansToSave = buildPlansToSave()
    if (!plansToSave) return
    onSaveDayPlan(date, plansToSave)
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
        const dur = h.isFirstHeat ? firstDur : regDur
        h.startTime = formatTime(currentMins)
        currentMins += dur
        h.endTime = formatTime(currentMins)
      }

      return [...otherHeats, ...furnaceHeats]
    })
  }

  // Marking a heat "First Heat" is a manual override (e.g. after deleting the
  // original first heat) and only one heat per furnace can hold it at a time,
  // so checking one clears it from every other heat on that furnace. The
  // whole furnace's schedule is then recomputed from the shift start, since
  // moving which heat gets the longer startup duration shifts every heat
  // after it too (not just the ones from the toggled heat onward).
  const toggleFirstHeat = (heatId: string) => {
    setHeats(prev => {
      const heat = prev.find(h => h.id === heatId)
      if (!heat) return prev
      const makingFirst = !heat.isFirstHeat

      const toggled = prev.map(h => {
        if (h.id === heatId) return { ...h, isFirstHeat: makingFirst }
        if (h.furnaceId === heat.furnaceId && makingFirst) return { ...h, isFirstHeat: false }
        return h
      })

      const furnace = equipments.find(e => e.id === heat.furnaceId)
      const shift = shifts.find(s => s.id === selectedShiftId)
      const furnaceHeats = toggled.filter(h => h.furnaceId === heat.furnaceId).sort((a, b) => a.heatNumber - b.heatNumber)
      const otherHeats = toggled.filter(h => h.furnaceId !== heat.furnaceId)

      let currentMins = parseTime(shift?.startTime || '08:00 AM')
      furnaceHeats.forEach(h => {
        const dur = getHeatDurationMins(furnace, h.isFirstHeat)
        h.startTime = formatTime(currentMins)
        currentMins += dur
        h.endTime = formatTime(currentMins)
      })

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
      itemId: backlogItem.itemId,
      originalQty: 0
    }])
    setAllocationHeatId(null)
  }

  // Same as removeHeat - a removed pour's saved DB row (if it has a planId)
  // must be explicitly queued for deletion, not just dropped from view, and
  // its originalQty must still count toward the cap until that's saved.
  const removePour = (pourId: string) => {
    setPours(prev => {
      const pour = prev.find(p => p.id === pourId)
      if (pour) setRemovedPours(pours => [...pours, pour])
      return prev.filter(p => p.id !== pourId)
    })
  }

  const dateObj = new Date(date || new Date())
  const dateString = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  
  const furnace = equipments.find(e => e.id === activeFurnaceId)
  const maxCapacity = furnace?.maxMeltCapacityKg || 150

  const activeHeats = heats.filter(h => h.furnaceId === activeFurnaceId).sort((a, b) => a.heatNumber - b.heatNumber)
  const selectedHeat = activeHeats.find(h => h.id === detailHeatId) || activeHeats[0]
  const selectedHeatPours = selectedHeat ? pours.filter(p => p.heatId === selectedHeat.id) : []
  const selectedHeatWeight = selectedHeatPours.reduce((sum, p) => sum + (p.mouldsScheduled * p.mouldWeight), 0)
  const selectedHeatOverCapacity = selectedHeatWeight > maxCapacity

  // Rows for the "Allocate to Heat" table - same maxAllowed math the old
  // popover used, just resolved once here instead of inline in JSX, plus a
  // free-text filter over product/pattern/order.
  const allocationRows = selectedHeat ? (backlogByGrade.get(selectedHeat.grade) || [])
    .map(b => {
      const pattern = patterns.find(p => p.code === b.patternRef)
      const boxWeight = pattern?.totalWeight || 20
      const sessionCommitted = getSessionCommittedMoulds(b.orderNo, b.patternRef)
      const remainingMoulds = Math.max(0, Math.ceil((b.totalRequired - b.totalScheduled) / boxWeight) - sessionCommitted)
      const remainingHeatCapacity = Math.max(0, maxCapacity - selectedHeatWeight)
      const possibleMoulds = Math.floor(remainingHeatCapacity / boxWeight)
      const { totalRequired: mouldsProduced, totalScheduled: mouldsPoured } = getMouldCapAggregate(b.orderNo, b.patternRef)
      const mouldsAvailable = Math.max(0, mouldsProduced - mouldsPoured - sessionCommitted)
      const maxAllowed = Math.min(remainingMoulds, possibleMoulds, mouldsAvailable)
      return { b, boxWeight, maxAllowed, remainingMoulds }
    })
    .filter(({ b }) => {
      const q = allocationSearch.trim().toLowerCase()
      if (!q) return true
      return b.patternRef.toLowerCase().includes(q) || b.orderNo.toLowerCase().includes(q) || (b.productName || '').toLowerCase().includes(q)
    })
    : []

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
      <DialogContent className={cn("w-full h-full max-w-full rounded-none sm:w-[95vw] sm:max-w-[1440px] sm:h-[90vh] sm:rounded-2xl text-foreground p-0 shadow-2xl flex flex-col transition-colors duration-500 ease-in-out", warmBg, warmBorder)}>
        <div className="flex flex-col w-full h-full">
          {/* Header */}
          <DialogHeader className={cn("p-6 pb-4 border-b shrink-0 bg-white transition-colors duration-500 ease-in-out", warmBorder)}>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2 text-2xl font-heading text-[#172554]">
                  {onNavigateDate && (
                    <button
                      type="button"
                      onClick={() => handleNavigateDate(-1)}
                      className="p-1 rounded-lg transition-colors hover:bg-amber-100"
                      aria-label="Previous day"
                    >
                      <CaretLeft size={20} weight="bold" />
                    </button>
                  )}
                  <span>{dateString} - Melt Planning</span>
                  {onNavigateDate && (
                    <button
                      type="button"
                      onClick={() => handleNavigateDate(1)}
                      className="p-1 rounded-lg transition-colors hover:bg-amber-100"
                      aria-label="Next day"
                    >
                      <CaretRight size={20} weight="bold" />
                    </button>
                  )}
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
                <div className={cn("flex flex-col lg:flex-row lg:items-center gap-6 bg-white rounded-xl border p-5 transition-colors duration-500 ease-in-out", warmBorder)}>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                    <h3 className="font-bold text-[#172554] text-base shrink-0">Heat Schedule</h3>
                    <div className={cn("hidden sm:block h-8 w-px transition-colors duration-500 ease-in-out", warmBorder)} />
                    <div className="flex items-center gap-6 flex-wrap">
                      {furnace?.avgPiecesPerHour && (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8]">Avg Heats/Hr</span>
                          <span className="text-sm font-bold text-amber-600 font-mono leading-none">{furnace.avgPiecesPerHour}</span>
                        </div>
                      )}
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8]">First / Regular</span>
                        <span className="text-sm font-bold text-amber-600 font-mono leading-none">{getHeatDurationMins(furnace, true)}m / {getHeatDurationMins(furnace, false)}m</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8]">Max Capacity</span>
                        <span className="text-sm font-bold text-amber-600 font-mono leading-none">{maxCapacity} kg</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8]">Grade</label>
                        <Select value={newHeatGrade} onValueChange={setNewHeatGrade}>
                          <SelectTrigger className="h-7 w-[120px] px-2.5 text-xs border border-amber-200 rounded-md bg-white shadow-none font-bold text-[#172554] focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus-visible:border-amber-400 focus-visible:ring-1 focus-visible:ring-amber-400">
                            <SelectValue placeholder="Select grade" />
                          </SelectTrigger>
                          <SelectContent>
                            {grades.map(g => (
                              <SelectItem key={g.id} value={g.code}>{g.code} - {g.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
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
                      className={cn(buttonVariants({ variant: "default" }), "h-9 px-4 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold disabled:opacity-50 disabled:pointer-events-none shrink-0 w-full lg:w-auto")}
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

                {activeHeats.length === 0 && (
                  <div className={cn("p-10 text-center text-[#94A3B8] text-sm italic bg-white rounded-xl border border-dashed transition-colors duration-500 ease-in-out", warmBorder)}>
                    No heats added yet for this furnace. Click &quot;Add Heat&quot; to create one.
                  </div>
                )}

                {/* Compact chip grid - one small box per heat, click shows its full card in the panel below */}
                <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5">
                  {activeHeats.map(heat => {
                    const heatPours = pours.filter(p => p.heatId === heat.id)
                    const totalWeight = heatPours.reduce((sum, p) => sum + (p.mouldsScheduled * p.mouldWeight), 0)
                    const isOverCapacity = totalWeight > maxCapacity
                    const isSelected = selectedHeat?.id === heat.id

                    return (
                      <button
                        key={heat.id}
                        onClick={() => { setDetailHeatId(heat.id); setAllocationHeatId(null); setAllocationSearch('') }}
                        className={cn(
                          "w-full text-left bg-white p-3 rounded-[12px] border shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:-translate-y-[2px] hover:shadow-[0_4px_14px_rgba(79,70,229,0.08)] transition-all duration-300 ease-out",
                          isOverCapacity ? "border-red-300 hover:border-red-400" : cn(warmBorder, "hover:border-amber-400"),
                          isSelected && "ring-2 ring-amber-300 border-amber-400"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <span className="font-mono font-bold text-xs text-[#172554] whitespace-nowrap truncate min-w-0">{heat.heatCode || `Heat ${heat.heatNumber}`}</span>
                          <span
                            title="Furnace's running heat count - never resets on its own (reset in Equipment Master)"
                            className="font-mono text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded shrink-0"
                          >
                            #{heat.sequenceNumber ?? heat.heatNumber}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] font-semibold text-[#64748B]">{heat.grade}</span>
                          {heat.isFirstHeat && (
                            <span className="text-[8px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 px-1 py-0.5 rounded shrink-0">First</span>
                          )}
                        </div>
                        {isOverCapacity && (
                          <div className="text-[9px] font-bold text-red-600 mt-1.5 flex items-center gap-0.5">
                            <WarningCircle weight="fill" className="w-2.5 h-2.5" /> Over
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Selected heat's full detail card, shown inline below the chip grid.
                    A soft, barely-tinted warm-cream surface (not the plain white the
                    chip grid and the rest of the page use) so it reads as a distinct
                    "detail" surface without the harsh, saturated block a full amber
                    fill would create. */}
                {selectedHeat && (
                  <div ref={detailCardRef} className={cn(
                    "bg-[#FFFDF8] rounded-xl border shadow-[0_8px_24px_-10px_rgba(180,130,40,0.25)] flex flex-col overflow-hidden transition-all",
                    selectedHeatOverCapacity ? "border-red-300 ring-1 ring-red-300" : "border-[#F0E2C4]"
                  )}>
                    {/* Heat Header - identity row */}
                    <div className={cn(
                      "px-4 py-3 border-b flex items-center gap-2.5 transition-colors duration-500 ease-in-out",
                      selectedHeatOverCapacity ? "bg-red-50 border-red-200" : "bg-gradient-to-r from-[#FBF3E2] to-[#FFFDF8] border-[#F0E2C4]"
                    )}>
                      <div className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                        selectedHeatOverCapacity ? "bg-red-100" : "bg-[#FBF3E2]"
                      )}>
                        <Fire weight="fill" className={cn("w-5 h-5", selectedHeatOverCapacity ? "text-red-500" : "text-amber-600")} />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-mono font-black text-base text-[#172554] leading-tight truncate">{selectedHeat.heatCode || `Heat ${selectedHeat.heatNumber}`}</span>
                        <span className="text-[11px] font-semibold text-[#64748B] truncate mt-0.5">{selectedHeat.grade}</span>
                      </div>
                      <label
                        title={`First heat of the day for this furnace runs ${getHeatDurationMins(equipments.find(e => e.id === selectedHeat.furnaceId), true)} min (furnace startup); only one heat per furnace can be marked first`}
                        className="flex items-center gap-1.5 shrink-0 cursor-pointer select-none bg-white border border-[#F0E2C4] rounded-lg px-2 py-1"
                      >
                        <input
                          type="checkbox"
                          checked={selectedHeat.isFirstHeat}
                          onChange={() => toggleFirstHeat(selectedHeat.id)}
                          className="h-3.5 w-3.5 accent-amber-600 cursor-pointer"
                        />
                        <span className="text-[10px] font-bold uppercase tracking-wide text-amber-800/80">First Heat</span>
                      </label>
                      <span
                        title="Furnace's running heat count - never resets on its own (reset in Equipment Master)"
                        className="font-mono text-[10px] font-bold text-amber-700/80 bg-[#FBF3E2] px-1.5 py-0.5 rounded shrink-0"
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
                    <div className="p-4 flex-1 flex flex-col gap-3 min-h-0">
                      {allocationHeatId === selectedHeat.id ? (
                        <div ref={allocationPanelRef} className="flex flex-col gap-3 flex-1 min-h-0">
                          {/* Allocation view header - swaps in for the pours list, same card, no overlay */}
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => { setAllocationHeatId(null); setAllocationSearch('') }}
                              className="flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-900 shrink-0"
                            >
                              <CaretLeft className="w-3.5 h-3.5" weight="bold" /> Back
                            </button>
                            <div className="h-4 w-px bg-[#F0E2C4] shrink-0" />
                            <h4 className="font-bold text-[#172554] text-sm flex items-center gap-1.5 min-w-0 truncate">
                              <Fire className="w-4 h-4 text-amber-500 shrink-0" /> Allocate to Heat {selectedHeat.heatNumber}
                            </h4>
                            <span className="text-[10px] text-[#94A3B8] shrink-0">Grade: <span className="font-bold text-amber-600">{selectedHeat.grade}</span> - only matching moulds shown</span>
                          </div>

                          {/* Live capacity bar */}
                          <div className="flex items-center gap-3 bg-[#F8FAFC] border border-[#E0E7FF] rounded-lg px-3 py-2 shrink-0">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8] shrink-0">Allocated</span>
                            <div className="flex-1 h-1.5 rounded-full bg-[#E2E8F0] overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-all", selectedHeatOverCapacity ? "bg-red-500" : "bg-emerald-500")}
                                style={{ width: `${Math.min(100, (selectedHeatWeight / (maxCapacity || 1)) * 100)}%` }}
                              />
                            </div>
                            <span className={cn("font-mono font-bold text-xs whitespace-nowrap shrink-0", selectedHeatOverCapacity ? "text-red-600" : "text-[#172554]")}>
                              {selectedHeatWeight.toFixed(1)} / {maxCapacity} kg
                            </span>
                          </div>

                          {/* Search */}
                          <div className="relative shrink-0">
                            <MagnifyingGlass className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <Input
                              value={allocationSearch}
                              onChange={e => setAllocationSearch(e.target.value)}
                              placeholder="Search products or orders..."
                              className="h-8 pl-8 text-xs"
                            />
                          </div>

                          {/* Table - full width of the card, no cramped popover box */}
                          <div className="flex-1 min-h-0 max-h-[360px] overflow-y-auto border border-[#E0E7FF] rounded-lg bg-white">
                            {allocationRows.length === 0 ? (
                              <div className="h-full min-h-[120px] flex items-center justify-center text-xs text-[#94A3B8] italic">
                                {(backlogByGrade.get(selectedHeat.grade) || []).length === 0
                                  ? `No pending moulds for grade ${selectedHeat.grade}.`
                                  : 'No products match your search.'}
                              </div>
                            ) : (
                              <Table className="table-fixed w-[890px] border-separate border-spacing-0">
                                <TableHeader className="sticky top-0 bg-[#F8FAFC] z-10">
                                  <TableRow>
                                    <TableHead className="w-[260px] text-center">Product</TableHead>
                                    <TableHead className="w-[105px] text-center">Order</TableHead>
                                    <TableHead className="w-[105px] text-center">Kg/Box</TableHead>
                                    <TableHead className="w-[105px] text-center" title="Total order backlog still left to melt, regardless of this heat's own space">Remaining</TableHead>
                                    <TableHead className="w-[105px] text-center" title="How many of those this heat can actually take right now">Max</TableHead>
                                    <TableHead className="w-[105px] text-center">Qty</TableHead>
                                    <TableHead className="w-[105px] text-center" />
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {allocationRows.map(({ b, boxWeight, maxAllowed, remainingMoulds }) => (
                                    <AllocationTableRow
                                      key={b.itemId}
                                      backlogItem={b}
                                      boxWeight={boxWeight}
                                      maxAllowed={maxAllowed}
                                      remainingMoulds={remainingMoulds}
                                      onAdd={(qty) => addPour(selectedHeat.id, b, qty)}
                                    />
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </div>
                        </div>
                      ) : (
                        <>
                          {selectedHeatPours.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center text-[#94A3B8] text-sm italic py-4">
                              No moulds allocated to this heat yet.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {selectedHeatPours.map(pour => (
                                <div key={pour.id} className={cn("group flex items-center justify-between p-2.5 rounded-lg border transition-colors duration-500 ease-in-out", warmBg, warmBorder)}>
                                  <div className="flex flex-col gap-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-sm text-[#172554] truncate">{pour.patternRef}</span>
                                      <span className="text-[9px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">{pour.grade}</span>
                                    </div>
                                    <span className="text-[10px] text-[#94A3B8]">{pour.orderNo} · {pour.mouldWeight} kg/mould</span>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className="font-mono font-bold text-amber-600 text-sm">{pour.mouldsScheduled} <span className="font-normal text-[#94A3B8] text-xs">moulds</span></span>
                                    <Button variant="ghost" size="icon" onClick={() => removePour(pour.id)} className="h-6 w-6 text-[#CBD5E1] opacity-0 group-hover:opacity-100 hover:text-red-600 hover:bg-red-50 transition-all">
                                      <Trash className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <Button
                            variant="outline"
                            onClick={() => { setAllocationHeatId(selectedHeat.id); setAllocationSearch(''); scrollToAllocationNext.current = true }}
                            className="w-full mt-auto border-dashed border-amber-300 text-amber-600 hover:bg-amber-50 hover:text-amber-700 font-semibold h-9"
                          >
                            <Plus className="w-4 h-4 mr-2" /> Add Pouring Allocation
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className={cn("m-0 p-5 border-t bg-[#FFFFFF] shrink-0 sm:justify-end rounded-b-2xl transition-colors duration-500 ease-in-out", warmBorder)}>
            <Button variant="ghost" onClick={onClose} className="text-[#64748B] hover:text-[#172554] hover:bg-[#F8FAFC]">Cancel</Button>
            <Button variant="outline" onClick={handleSaveAndRefresh} className="border-amber-500 text-amber-600 hover:bg-amber-50 h-10 px-6 text-sm font-bold">Save & Refresh</Button>
            <Button onClick={handleSave} className="bg-amber-500 text-white hover:bg-amber-600 shadow-md h-10 px-8 text-sm font-bold">Save Day Plan</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
    <CapacityErrorDialog lines={capacityErrorLines} onClose={() => setCapacityErrorLines(null)} />
    </>
  )
}

function AllocationTableRow({ backlogItem, boxWeight, maxAllowed, remainingMoulds, onAdd }: { backlogItem: BacklogItem, boxWeight: number, maxAllowed: number, remainingMoulds: number, onAdd: (qty: number) => void }) {
  const [qty, setQty] = useState<string>('')
  const parsedQty = parseInt(qty, 10)
  const isValid = !isNaN(parsedQty) && parsedQty > 0 && parsedQty <= maxAllowed

  const handleAdd = () => {
    if (isValid) onAdd(parsedQty)
  }

  return (
    <TableRow>
      <TableCell className="w-[260px] text-center font-bold text-[#172554]">{backlogItem.productName || backlogItem.patternRef}</TableCell>
      <TableCell className="w-[105px] text-center tabular-nums text-[#64748B] text-xs">{backlogItem.orderNo}</TableCell>
      <TableCell className="w-[105px] text-center tabular-nums font-mono text-xs">{boxWeight}</TableCell>
      <TableCell className="w-[105px] text-center tabular-nums font-mono text-xs text-[#64748B]">{remainingMoulds}</TableCell>
      <TableCell className="w-[105px] text-center tabular-nums font-mono text-xs font-bold text-amber-600">{maxAllowed}</TableCell>
      <TableCell className="w-[105px] text-center">
        <Input
          type="number"
          min="1"
          max={maxAllowed}
          value={qty}
          onChange={e => setQty(e.target.value)}
          placeholder="Qty"
          className="h-9 w-16 mx-auto text-center text-xs font-mono rounded-md focus-visible:ring-1 focus-visible:ring-amber-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </TableCell>
      <TableCell className="w-[105px] text-center">
        <Button size="sm" onClick={handleAdd} disabled={!qty || !isValid} className="h-9 w-20 bg-[#172554] hover:bg-[#1E293B] text-white text-xs rounded-md">
          Add
        </Button>
      </TableCell>
    </TableRow>
  )
}
