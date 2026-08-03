# Production Tracking — Design Spec

Date: 2026-08-01
Status: Approved by user, pending implementation plan

## Problem

The app has two disconnected production-related systems:

1. **Production Planning** (`/production-planning`) — the tabbed Core/Mould/Melt/Pour/Knockout screen, backed by the `production_plans` table. This is the real, actively-maintained planning system.
2. **Production Tracking** (`/production`) — an older page backed by a completely separate `schedules`/`schedule_stages` table pair, with its own 9-stage model (core, melting, moulding, pouring, knockout, shotBlasting, grinding, inspection, readyForDispatch) that has no relationship to `production_plans`.

These two never agree with each other, and Tracking's data model doesn't match what Planning actually schedules. The goal is to rebuild Tracking as a real view over Planning's own data, and add actuals-entry with automatic shortfall carry-forward — the workflow a foundry floor actually needs (e.g. "120 was planned for this item today, only 60 got done because a machine broke down — the remaining 60 should show up as tomorrow's problem, flagged, without anyone re-typing it").

## Non-goals / explicit constraints

- **Production Planning is not modified in any way** — no changes to its pages, tabs, modals, or read/write behavior. Tracking only *reads* `production_plans`; all new writes (actuals, carry-forward rows) are additive, isolated to fields/rows Planning doesn't touch during normal planning work.
- **Inspection stage is out of scope.** It already has its own accepted/rejected actuals flow inside Production Planning and is untouched.
- **Overachievement (actual > planned) auto-adjustment is out of scope for this iteration.** Only logged as a positive variance; no auto-pulling-forward of future backlog. (A "pull forward and reduce future planned quantity" design was discussed and deferred — revisit as a separate spec later if wanted.)

## Architecture

### Retire the legacy schedule system entirely

- Drop `schedules` and `schedule_stages` tables (schema + migration).
- Delete `src/app/api/schedules/route.ts`, `src/app/api/schedules/[id]/route.ts`, `src/app/api/schedules/close-day/route.ts`, `src/app/api/schedules/_stage-helpers.ts`.
- Delete `src/modules/production/presentation/close-day-modal.tsx` and `src/modules/production/presentation/order-timeline-drawer.tsx` (both are schedules-specific; no replacement timeline feature is in scope here).
- Rebuild `src/app/production/page.tsx` from scratch as described below.

### Data model additions (all additive — no existing column removed or repurposed away from its current meaning)

- `production_plans.hourlyActuals` (already exists, currently unused anywhere) — becomes the hour-by-hour actual-output entry for Core/Mould/Knockout, mirroring the shape of the existing `hourlyTargets`.
- `production_plans.isPending` (already exists, currently unused as a real DB-driven flag) — set `true` on any row created as a carry-forward row.
- **New column** `production_plans.carriedForwardFromDate` (text, nullable) — the origin date, purely for display ("Carried forward from Jul 31").
- **New table** `production_day_closures`:
  ```
  date        text primary key   -- YYYY-MM-DD
  closedAt    timestamp not null default now()
  ```
  Marks a date as finalized so Close Day can't be double-run for it.
- Melt needs no schema changes — it already has `quantityScheduled`/`mouldsScheduled` (planned) and `actualQuantity`/`actualPouredMoulds` (actual) per heat-row.

## Production Tracking page (`/production`)

### Header / navigation

- Calendar/List toggle, same visual pattern as Planning's Summary tab.
- **Calendar view**: month grid, each day showing actual-vs-planned counts (`done / planned`) for Core, Mould, Melt, Knockout — sourced from `production_plans` (hourlyActuals sums for Core/Mould/Knockout; actualQuantity sums for Melt), not the "scheduled = completed" convention Planning's own calendar uses.
- **List view**: a single selected date, with the four stage tabs below.

### Stage tabs: Core, Mould, Melt, Knockout

For the selected date, each tab lists every `production_plans` row for that stage/date:

- All planning-sourced fields (order, item, pattern, planned quantity, shift, equipment) are **read-only** — this is a display of what Planning already scheduled, never editable here.
- Each row has an **"Enter Actuals"** button:
  - Core/Mould/Knockout → opens a hourly grid modal, one input per shift time-slot (matching `hourlyTargets`' own slot keys), writing to `hourlyActuals`. Slots left blank represent downtime (e.g. a breakdown) and are simply 0/unfilled — no separate "reason" field is required for this iteration.
  - Melt → opens the existing actual-quantity entry for that heat (`actualQuantity`/`actualPouredMoulds`), no new UI shape needed.
- Rows where `isPending = true` (i.e. carried-forward from a prior day's shortfall) are rendered with a **red** highlight and sorted to the **top** of the list, ahead of normal rows — so operators handle backlog first.

### Close Day

- A single **"Close Day"** button, scoped to the currently-viewed date.
- On click, for every `production_plans` row dated today across Core/Mould/Melt/Knockout:
  - Core/Mould/Knockout: `shortfall = sum(hourlyTargets values) - sum(hourlyActuals values)`.
  - Melt: `shortfall = quantityScheduled - actualQuantity` (per heat row).
  - If `shortfall > 0`: create a **new** `production_plans` row dated tomorrow, same `orderId`/`itemId`/`stage` (and `coreBoxCode` for Core where applicable), `quantityScheduled = shortfall`, `isPending = true`, `carriedForwardFromDate = today`. This is always a new, separate row — it is added on top of whatever tomorrow already has planned for that item, never merged into an existing row's quantity.
  - If `shortfall <= 0`: no action (overachievement is out of scope, per Non-goals).
- After processing, insert a row into `production_day_closures` for that date. Once closed, the Tracking UI should disable further actuals edits and disable Close Day for that date (prevents double-run and after-the-fact edits).

## API changes

- `PUT /api/production-plans/[id]` already does a generic field update — no route changes needed to persist `hourlyActuals` or Melt's `actualQuantity`, as long as the client sends the field. Verify this during implementation.
- New: `POST /api/production-plans/close-day` — body `{ date }`. Performs the shortfall computation and carry-forward row creation described above, then records the closure. Returns which rows were carried forward for UI confirmation/summary.
- New: `GET /api/production-day-closures?date=YYYY-MM-DD` (or bundle closure status into the existing production-plans fetch) — so the Tracking UI knows whether a date is already closed.
- Delete the four `/api/schedules*` route files listed above.

## Testing / verification plan

- Typecheck (`tsc --noEmit`) after schema and route changes.
- Manually exercise: enter partial hourly actuals for a Core item, Close Day, confirm a new `isPending` row appears tomorrow with the correct shortfall and is styled red/sorted first.
- Confirm Melt's per-heat shortfall carries forward correctly using its existing actual-quantity field.
- Confirm Production Planning's own pages/behavior are unchanged (no regression) — spot check Core/Mould/Melt/Knockout planning tabs still work exactly as before.
- Confirm the old `/api/schedules*` routes are gone and nothing else in the app still references them (grep for `api/schedules`, `CloseDayModal`, `OrderTimelineDrawer` before deleting to catch stray references).
