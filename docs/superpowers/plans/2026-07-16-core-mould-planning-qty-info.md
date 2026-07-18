# Core/Mould Planning: Quantity Info, No-Edit Save Block, Live Capacity Warning, Actual Removal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework `CorePlanningModal` and `MouldPlanningModal` so Save is blocked until something actually changes, over-capacity edits warn immediately, the Actual-entry card is gone, and the old "Pending Qty" column becomes a "Quantity Info" column with two neatly-spaced editable fields: PQ (display-only possible quantity) and TQ (the renamed, still-authoritative target quantity).

**Architecture:** Both modals are structurally near-identical client components (`useState`/`useMemo` React, Tailwind, shadcn-style UI primitives from `@/shared/ui/*`). No backend/schema changes. No test framework exists in this repo (`package.json` has no test script) — verification is TypeScript build/lint plus manual click-through in the running dev server, in place of unit tests.

**Tech Stack:** Next.js (App Router), React, TypeScript, Tailwind CSS, `@phosphor-icons/react`.

## Global Constraints

- No backend/API/schema changes — only the two modal components and one tab component change.
- `possibleQtyText`/PQ is display-only: it is saved as `possibleQuantity` in the payload but must never be used for the over-capacity validation (live or at Save) — validation always uses the live equipment-computed value (`avgPiecesPerHour × shift hours`).
- Melt and Knockout planning modals/tabs are out of scope — do not touch `melt-planning-modal.tsx`, `melt-planning-tab.tsx`, `knockout-planning-modal.tsx`, `knockout-planning-tab.tsx`, `knockout-confirm-modal.tsx`.
- `isConfirmed` stays as-is (untouched passthrough field) on both modals — it is unrelated to this change.
- Run `npx tsc --noEmit` (or `npm run build`) after each task and confirm no new TypeScript errors before committing.

---

### Task 1: Core Planning Modal — data model, dirty-check, live capacity warning, Quantity Info column, remove Actual section

**Files:**
- Modify: `src/modules/production/presentation/core-planning-modal.tsx`

**Interfaces:**
- Produces: `PlannedRow` shape used going forward — `{ id, planId?, orderId, orderNo, productName, patternRef, coreBoxCode, machineId, totalQty: string, possibleQtyText: string, hourlyTargets: Record<string, number>, hourlyWorkers: Record<string, number>, isConfirmed: boolean, originalQty: number }` (no `targetQty`, `hourlyActuals`, `actualQuantity`).
- Produces: `computePossibleQty(machineId: string): number` — module-internal helper used by both rendering and the live-capacity check.

- [ ] **Step 1: Update the `PlannedRow` interface and imports**

Read the current interface (lines 34-53) and imports (line 1). Replace:

```ts
import { useState, useEffect, useMemo } from 'react'
```
with:
```ts
import { useState, useEffect, useMemo, useRef } from 'react'
```

Replace the `PlannedRow` interface:
```ts
interface PlannedRow {
  id: string
  planId?: string
  orderId: string
  orderNo: string
  productName: string
  patternRef: string
  coreBoxCode: string
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
```
with:
```ts
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
```

- [ ] **Step 2: Add `computePossibleQty` helper and dirty-snapshot ref, inside the component**

Directly below the `[capacityErrorLines, setCapacityErrorLines]` state (after line 79), add:
```ts
  // Snapshot of the fields that matter for saving, captured once when the
  // modal's rows are (re)initialized - compared against current state to
  // gate the Save button until something actually changes.
  const initialSnapshotRef = useRef<string>('')
```

Directly above the `handleSave` function (before line 264), add:
```ts
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
```

- [ ] **Step 3: Update the init effect to seed `totalQty`/`possibleQtyText` and capture the dirty snapshot**

Replace the init effect (lines 200-225):
```ts
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
```
with:
```ts
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
      initialSnapshotRef.current = JSON.stringify(initRows.map(toSnapshotRow))
    }
  }, [isOpen, dailyPlans, openOrders])
```

- [ ] **Step 4: Skip typecheck for now — this file still has other `targetQty`/`hourlyActuals`/`actualQuantity` references**

`tsc` will report errors until Steps 5-12 finish removing every remaining reference to the old field names. Do not run it yet; continue straight through to Step 12, then typecheck in Step 13. (Note: `toSnapshotRow` from Step 2 is declared further down in the file, before `handleSave`, which is fine — the `useEffect` in Step 3 only *calls* `toSnapshotRow` when it runs post-render, by which point the whole component body, including Step 2's declaration, has already executed once. There's no ordering hazard here.)

- [ ] **Step 5: Rewrite `handleSave` to drop Actual fields and use `possibleQtyText`**

Replace lines 264-329 (the full `handleSave` function) with:
```ts
  const handleSave = () => {
    // Block the save entirely if any row's actual hourly-scheduled total
    // exceeds what this machine can physically produce this shift - allocating
    // more than the machine's capacity would silently record output that
    // never happened, wiping backlog that should have carried to the next day.
    const overCapacityRows = plannedRows.map(r => {
      const scheduledSum = Object.values(r.hourlyTargets).reduce((s, v) => s + (v || 0), 0)
      const possibleQty = computePossibleQty(r.machineId)
      return { r, scheduledSum, possibleQty }
    }).filter(({ scheduledSum, possibleQty }) => scheduledSum > possibleQty)

    if (overCapacityRows.length > 0) {
      setCapacityErrorLines(overCapacityRows.map(({ r, scheduledSum, possibleQty }) => `${r.coreBoxCode}: ${scheduledSum} scheduled, max ${possibleQty}`))
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

    onSaveDayPlan(date, plansToSave)
    onClose()
  }
```

- [ ] **Step 6: Rename `handleTargetQtyInput` to `handleTotalQtyInput` and add `handlePossibleQtyInput`**

Replace lines 331-341:
```ts
  // Value change only - freely editable, not capped to the pending backlog
  // quantity, so users can schedule ahead or correct a miscount when needed.
  const handleTargetQtyInput = (rowId: string, value: string) => {
    setPlannedRows(prev => prev.map(r => {
      if (r.id !== rowId) return r
      if (value === '') return { ...r, targetQty: value }
      const num = parseInt(value, 10)
      if (isNaN(num)) return { ...r, targetQty: value }
      return { ...r, targetQty: String(Math.max(0, num)) }
    }))
  }
```
with:
```ts
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

  // Display-only PQ text - never clamped/validated against machine capacity,
  // since it does not feed the over-capacity check.
  const handlePossibleQtyInput = (rowId: string, value: string) => {
    setPlannedRows(prev => prev.map(r => {
      if (r.id !== rowId) return r
      if (value === '') return { ...r, possibleQtyText: value }
      const num = parseInt(value, 10)
      if (isNaN(num)) return { ...r, possibleQtyText: value }
      return { ...r, possibleQtyText: String(Math.max(0, num)) }
    }))
  }
```

- [ ] **Step 7: Delete `handleActualChange` and add the live over-capacity check to `handleHourlyChange`**

Replace lines 399-416:
```ts
  const handleActualChange = (rowId: string, value: string) => {
    const num = value === '' ? undefined : parseInt(value, 10)
    setPlannedRows(prev => prev.map(r => r.id === rowId ? { ...r, actualQuantity: num } : r))
  }

  // Editing an hourly cell no longer re-syncs Pending Qty to match - the two
  // are tracked independently now, so the mismatch indicator on Pending Qty
  // fires whichever side you edit, instead of always being satisfied because
  // the other side silently followed along.
  const handleHourlyChange = (rowId: string, timeSlot: string, value: string) => {
    const num = value === '' ? undefined : parseInt(value, 10)
    setPlannedRows(prev => prev.map(r => {
      if (r.id !== rowId) return r
      const newValue = Math.max(0, num || 0)
      const newTargets = { ...r.hourlyTargets, [timeSlot]: newValue }
      return { ...r, hourlyTargets: newTargets }
    }))
  }
```
with:
```ts
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

      // Live over-capacity warning: fire only on the crossing (previous
      // total within capacity, new total over it), not on every keystroke
      // made while already over - Save's own hard block stays authoritative.
      const prevTotal = Object.values(r.hourlyTargets).reduce((s, v) => s + (v || 0), 0)
      const newTotal = Object.values(newTargets).reduce((s, v) => s + (v || 0), 0)
      const possibleQty = computePossibleQty(r.machineId)
      if (prevTotal <= possibleQty && newTotal > possibleQty) {
        setCapacityErrorLines([`${r.coreBoxCode}: ${newTotal} scheduled, max ${possibleQty}`])
      }

      return { ...r, hourlyTargets: newTargets }
    }))
  }
```

- [ ] **Step 8: Fix `autoFillRow` and `addCoreBoxToMachine` to use `totalQty`/`possibleQtyText`**

In `autoFillRow` (around line 391), replace:
```ts
      const target = parseInt(row.targetQty, 10)
```
with:
```ts
      const target = parseInt(row.totalQty, 10)
```

In `addCoreBoxToMachine` (lines 427-459), replace:
```ts
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
        targetQty: remaining > 0 ? String(remaining) : '',
        hourlyTargets,
        hourlyWorkers,
        hourlyActuals: {},
        isConfirmed: false,
        originalQty: 0
      }]
    })
```
with:
```ts
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
```

- [ ] **Step 9: Simplify `rowMeta` to reuse `computePossibleQty`**

Replace lines 492-501:
```ts
  // Per-row derived metrics, shared between the column header and the blocking check below
  const rowMeta = useMemo(() => {
    const shiftHours = TIME_SLOTS.reduce((acc, sl) => acc + sl.hours, 0)
    return activeRows.map(row => {
      const eq = equipments.find(e => e.id === row.machineId)
      const avgProd = resolveAvgProductionRate(undefined, eq?.avgPiecesPerHour)
      const possibleQty = Math.round(avgProd * shiftHours)
      return { row, possibleQty }
    })
  }, [activeRows, equipments, TIME_SLOTS])
```
with:
```ts
  // Per-row derived metrics, shared between the column header and the blocking check below
  const rowMeta = useMemo(() => {
    return activeRows.map(row => ({ row, possibleQty: computePossibleQty(row.machineId) }))
  }, [activeRows, equipments, TIME_SLOTS])
```

- [ ] **Step 10: Replace the Quantity Info column (header + cell)**

Replace the table header cell (line 674):
```tsx
                          <th className={cn("px-1.5 py-3 text-center border-x w-[68px] transition-colors duration-500 ease-in-out", theme.tableBorder)}>Pending Qty</th>
```
with:
```tsx
                          <th className={cn("px-1.5 py-3 text-center border-x w-[120px] transition-colors duration-500 ease-in-out", theme.tableBorder)}>Quantity Info</th>
```

Replace the first-column "QTY:" line (line 704):
```tsx
                                <span className="text-[10px] text-[#10B981] font-semibold">QTY: {possibleQty}</span>
```
with nothing (delete the line entirely, keeping the surrounding `<div className="flex flex-col gap-0.5">...</div>` structure intact around the remaining two lines).

Replace the Quantity Info `<td>` (lines 707-737):
```tsx
                            <td className={cn("px-1.5 py-3 text-center border-x transition-colors duration-500 ease-in-out", theme.pendingQtyCell)}>
                              <div className="flex flex-col items-center justify-center gap-1">
                                <Input
                                  type="number"
                                  min="0"
                                  value={row.targetQty}
                                  onChange={e => handleTargetQtyInput(row.id, e.target.value)}
                                  placeholder="0"
                                  title={isMismatched ? (delta > 0 ? `${delta} not yet scheduled to a time slot` : `${-delta} more scheduled than the pending qty`) : undefined}
                                  className={cn(
                                    "w-full max-w-[56px] mx-auto h-8 font-mono text-center font-bold text-sm px-1 transition-colors duration-500 ease-in-out focus-visible:ring-1",
                                    isMismatched ? theme.mismatch : theme.pendingQtyDefault,
                                    !isMismatched && theme.pendingQtyRing
                                  )}
                                />
                                {isMismatched && (
                                  <span className={cn("text-[9px] font-bold leading-none whitespace-nowrap transition-colors duration-500 ease-in-out", theme.mismatchLabel)}>
                                    {delta > 0 ? `+${delta} unscheduled` : `${-delta} over`}
                                  </span>
                                )}
                                <Button
                                  onClick={() => autoFillRow(row.id)}
                                  size="icon"
                                  variant="outline"
                                  title="Auto-fill time slots"
                                  className={cn("h-6 w-full max-w-[56px] shrink-0 transition-colors duration-500 ease-in-out", theme.autoFillButton)}
                                >
                                  <MagicWand weight="fill" className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
```
with:
```tsx
                            <td className={cn("px-2 py-3 text-center border-x transition-colors duration-500 ease-in-out", theme.pendingQtyCell)}>
                              <div className="flex flex-col items-stretch justify-center gap-1.5 w-full max-w-[100px] mx-auto">
                                <div className="flex items-center gap-1">
                                  <span className={cn("text-[9px] font-bold w-5 shrink-0 text-left transition-colors duration-500 ease-in-out", theme.rowMuted)}>PQ</span>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={row.possibleQtyText}
                                    onChange={e => handlePossibleQtyInput(row.id, e.target.value)}
                                    placeholder="0"
                                    title="Possible quantity (display only, not enforced)"
                                    className={cn("flex-1 h-7 font-mono text-center font-semibold text-xs px-1 transition-colors duration-500 ease-in-out", theme.pendingQtyDefault)}
                                  />
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className={cn("text-[9px] font-bold w-5 shrink-0 text-left transition-colors duration-500 ease-in-out", theme.rowMuted)}>TQ</span>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={row.totalQty}
                                    onChange={e => handleTotalQtyInput(row.id, e.target.value)}
                                    placeholder="0"
                                    title={isMismatched ? (delta > 0 ? `${delta} not yet scheduled to a time slot` : `${-delta} more scheduled than the total qty`) : undefined}
                                    className={cn(
                                      "flex-1 h-7 font-mono text-center font-bold text-xs px-1 transition-colors duration-500 ease-in-out focus-visible:ring-1",
                                      isMismatched ? theme.mismatch : theme.pendingQtyDefault,
                                      !isMismatched && theme.pendingQtyRing
                                    )}
                                  />
                                </div>
                                {isMismatched && (
                                  <span className={cn("text-[9px] font-bold leading-none whitespace-nowrap text-center transition-colors duration-500 ease-in-out", theme.mismatchLabel)}>
                                    {delta > 0 ? `+${delta} unscheduled` : `${-delta} over`}
                                  </span>
                                )}
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
                            </td>
```

- [ ] **Step 11: Delete the "End of Day - Actual Entry" card**

Delete the entire block (lines 790-849, from `<div className={cn("border rounded-xl overflow-hidden mt-8...` through its closing `</div>` right before the `</>` that closes the `activeMachineId` conditional). The JSX block to remove starts with:
```tsx
              <div className={cn("border rounded-xl overflow-hidden mt-8 transition-colors duration-500 ease-in-out", theme.tableBorder)}>
                <div className={cn("w-full flex items-center justify-between p-4 transition-colors duration-500 ease-in-out", isNightShift ? "bg-orange-100 text-stone-800" : "bg-[#EEF2FF] text-[#172554]")}>
```
and ends with the matching closing `</div>` immediately followed by `</>` in the source. Remove the whole block; leave the `</>` and everything after it untouched.

- [ ] **Step 12: Wire the dirty check into the Save button**

Replace line 856:
```tsx
            <Button onClick={handleSave} className={cn("shadow-[0_4px_10px_-2px_rgba(79,70,229,0.3)] h-10 px-8 text-sm transition-colors duration-500 ease-in-out", isNightShift ? "bg-orange-500 text-white hover:bg-orange-500/90" : "bg-[#4F46E5] text-white hover:bg-[#4F46E5]/90")}>Save Day Plan</Button>
```
with:
```tsx
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
```

- [ ] **Step 13: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `core-planning-modal.tsx` (unrelated pre-existing errors elsewhere, if any, are not this task's concern — only confirm none are newly introduced in this file).

- [ ] **Step 14: Manual verification in the browser**

Run: `npm run dev` (if not already running), open the Production Planning page, open Core Planning for any day.
Verify:
- "Save Day Plan" is disabled on open with no edits; typing into any TQ/PQ/hourly cell enables it.
- Editing an hourly cell past the machine's possible quantity pops the capacity-error dialog immediately (not just at Save).
- The column header reads "Quantity Info" with PQ above TQ, both editable, neatly spaced; no separate "QTY: n" text remains under the core box name.
- No "End of Day - Actual Entry" card appears below the schedule table.
- Saving with valid, in-capacity edits still works and closes the modal.

- [ ] **Step 15: Commit**

```bash
git add src/modules/production/presentation/core-planning-modal.tsx
git commit -m "Rework Core Planning modal: Quantity Info (PQ/TQ), dirty-gated save, live capacity warning, remove Actual entry"
```

---

### Task 2: Mould Planning Modal — mirror Task 1

**Files:**
- Modify: `src/modules/production/presentation/mould-planning-modal.tsx`

**Interfaces:**
- Consumes: same pattern as Task 1, applied to `MouldPlanningModal`'s `PlannedRow` (which has `patternRef` instead of `coreBoxCode`, and no `restrictedCoreBoxes`/`mappedCoreBoxes` filtering).
- Produces: same `computePossibleQty`/`toSnapshotRow`/`isDirty` names, so any future shared extraction between the two modals is trivial.

This file is structurally identical to `core-planning-modal.tsx` for every concern this plan touches, with these differences to account for:
- No `coreBoxCode` field — use `patternRef` in messages/keys instead (e.g. capacity-error lines read `${r.patternRef}: ...` — this already matches today's `handleSave` in this file).
- The "Add Pattern to Schedule" popover trigger uses `buttonVariants()` directly rather than a `render` prop — do not change that structural difference.
- The table has a trailing "Del" column (trash icon) instead of an inline trash icon in the details column — leave that column untouched.
- `equipments` fetch effect also sets `activeMachineId` to the first machine — leave untouched.

- [ ] **Step 1: Update imports and `PlannedRow` interface**

Replace:
```ts
import { useState, useEffect, useMemo } from 'react'
```
with:
```ts
import { useState, useEffect, useMemo, useRef } from 'react'
```

Replace the `PlannedRow` interface (lines 34-52):
```ts
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
```
with:
```ts
interface PlannedRow {
  id: string
  planId?: string
  orderId: string
  orderNo: string
  productName: string
  patternRef: string
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
```

- [ ] **Step 2: Add `computePossibleQty`, `toSnapshotRow`, `isDirty`, and the dirty-snapshot ref**

Directly below the `[capacityErrorLines, setCapacityErrorLines]` state (after line 78), add:
```ts
  // Snapshot of the fields that matter for saving, captured once when the
  // modal's rows are (re)initialized - compared against current state to
  // gate the Save button until something actually changes.
  const initialSnapshotRef = useRef<string>('')
```

Directly above `handleSave` (before line 258), add:
```ts
  // Fields whose values determine what actually gets saved - used both for
  // the dirty snapshot and its live comparison.
  const toSnapshotRow = (r: PlannedRow) => ({
    machineId: r.machineId,
    patternRef: r.patternRef,
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
```

- [ ] **Step 3: Update the init effect**

Replace lines 195-219:
```ts
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
```
with:
```ts
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
          totalQty: p.quantityScheduled ? String(p.quantityScheduled) : '',
          possibleQtyText: p.possibleQuantity !== undefined ? String(p.possibleQuantity) : '',
          hourlyTargets: p.hourlyTargets || {},
          hourlyWorkers: p.hourlyWorkers || {},
          isConfirmed: !!p.isConfirmed,
          originalQty: p.quantityScheduled || 0
        }
      })
      setPlannedRows(initRows)
      initialSnapshotRef.current = JSON.stringify(initRows.map(toSnapshotRow))
    }
  }, [isOpen, dailyPlans, openOrders])
```

- [ ] **Step 4: Rewrite `handleSave`**

Replace lines 258-322 with the same body as Task 1 Step 5, adjusted for this file's fields (`patternRef` instead of `coreBoxCode`, `stage: 'Mould'`, no `coreBoxCode` field in the payload):
```ts
  const handleSave = () => {
    // Block the save entirely if any row's actual hourly-scheduled total
    // exceeds what this machine can physically produce this shift - allocating
    // more than the machine's capacity would silently record output that
    // never happened, wiping backlog that should have carried to the next day.
    const overCapacityRows = plannedRows.map(r => {
      const scheduledSum = Object.values(r.hourlyTargets).reduce((s, v) => s + (v || 0), 0)
      const possibleQty = computePossibleQty(r.machineId)
      return { r, scheduledSum, possibleQty }
    }).filter(({ scheduledSum, possibleQty }) => scheduledSum > possibleQty)

    if (overCapacityRows.length > 0) {
      setCapacityErrorLines(overCapacityRows.map(({ r, scheduledSum, possibleQty }) => `${r.patternRef}: ${scheduledSum} scheduled, max ${possibleQty}`))
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
        isConfirmed: r.isConfirmed,
        possibleQuantity: possibleQtyToSave
      }
    })

    onSaveDayPlan(date, plansToSave)
    onClose()
  }
```

- [ ] **Step 5: Rename `handleTargetQtyInput`, add `handlePossibleQtyInput`**

Same replacement as Task 1 Step 6 (lines 324-334 in this file), renaming to `handleTotalQtyInput` and adding `handlePossibleQtyInput` with identical bodies (operating on `r.totalQty` / `r.possibleQtyText`).

- [ ] **Step 6: Delete `handleActualChange`, add live capacity check to `handleHourlyChange`**

Replace lines 391-407 with the same replacement as Task 1 Step 7 (identical body — this file's `handleHourlyChange` is byte-for-byte the same as Core's before this change, using `r.coreBoxCode` → note: this file has no `coreBoxCode`, so the warning message must use `r.patternRef` instead):
```ts
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

      // Live over-capacity warning: fire only on the crossing (previous
      // total within capacity, new total over it), not on every keystroke
      // made while already over - Save's own hard block stays authoritative.
      const prevTotal = Object.values(r.hourlyTargets).reduce((s, v) => s + (v || 0), 0)
      const newTotal = Object.values(newTargets).reduce((s, v) => s + (v || 0), 0)
      const possibleQty = computePossibleQty(r.machineId)
      if (prevTotal <= possibleQty && newTotal > possibleQty) {
        setCapacityErrorLines([`${r.patternRef}: ${newTotal} scheduled, max ${possibleQty}`])
      }

      return { ...r, hourlyTargets: newTargets }
    }))
  }
```
(Delete `handleActualChange` entirely — it directly precedes this function in the file.)

- [ ] **Step 7: Fix `autoFillRow` and `addPatternToMachine`**

In `autoFillRow`, replace `const target = parseInt(row.targetQty, 10)` with `const target = parseInt(row.totalQty, 10)`.

In `addPatternToMachine` (lines 418-448), replace:
```ts
    setPlannedRows(prev => {
      const { hourlyTargets, hourlyWorkers } = remaining > 0
        ? distributeQty(remaining, activeMachineId, undefined, prev)
        : { hourlyTargets: {}, hourlyWorkers: {} }

      return [...prev, {
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
      }]
    })
```
with:
```ts
    setPlannedRows(prev => {
      const { hourlyTargets, hourlyWorkers } = remaining > 0
        ? distributeQty(remaining, activeMachineId, undefined, prev)
        : { hourlyTargets: {}, hourlyWorkers: {} }

      return [...prev, {
        id: Math.random().toString(),
        orderId: order?.id || '',
        orderNo: orderNo,
        productName: order?.productName || '',
        patternRef: patternRef,
        machineId: activeMachineId,
        totalQty: remaining > 0 ? String(remaining) : '',
        possibleQtyText: String(computePossibleQty(activeMachineId)),
        hourlyTargets,
        hourlyWorkers,
        isConfirmed: false,
        originalQty: 0
      }]
    })
```

- [ ] **Step 8: Replace the Quantity Info column**

Replace the header cell:
```tsx
                          <th className={cn("px-1.5 py-4 text-center border-x w-[68px] transition-colors duration-500 ease-in-out", theme.tableBorder)}>Pending Qty</th>
```
with:
```tsx
                          <th className={cn("px-1.5 py-4 text-center border-x w-[120px] transition-colors duration-500 ease-in-out", theme.tableBorder)}>Quantity Info</th>
```

Remove the possible-quantity readout from the first column (Pattern Details cell):
```tsx
                                  <span className="text-[10px] text-[#10B981] font-semibold tracking-wide">QTY: {possibleQty}</span>
```
Delete this line (keep the surrounding `<div className="flex flex-col gap-1">` and its other two lines).

Replace the Quantity Info `<td>`:
```tsx
                              <td className={cn("px-1.5 py-4 text-center border-x transition-colors duration-500 ease-in-out", theme.pendingQtyCell)}>
                                <div className="flex flex-col items-center justify-center gap-1">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={row.targetQty}
                                    onChange={e => handleTargetQtyInput(row.id, e.target.value)}
                                    placeholder="0"
                                    title={isMismatched ? (delta > 0 ? `${delta} not yet scheduled to a time slot` : `${-delta} more scheduled than the pending qty`) : undefined}
                                    className={cn(
                                      "w-full max-w-[56px] mx-auto h-8 font-mono text-center font-bold text-sm px-1 transition-colors duration-500 ease-in-out focus-visible:ring-1",
                                      isMismatched ? theme.mismatch : theme.pendingQtyDefault,
                                      !isMismatched && theme.pendingQtyRing
                                    )}
                                  />
                                  {isMismatched && (
                                    <span className={cn("text-[9px] font-bold leading-none whitespace-nowrap transition-colors duration-500 ease-in-out", theme.mismatchLabel)}>
                                      {delta > 0 ? `+${delta} unscheduled` : `${-delta} over`}
                                    </span>
                                  )}
                                  <Button
                                    onClick={() => autoFillRow(row.id)}
                                    size="icon"
                                    variant="outline"
                                    title="Auto-fill time slots"
                                    className={cn("h-6 w-full max-w-[56px] shrink-0 transition-colors duration-500 ease-in-out", theme.autoFillButton)}
                                  >
                                    <MagicWand weight="fill" className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </td>
```
with:
```tsx
                              <td className={cn("px-2 py-4 text-center border-x transition-colors duration-500 ease-in-out", theme.pendingQtyCell)}>
                                <div className="flex flex-col items-stretch justify-center gap-1.5 w-full max-w-[100px] mx-auto">
                                  <div className="flex items-center gap-1">
                                    <span className={cn("text-[9px] font-bold w-5 shrink-0 text-left transition-colors duration-500 ease-in-out", theme.rowMuted)}>PQ</span>
                                    <Input
                                      type="number"
                                      min="0"
                                      value={row.possibleQtyText}
                                      onChange={e => handlePossibleQtyInput(row.id, e.target.value)}
                                      placeholder="0"
                                      title="Possible quantity (display only, not enforced)"
                                      className={cn("flex-1 h-7 font-mono text-center font-semibold text-xs px-1 transition-colors duration-500 ease-in-out", theme.pendingQtyDefault)}
                                    />
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className={cn("text-[9px] font-bold w-5 shrink-0 text-left transition-colors duration-500 ease-in-out", theme.rowMuted)}>TQ</span>
                                    <Input
                                      type="number"
                                      min="0"
                                      value={row.totalQty}
                                      onChange={e => handleTotalQtyInput(row.id, e.target.value)}
                                      placeholder="0"
                                      title={isMismatched ? (delta > 0 ? `${delta} not yet scheduled to a time slot` : `${-delta} more scheduled than the total qty`) : undefined}
                                      className={cn(
                                        "flex-1 h-7 font-mono text-center font-bold text-xs px-1 transition-colors duration-500 ease-in-out focus-visible:ring-1",
                                        isMismatched ? theme.mismatch : theme.pendingQtyDefault,
                                        !isMismatched && theme.pendingQtyRing
                                      )}
                                    />
                                  </div>
                                  {isMismatched && (
                                    <span className={cn("text-[9px] font-bold leading-none whitespace-nowrap text-center transition-colors duration-500 ease-in-out", theme.mismatchLabel)}>
                                      {delta > 0 ? `+${delta} unscheduled` : `${-delta} over`}
                                    </span>
                                  )}
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
                              </td>
```

- [ ] **Step 9: Delete the "End of Day - Actual Entry" card**

Same as Task 1 Step 11 — delete the entire block starting at:
```tsx
              <div className={cn("border rounded-xl overflow-hidden mt-8 transition-colors duration-500 ease-in-out", theme.tableBorder)}>
                <div className={cn("w-full flex items-center justify-between p-4 transition-colors duration-500 ease-in-out", isNightShift ? "bg-orange-100 text-stone-800" : "bg-[#EEF2FF] text-[#172554]")}>
```
through its matching closing `</div>` right before `</>`.

- [ ] **Step 10: Wire the dirty check into the Save button**

Replace:
```tsx
            <Button onClick={handleSave} className={cn("shadow-[0_4px_10px_-2px_rgba(79,70,229,0.3)] h-10 px-8 text-sm transition-colors duration-500 ease-in-out", isNightShift ? "bg-orange-500 text-white hover:bg-orange-500/90" : "bg-[#4F46E5] text-white hover:bg-[#4F46E5]/90")}>Save Day Plan</Button>
```
with:
```tsx
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
```

- [ ] **Step 11: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors in `mould-planning-modal.tsx`.

- [ ] **Step 12: Manual verification in the browser**

Run: `npm run dev` (if not already running), open Mould Planning for any day. Verify the same checklist as Task 1 Step 14, substituting "pattern" for "core box".

- [ ] **Step 13: Commit**

```bash
git add src/modules/production/presentation/mould-planning-modal.tsx
git commit -m "Rework Mould Planning modal: Quantity Info (PQ/TQ), dirty-gated save, live capacity warning, remove Actual entry"
```

---

### Task 3: Clean up the dead `actualQuantity` reference in `core-planning-tab.tsx`

**Files:**
- Modify: `src/modules/production/presentation/core-planning-tab.tsx`

**Interfaces:**
- Consumes: nothing new — this is a same-behavior simplification now that `actualQuantity` will never be set on Core plans again.

- [ ] **Step 1: Simplify the carry-forward calculation**

Find (around line 174-182):
```ts
              // Before an actual is entered, preview the full scheduled amount as
              // at-risk (assume nothing's been produced yet); once an actual is
              // recorded, switch to the real shortfall (scheduled - actual).
              const carryForwardAmount = prevDayPlans.reduce((s, p) => {
                const shortfall = p.actualQuantity !== undefined
                  ? Math.max(0, p.quantityScheduled - p.actualQuantity)
                  : p.quantityScheduled
                return s + shortfall
              }, 0)
```
Replace with:
```ts
              // Core plans no longer carry an Actual entry - whatever was
              // scheduled into hourly slots is treated as completed, so any
              // remaining backlog carries forward as the full scheduled amount.
              const carryForwardAmount = prevDayPlans.reduce((s, p) => s + p.quantityScheduled, 0)
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors in `core-planning-tab.tsx`.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, open the Core Planning tab's calendar view, confirm a day with prior scheduled-but-not-fully-consumed backlog still shows a "carry forward" indicator on the next day's cell (same visual behavior as before, just no longer gated on a field that can't exist anymore).

- [ ] **Step 4: Commit**

```bash
git add src/modules/production/presentation/core-planning-tab.tsx
git commit -m "Simplify Core Planning carry-forward calc now that Actual entry is removed"
```
