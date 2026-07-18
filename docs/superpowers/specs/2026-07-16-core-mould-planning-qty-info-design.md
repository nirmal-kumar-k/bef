# Core/Mould Planning: Quantity Info, No-Edit Save Block, Live Capacity Warning, Actual Removal

## Context

`CorePlanningModal` and `MouldPlanningModal` (`src/modules/production/presentation/core-planning-modal.tsx` and `mould-planning-modal.tsx`) let a planner assign backlog quantity into per-hour schedule slots for a machine. Both currently:

- Let "Save Day Plan" be clicked with zero changes from what was loaded.
- Only check machine capacity at Save time (via `CapacityErrorDialog`), not while editing.
- Show a "Pending Qty" column (freely-typed target) plus a separate small "QTY: 345" possible-quantity readout under the row's name.
- Include an "End of Day - Actual Entry" card (Planned / Actual / Variance) below the schedule table.

`totalScheduled` on each backlog item (computed in `src/app/production-planning/page.tsx`) is already the sum of `quantityScheduled` across **all** dated plans for that item/stage — so backlog carry-forward to the next day, and its automatic re-distribution into hourly slots on add, already work correctly today. This design does not change that mechanism.

## Goals

1. Block saving when nothing has changed since the modal opened.
2. Warn immediately (not just at Save) when a row's hourly-assigned total crosses above what the machine can produce.
3. Remove the Actual-entry card and all `actualQuantity`/`hourlyActuals` handling from both modals.
4. Replace the "Pending Qty" column with a "Quantity Info" column showing two editable fields: **PQ** (Possible Quantity, display-only capacity reference) and **TQ** (Total Quantity, the existing freely-typed target renamed), neatly spaced.
5. Clean up the one dead `actualQuantity` reference left in `core-planning-tab.tsx`'s calendar carry-forward calculation.

## Data model changes

In `PlannedRow` (both modal files):

- Remove: `hourlyActuals`, `actualQuantity`.
- Rename: `targetQty` → `totalQty` (same type/semantics — freely editable string, still the input that drives the "+N unscheduled / -N over" mismatch label against the hourly-slot sum).
- Add: `possibleQtyText: string` — seeded on row creation/load from the computed value (`Math.round(avgPiecesPerHour × shiftHours)`), then freely editable text from then on. Sent as `possibleQuantity` in the save payload (parsed as int; falls back to the computed value if empty/invalid). **Not** used for capacity validation — that always uses the live equipment-computed number, never this field.

`handleActualChange` is deleted. Save payload drops `hourlyActuals`/`actualQuantity` entirely.

## "Quantity Info" column

Header renamed from "Pending Qty" to "Quantity Info". Column width increases from `w-[68px]` to `w-[120px]` to fit two labeled inputs. Layout inside the cell (top to bottom):

- PQ row: small "PQ" label chip + input bound to `possibleQtyText`.
- TQ row: small "TQ" label chip + input bound to `totalQty` (same onChange behavior as today's Pending Qty input).
- Mismatch label (unchanged logic, now compares `totalQty` vs hourly sum).
- Magic-wand auto-fill button (unchanged — fills hourly slots from `totalQty`, capped at capacity; stays a separate action, not triggered by typing into TQ, per earlier decision).

The green "QTY: 345" line under the box/pattern name in the first column is removed (PQ now shown once, in Quantity Info).

## No-edit Save block

On modal open (existing `useEffect` that builds `initRows`), also capture a snapshot: `{ shiftId: selectedShiftId, rows: initRows.map(...) }` restricted to the fields that matter for saving (`machineId`, `coreBoxCode`/`patternRef`, `totalQty`, `hourlyTargets`, `hourlyWorkers`, `possibleQtyText`), stored in a `useRef`.

A `useMemo`-derived `isDirty` boolean deep-compares (`JSON.stringify`) the current `plannedRows` (same field subset) + `selectedShiftId` against that snapshot. The Save button gets `disabled={!isDirty}`. Switching the active machine tab or toggling the Labourers switch does not affect the snapshot/comparison, so it never counts as a change. Adding, removing, or editing a row (including PQ/TQ/hourly cells) does.

## Live over-capacity warning

Extract the existing possible-quantity calculation (currently inlined in `rowMeta` / `handleSave`) into a small helper, e.g. `computePossibleQty(machineId)`, used by both the table render and this check.

In `handleHourlyChange`, after computing the row's new hourly total: if the **previous** total was ≤ the row's possible qty and the **new** total is now `>`, call `setCapacityErrorLines([...])` immediately with a one-line message (same style as the existing Save-time message, e.g. `"${row.coreBoxCode}: ${newTotal} scheduled, max ${possibleQty}"`). This only fires on the crossing, not on every keystroke while already over, so repeated edits while still over the limit don't re-open the dialog. The edit itself is not blocked — the value is still applied to state. Save's existing hard block (already present, unchanged) remains the authoritative gate.

## Removing the Actual section

Delete the entire "End of Day - Actual Entry" card block (JSX) from both modal files, along with `handleActualChange`. Nothing replaces it in the modal body — the existing top metrics bar (Beginning of Day / Day Production / End of Day) already communicates completed-vs-pending.

## `core-planning-tab.tsx` cleanup

The calendar view's carry-forward calculation currently does:

```ts
const carryForwardAmount = prevDayPlans.reduce((s, p) => {
  const shortfall = p.actualQuantity !== undefined
    ? Math.max(0, p.quantityScheduled - p.actualQuantity)
    : p.quantityScheduled
  return s + shortfall
}, 0)
```

Since Core plans will never carry `actualQuantity` again, this simplifies to:

```ts
const carryForwardAmount = prevDayPlans.reduce((s, p) => s + p.quantityScheduled, 0)
```

(`mould-planning-tab.tsx` has no equivalent `actualQuantity` reference, so no change needed there.)

## Out of scope

- Melt and Knockout planning modals/tabs keep their own Actual-entry flows untouched (Knockout's confirm workflow actively depends on `actualQuantity`/`isConfirmed`).
- `isConfirmed` stays as a passthrough field on Core/Mould rows (not surfaced in either modal's UI today, unrelated to the Actual-entry removal).
- No backend/schema changes — `possibleQuantity`, `hourlyTargets`, `hourlyWorkers` fields already exist on the plan record; `hourlyActuals`/`actualQuantity` simply stop being written going forward for Core/Mould.
