# Production Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Production Tracking (`/production`) as a read-only view of `production_plans` (the same data Production Planning writes), add hourly/per-heat actuals entry, and an explicit "Close Day" action that auto-carries forward shortfalls to tomorrow, flagged as pending.

**Architecture:** Retire the legacy `schedules`/`schedule_stages` tables, their sync bridge, API routes, and old UI. Rebuild `/production` from scratch reading `production_plans` directly (never writing to Planning's own fields — only new fields: `hourlyActuals`, `actualQuantity` for Melt, and the new carry-forward bookkeeping fields). Production Planning's pages/modals/tabs are not touched by any task in this plan.

**Tech Stack:** Next.js App Router, Drizzle ORM (Postgres), React client components, existing `@/shared/ui` components (Button, Input, Card, Badge, Dialog, Label), `generateTimeSlots`/`toLocalDateString`/`cn` from `@/shared/lib/utils`.

## Global Constraints

- Production Planning (`src/app/production-planning/**`, `src/modules/production/presentation/{core,mould,melt,knockout,pour}-planning-*.tsx`) must not be modified by any task in this plan.
- Inspection stage is out of scope — not touched, not shown in the new Tracking page.
- Overachievement (actual > planned) auto-adjustment is out of scope — only carry-forward for shortfalls (actual < planned) is implemented.
- All new DB fields are additive; no existing `production_plans` column is repurposed or removed.
- Every task must leave `npx tsc --noEmit` clean before its commit.

---

### Task 1: Schema additions — carry-forward fields and day-closure table

**Files:**
- Modify: `src/infrastructure/database/schema/production-plans.schema.ts`
- Create: `src/infrastructure/database/schema/production-day-closures.schema.ts`
- Modify: `src/infrastructure/database/schema/index.ts`

**Interfaces:**
- Produces: `productionDayClosures` table (`date: text primary key`, `closedAt: timestamp`), and `productionPlans.carriedForwardFromDate` (`text`, nullable) — both consumed by Task 2's close-day route and Task 4/6's UI.

- [ ] **Step 1: Add `carriedForwardFromDate` to production_plans schema**

In `src/infrastructure/database/schema/production-plans.schema.ts`, add after the `isPending` field:

```ts
  // Set only on rows created by the Close Day carry-forward process (Production
  // Tracking) - the origin date this row's shortfall came from, purely for
  // display ("Carried forward from Jul 31"). Never set by Production Planning.
  carriedForwardFromDate: text('carried_forward_from_date'),
```

- [ ] **Step 2: Create the production_day_closures schema file**

Create `src/infrastructure/database/schema/production-day-closures.schema.ts`:

```ts
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

// Marks a date as finalized in Production Tracking's Close Day flow - once a
// date has a row here, Close Day can't be re-run for it and further actuals
// edits for that date are locked in the UI.
export const productionDayClosures = pgTable('production_day_closures', {
  date: text('date').primaryKey(), // YYYY-MM-DD
  closedAt: timestamp('closed_at').defaultNow().notNull(),
})
```

- [ ] **Step 3: Export the new schema from the barrel file**

In `src/infrastructure/database/schema/index.ts`, add:

```ts
export * from './production-day-closures.schema'
```

(Add this line after the existing `export * from './production-plans.schema'` line.)

- [ ] **Step 4: Push schema to the database**

Run: `npx drizzle-kit push`

This is a live, real Postgres database (`bef_foundry`) — the CLI will show a plan (new column, new table) and prompt for confirmation. Review the prompt output before confirming; it should show only an ADD COLUMN and a CREATE TABLE, nothing destructive. **Stop and ask the user before confirming if the CLI shows anything unexpected (e.g. a DROP).**

- [ ] **Step 5: Verify with typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/database/schema/production-plans.schema.ts src/infrastructure/database/schema/production-day-closures.schema.ts src/infrastructure/database/schema/index.ts
git commit -m "feat: add carry-forward and day-closure schema for Production Tracking"
```

---

### Task 2: Close Day API — shortfall computation and carry-forward

**Files:**
- Create: `src/app/api/production-plans/_close-day.ts`
- Create: `src/app/api/production-plans/close-day/route.ts`
- Create: `src/app/api/production-day-closures/route.ts`

**Interfaces:**
- Consumes: `productionPlans` and `productionDayClosures` tables from Task 1.
- Produces: `computeCarryForwards(rows: PlanRow[]): CarryForwardInput[]` (pure function, exported for testing) and `POST /api/production-plans/close-day` (body `{ date: string }`, returns `{ closed: boolean, carriedForward: CarryForwardInput[] }`); `GET /api/production-day-closures?date=YYYY-MM-DD` (returns `{ closed: boolean }`).

- [ ] **Step 1: Write the pure shortfall-computation function**

Create `src/app/api/production-plans/_close-day.ts`:

```ts
export interface PlanRow {
  id: string
  orderId: string
  itemId: string
  stage: 'Core' | 'Mould' | 'Melt' | 'Knockout'
  date: string
  quantityScheduled: number
  hourlyActuals: Record<string, number> | null
  actualQuantity: string | number | null
  coreBoxCode: string | null
  shiftId: string | null
}

export interface CarryForwardInput {
  orderId: string
  itemId: string
  stage: PlanRow['stage']
  date: string
  quantityScheduled: number
  coreBoxCode: string | null
  shiftId: string | null
  isPending: true
  carriedForwardFromDate: string
}

// Melt tracks actuals via a single actualQuantity per heat-row; Core/Mould/
// Knockout track actuals per hour slot (hourlyActuals), summed and compared
// against quantityScheduled (which already equals sum(hourlyTargets) at save
// time in every planning modal). Only positive shortfalls carry forward -
// overachievement is out of scope (see plan's Global Constraints).
export function shortfallForRow(row: PlanRow): number {
  if (row.stage === 'Melt') {
    const actual = Number(row.actualQuantity) || 0
    return Math.max(0, row.quantityScheduled - actual)
  }
  const actualSum = Object.values(row.hourlyActuals || {}).reduce((s, v) => s + (Number(v) || 0), 0)
  return Math.max(0, row.quantityScheduled - actualSum)
}

export function nextDateString(date: string): string {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function computeCarryForwards(rows: PlanRow[]): CarryForwardInput[] {
  const tomorrow = rows.length > 0 ? nextDateString(rows[0].date) : ''
  return rows
    .map(row => ({ row, shortfall: shortfallForRow(row) }))
    .filter(({ shortfall }) => shortfall > 0)
    .map(({ row, shortfall }) => ({
      orderId: row.orderId,
      itemId: row.itemId,
      stage: row.stage,
      date: tomorrow,
      quantityScheduled: shortfall,
      coreBoxCode: row.coreBoxCode,
      shiftId: row.shiftId,
      isPending: true as const,
      carriedForwardFromDate: row.date,
    }))
}
```

- [ ] **Step 2: Create the Close Day route**

Create `src/app/api/production-plans/close-day/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { productionPlans, productionDayClosures } from '@/infrastructure/database/schema'
import { computeCarryForwards, type PlanRow } from '../_close-day'

export async function POST(request: NextRequest) {
  try {
    const { date } = await request.json()
    if (!date) return NextResponse.json({ error: 'date is required' }, { status: 400 })

    const [existingClosure] = await db.select().from(productionDayClosures).where(eq(productionDayClosures.date, date))
    if (existingClosure) {
      return NextResponse.json({ error: 'This date is already closed' }, { status: 409 })
    }

    const rows = await db.select().from(productionPlans).where(
      and(eq(productionPlans.date, date), inArray(productionPlans.stage, ['Core', 'Mould', 'Melt', 'Knockout']))
    )

    const carryForwards = computeCarryForwards(rows as unknown as PlanRow[])

    if (carryForwards.length > 0) {
      await db.insert(productionPlans).values(carryForwards.map(cf => ({
        orderId: cf.orderId,
        itemId: cf.itemId,
        stage: cf.stage,
        date: cf.date,
        quantityScheduled: cf.quantityScheduled,
        coreBoxCode: cf.coreBoxCode || '',
        shiftId: cf.shiftId,
        isPending: true,
        carriedForwardFromDate: cf.carriedForwardFromDate,
      })))
    }

    await db.insert(productionDayClosures).values({ date })

    return NextResponse.json({ closed: true, carriedForward: carryForwards })
  } catch (error) {
    console.error('POST /api/production-plans/close-day error:', error)
    return NextResponse.json({ error: 'Failed to close day' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Create the day-closure status route**

Create `src/app/api/production-day-closures/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { productionDayClosures } from '@/infrastructure/database/schema'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get('date')
    if (!date) return NextResponse.json({ error: 'date query param is required' }, { status: 400 })
    const [row] = await db.select().from(productionDayClosures).where(eq(productionDayClosures.date, date))
    return NextResponse.json({ closed: !!row })
  } catch (error) {
    console.error('GET /api/production-day-closures error:', error)
    return NextResponse.json({ error: 'Failed to fetch closure status' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Sanity-check the shortfall math against the spec's 120/60 example**

This project has no test runner configured (no jest/vitest), so verify the pure function's logic by inline reasoning against `_close-day.ts`'s actual code before moving on — confirm all three of these by re-reading the file you just wrote:

1. A Core row with `quantityScheduled: 120` and `hourlyActuals: { '08:00 AM': 20, '09:00 AM': 40 }` (sums to 60): `shortfallForRow` returns `Math.max(0, 120 - 60) = 60`. ✓
2. A Melt row with `quantityScheduled: 100` and `actualQuantity: '200'`: `shortfallForRow` returns `Math.max(0, 100 - 200) = 0` (overachievement produces no carry-forward, matching the Non-goals). ✓
3. `computeCarryForwards` only includes rows where shortfall `> 0`, and sets `date` to `nextDateString(row.date)` — a row dated `'2026-08-01'` produces a carry-forward dated `'2026-08-02'`. ✓

The full real-data verification (through the actual UI and database) happens in Task 6 Step 4 once Close Day is wired up end-to-end.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/production-plans/_close-day.ts src/app/api/production-plans/close-day/route.ts src/app/api/production-day-closures/route.ts
git commit -m "feat: add Close Day shortfall computation and carry-forward API"
```

---

### Task 3: Retire the legacy schedules system

**Files:**
- Delete: `src/infrastructure/database/schema/schedules.schema.ts`
- Delete: `src/app/api/schedules/route.ts`, `src/app/api/schedules/[id]/route.ts`, `src/app/api/schedules/close-day/route.ts`, `src/app/api/schedules/_stage-helpers.ts`
- Delete: `src/app/api/production-plans/_schedule-sync.ts`
- Delete: `src/modules/production/presentation/close-day-modal.tsx`, `src/modules/production/presentation/order-timeline-drawer.tsx`
- Modify: `src/infrastructure/database/schema/index.ts`
- Modify: `src/app/api/production-plans/route.ts`, `src/app/api/production-plans/[id]/route.ts` (remove `syncScheduleFromPlans` calls/imports)

**Interfaces:**
- Consumes: nothing new.
- Produces: a codebase with zero references to `schedules`/`scheduleStages`/`syncScheduleFromPlans`/`CloseDayModal`/`OrderTimelineDrawer`, verified by grep in Step 5.

**This task deletes real files and drops real database tables — this is exactly the kind of action that needs your explicit confirmation at execution time before running `drizzle-kit push` in Step 4. Do not run Step 4 without that confirmation.**

- [ ] **Step 1: Remove the sync-call sites in production-plans routes**

In `src/app/api/production-plans/route.ts`, remove the line `import { syncScheduleFromPlans } from './_schedule-sync'` and the line `await syncScheduleFromPlans(row.orderId, row.date)`.

In `src/app/api/production-plans/[id]/route.ts`, remove the line `import { syncScheduleFromPlans } from '../_schedule-sync'` and both lines calling `await syncScheduleFromPlans(...)` (one in `PUT`, one in `DELETE`).

- [ ] **Step 2: Delete the legacy files**

```bash
rm src/infrastructure/database/schema/schedules.schema.ts
rm -rf src/app/api/schedules
rm src/app/api/production-plans/_schedule-sync.ts
rm src/modules/production/presentation/close-day-modal.tsx
rm src/modules/production/presentation/order-timeline-drawer.tsx
```

- [ ] **Step 3: Remove the schema export**

In `src/infrastructure/database/schema/index.ts`, delete the line `export * from './schedules.schema'`.

- [ ] **Step 4: Push the schema change to drop the tables**

Run: `npx drizzle-kit push`

This WILL prompt about dropping `schedules` and `schedule_stages` — this is expected and matches the approved design (Task 3 is exactly this removal). Confirm the drop.

- [ ] **Step 5: Grep for any remaining dead references**

Run: `grep -rn "schedules\.schema\|from '.*schedule-sync'\|syncScheduleFromPlans\|CloseDayModal\|OrderTimelineDrawer\|api/schedules" src --include="*.ts" --include="*.tsx"`

Expected: no output. If anything shows up (e.g. `src/app/production/page.tsx` — expected, that's rebuilt in Task 4), note it for the next task; don't leave a dangling import anywhere else.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors only in `src/app/production/page.tsx` (it still imports `CloseDayModal`/`OrderTimelineDrawer` until Task 4 rebuilds it). No errors anywhere else.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: retire legacy schedules system, replaced by Production Tracking on production_plans"
```

---

### Task 4: Production Tracking page shell — read-only planned view

**Files:**
- Create: `src/modules/production/presentation/tracking-stage-list.tsx`
- Modify: `src/app/production/page.tsx` (full rewrite)

**Interfaces:**
- Consumes: `GET /api/production-plans` (all rows), `GET /api/orders` (for order/cart lookups).
- Produces: `TrackingStageList` component — props `{ stage: 'Core'|'Mould'|'Melt'|'Knockout', date: string, plans: any[], orders: any[], onEnterActuals: (plan: any) => void }` — consumed by Task 5/6's actuals-entry wiring and Task 7's Close Day button.

- [ ] **Step 1: Build the read-only stage list component**

Create `src/modules/production/presentation/tracking-stage-list.tsx`:

```tsx
'use client'

import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { cn } from '@/shared/lib/utils'

export interface TrackingPlanRow {
  id: string
  orderId: string
  itemId: string
  stage: 'Core' | 'Mould' | 'Melt' | 'Knockout'
  date: string
  quantityScheduled: number
  coreBoxCode?: string | null
  hourlyActuals?: Record<string, number> | null
  actualQuantity?: string | number | null
  isPending?: boolean | null
  carriedForwardFromDate?: string | null
  shiftId?: string | null
}

interface TrackingStageListProps {
  stage: 'Core' | 'Mould' | 'Melt' | 'Knockout'
  plans: TrackingPlanRow[]
  orders: any[]
  onEnterActuals: (plan: TrackingPlanRow) => void
}

function actualSumFor(plan: TrackingPlanRow): number {
  if (plan.stage === 'Melt') return Number(plan.actualQuantity) || 0
  return Object.values(plan.hourlyActuals || {}).reduce((s, v) => s + (Number(v) || 0), 0)
}

export function TrackingStageList({ stage, plans, orders, onEnterActuals }: TrackingStageListProps) {
  const rows = plans
    .filter(p => p.stage === stage)
    // Pending (carried-forward) rows surface first so operators clear backlog before new work.
    .sort((a, b) => (b.isPending ? 1 : 0) - (a.isPending ? 1 : 0))

  if (rows.length === 0) {
    return <p className="text-[#94A3B8] text-center py-12 italic">No {stage} plans for this date.</p>
  }

  return (
    <div className="border border-[#E0E7FF] rounded-xl overflow-x-auto shadow-sm">
      <table className="w-full text-sm text-left whitespace-nowrap">
        <thead className="bg-[#F4F6FB] border-b border-[#E0E7FF] text-[#64748B] font-semibold text-xs uppercase tracking-wider">
          <tr>
            <th className="px-4 py-3">PO No</th>
            <th className="px-4 py-3">Product</th>
            {stage === 'Core' && <th className="px-4 py-3">Core Box</th>}
            <th className="px-4 py-3 text-center">Planned</th>
            <th className="px-4 py-3 text-center">Actual (so far)</th>
            <th className="px-4 py-3 text-center">Status</th>
            <th className="px-4 py-3 text-right">Actuals Entry</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E0E7FF]">
          {rows.map(plan => {
            const order = orders.find((o: any) => (o.id || o._id) === plan.orderId)
            const parts = String(plan.itemId).split('-')
            const idx = parseInt(parts[parts.length - 1], 10)
            const productName = order?.cart?.[idx]?.productName || '-'
            const actual = actualSumFor(plan)

            return (
              <tr key={plan.id} className={cn('hover:bg-[#F8FAFC]', plan.isPending && 'bg-red-50')}>
                <td className="px-4 py-3 font-mono text-[#4285F4]">{order?.customerOrderNo || '-'}</td>
                <td className="px-4 py-3 font-semibold text-[#172554]">{productName}</td>
                {stage === 'Core' && <td className="px-4 py-3 font-mono text-indigo-600">{plan.coreBoxCode || '-'}</td>}
                <td className="px-4 py-3 text-center font-mono font-semibold">{plan.quantityScheduled}</td>
                <td className="px-4 py-3 text-center font-mono">{actual}</td>
                <td className="px-4 py-3 text-center">
                  {plan.isPending ? (
                    <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-[10px]">
                      Pending{plan.carriedForwardFromDate ? ` (from ${plan.carriedForwardFromDate})` : ''}
                    </Badge>
                  ) : (
                    <span className="text-[#94A3B8] text-xs">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="outline" onClick={() => onEnterActuals(plan)} className="border-[#E0E7FF] text-[#4F46E5] hover:bg-[#EEF2FF]">
                    Enter Actuals
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite the Tracking page shell (no actuals modal wiring yet — Tasks 5/6 add it)**

Replace the full contents of `src/app/production/page.tsx`:

```tsx
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Input } from '@/shared/ui/input'
import { cn, toLocalDateString } from '@/shared/lib/utils'
import { TrackingStageList, type TrackingPlanRow } from '@/modules/production/presentation/tracking-stage-list'

const STAGES: TrackingPlanRow['stage'][] = ['Core', 'Mould', 'Melt', 'Knockout']

export default function ProductionTrackingPage() {
  const [plans, setPlans] = useState<TrackingPlanRow[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState(() => toLocalDateString(new Date()))
  const [activeStage, setActiveStage] = useState<TrackingPlanRow['stage']>('Core')

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [planRes, orderRes] = await Promise.all([fetch('/api/production-plans'), fetch('/api/orders')])
      if (planRes.ok) setPlans(await planRes.json())
      if (orderRes.ok) setOrders(await orderRes.json())
    } catch (err) {
      console.error('Failed to fetch tracking data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const dayPlans = useMemo(() => plans.filter(p => p.date === dateFilter), [plans, dateFilter])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#172554] font-heading tracking-tight">Production Tracking</h1>
          <p className="text-[#64748B] mt-1 text-sm">Read-only view of planned quantities, with actuals entry per item</p>
        </div>
        <Input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          className="w-40 bg-[#FFFFFF] border-[#E0E7FF] text-[#172554]"
        />
      </div>

      <div className="flex w-full max-w-xl bg-white p-1.5 rounded-full shadow-sm border border-[#D8DEE9]">
        {STAGES.map(stage => (
          <button
            key={stage}
            onClick={() => setActiveStage(stage)}
            className={cn(
              'flex-1 px-3 py-2 text-sm font-bold text-center transition-all duration-300 rounded-full',
              activeStage === stage ? 'bg-[#4F46E5] text-white shadow-md' : 'text-[#64748B] hover:text-[#4F46E5]'
            )}
          >
            {stage}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-[#64748B] text-center py-12 animate-pulse">Loading tracking data...</p>
      ) : (
        <TrackingStageList
          stage={activeStage}
          plans={dayPlans}
          orders={orders}
          onEnterActuals={() => {}}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (this fully replaces the file that had the Task 3 errors).

- [ ] **Step 4: Manual check**

Run the dev server (`npm run dev`), visit `/production`, confirm: date picker works, stage tabs switch, and rows appear for any date that has existing Core/Mould/Melt/Knockout plans (check against `/production-planning` for a date you know has plans).

- [ ] **Step 5: Commit**

```bash
git add src/modules/production/presentation/tracking-stage-list.tsx src/app/production/page.tsx
git commit -m "feat: rebuild Production Tracking as a read-only view of production_plans"
```

---

### Task 5: Hourly actuals entry (Core, Mould, Knockout)

**Files:**
- Create: `src/modules/production/presentation/tracking-actuals-modal.tsx`
- Modify: `src/app/production/page.tsx`

**Interfaces:**
- Consumes: `GET /api/shifts` (for time-slot reconstruction), `PUT /api/production-plans/[id]` (existing generic update route from Task-independent prior work).
- Produces: `TrackingActualsModal` component — props `{ plan: TrackingPlanRow | null, onClose: () => void, onSaved: () => void }`, opened from `TrackingStageList`'s "Enter Actuals" button.

- [ ] **Step 1: Build the hourly actuals modal**

Create `src/modules/production/presentation/tracking-actuals-modal.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { X } from '@phosphor-icons/react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { generateTimeSlots, type TimeSlot } from '@/shared/lib/utils'
import type { TrackingPlanRow } from './tracking-stage-list'

interface TrackingActualsModalProps {
  plan: TrackingPlanRow | null
  shifts: any[]
  onClose: () => void
  onSaved: () => Promise<void>
}

export function TrackingActualsModal({ plan, shifts, onClose, onSaved }: TrackingActualsModalProps) {
  const [actuals, setActuals] = useState<Record<string, number>>({})
  const [meltActual, setMeltActual] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (plan) {
      setActuals((plan.hourlyActuals as Record<string, number>) || {})
      setMeltActual(plan.actualQuantity != null ? String(plan.actualQuantity) : '')
    }
  }, [plan])

  if (!plan) return null

  const shift = shifts.find((s: any) => s.id === plan.shiftId)
  const timeSlots: TimeSlot[] = shift ? generateTimeSlots(shift.startTime, shift.endTime, shift.breaks || []) : []

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const body = plan.stage === 'Melt'
        ? { actualQuantity: meltActual === '' ? null : Number(meltActual) }
        : { hourlyActuals: actuals }
      await fetch(`/api/production-plans/${plan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      await onSaved()
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#F4F6FB] border border-sidebar-border rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-sidebar-border bg-white rounded-t-xl">
          <h2 className="text-xl font-bold text-[#172554]">Enter Actuals - {plan.stage}</h2>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <p className="text-[#64748B] text-sm">Planned: <span className="font-mono font-semibold text-[#172554]">{plan.quantityScheduled}</span></p>

          {plan.stage === 'Melt' ? (
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">Actual Quantity</Label>
              <Input type="number" min="0" value={meltActual} onChange={e => setMeltActual(e.target.value)} className="bg-white border-sidebar-border" />
            </div>
          ) : timeSlots.length === 0 ? (
            <p className="text-red-500 text-sm">This plan has no shift assigned, so hourly slots can't be shown.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {timeSlots.map(slot => (
                <div key={slot.time} className="space-y-1">
                  <Label className="text-[10px] text-[#64748B]">{slot.time}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={actuals[slot.time] ?? ''}
                    onChange={e => setActuals(prev => ({ ...prev, [slot.time]: Number(e.target.value) || 0 }))}
                    className="bg-white border-sidebar-border h-8 text-sm"
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-sidebar-border bg-white rounded-b-xl flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white">
            {isSaving ? 'Saving...' : 'Save Actuals'}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire the modal into the Tracking page**

In `src/app/production/page.tsx`, add state and fetch shifts, and pass the real handler:

Add to imports: `import { TrackingActualsModal } from '@/modules/production/presentation/tracking-actuals-modal'`

Add state: `const [shifts, setShifts] = useState<any[]>([])` and `const [actualsPlan, setActualsPlan] = useState<TrackingPlanRow | null>(null)`

In `fetchData`, add `fetch('/api/shifts')` to the `Promise.all` array and `if (shiftRes.ok) setShifts(await shiftRes.json())`.

Change `onEnterActuals={() => {}}` to `onEnterActuals={setActualsPlan}`.

Add before the closing `</div>` of the component's return:

```tsx
<TrackingActualsModal
  plan={actualsPlan}
  shifts={shifts}
  onClose={() => setActualsPlan(null)}
  onSaved={fetchData}
/>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual check**

In the dev server, open a Core (or Mould/Knockout) plan's "Enter Actuals", fill in a couple of hour slots with values less than target, save, and confirm the "Actual (so far)" column in the list updates.

- [ ] **Step 5: Commit**

```bash
git add src/modules/production/presentation/tracking-actuals-modal.tsx src/app/production/page.tsx
git commit -m "feat: add hourly/per-heat actuals entry to Production Tracking"
```

---

### Task 6: Close Day button and closed-date lock

**Files:**
- Modify: `src/app/production/page.tsx`

**Interfaces:**
- Consumes: `POST /api/production-plans/close-day`, `GET /api/production-day-closures?date=...` (both from Task 2).
- Produces: closed-date awareness (`isClosed: boolean` state) consumed by disabling "Enter Actuals" and "Close Day" for a closed date.

- [ ] **Step 1: Add closure-status fetching and Close Day handler**

In `src/app/production/page.tsx`, add state: `const [isClosed, setIsClosed] = useState(false)` and `const [isClosing, setIsClosing] = useState(false)`.

Add an effect that re-checks closure status whenever `dateFilter` changes:

```tsx
useEffect(() => {
  fetch(`/api/production-day-closures?date=${dateFilter}`)
    .then(res => res.ok ? res.json() : { closed: false })
    .then(data => setIsClosed(!!data.closed))
    .catch(() => setIsClosed(false))
}, [dateFilter])
```

Add the handler:

```tsx
const handleCloseDay = async () => {
  if (!confirm(`Close ${dateFilter}? This carries forward any shortfall to tomorrow and locks further edits for this date.`)) return
  setIsClosing(true)
  try {
    const res = await fetch('/api/production-plans/close-day', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: dateFilter }),
    })
    if (res.ok) {
      const data = await res.json()
      alert(`Day closed. ${data.carriedForward.length} item(s) carried forward to tomorrow.`)
      setIsClosed(true)
      await fetchData()
    } else {
      const err = await res.json()
      alert(err.error || 'Failed to close day')
    }
  } finally {
    setIsClosing(false)
  }
}
```

- [ ] **Step 2: Add the Close Day button and disable actuals entry when closed**

In the header row (next to the date `Input`), add:

```tsx
<Button onClick={handleCloseDay} disabled={isClosed || isClosing} className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white">
  {isClosed ? 'Day Closed' : isClosing ? 'Closing...' : 'Close Day'}
</Button>
```

(Add `import { Button } from '@/shared/ui/button'` if not already imported.)

Change `onEnterActuals={setActualsPlan}` to `onEnterActuals={isClosed ? () => {} : setActualsPlan}`, and pass `disableActuals={isClosed}` through to `TrackingStageList` — in `tracking-stage-list.tsx`, add an optional `disableActuals?: boolean` prop and change the "Enter Actuals" button to `disabled={disableActuals}`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual end-to-end verification of the 120/60 example from the spec**

1. Find (or create via Production Planning — read-only, don't edit, just observe) a Core plan with `quantityScheduled = 120` for some date D.
2. In Tracking, open Enter Actuals for that row, fill hour slots that sum to 60, save.
3. Click Close Day for date D, confirm the alert reports 1 item carried forward.
4. Change the date picker to D+1, confirm a new red "Pending (from D)" row appears with Planned = 60.
5. Try Close Day again for date D — confirm it's now disabled / shows "Day Closed".
6. Go back to `/production-planning` and confirm nothing changed there — same Core plan, same quantity, no pending flags, no red rows (it has no concept of `isPending` in its UI).

- [ ] **Step 5: Commit**

```bash
git add src/app/production/page.tsx src/modules/production/presentation/tracking-stage-list.tsx
git commit -m "feat: add Close Day action with shortfall carry-forward locking"
```

---

### Task 7: Tracking calendar view

**Files:**
- Modify: `src/app/production/page.tsx`

**Interfaces:**
- Consumes: `plans` state already fetched in Task 4.
- Produces: a `summaryView: 'calendar' | 'list'` toggle at the top of the page; calendar cells show actual-vs-planned per stage for each day.

- [ ] **Step 1: Add the calendar data derivation**

In `src/app/production/page.tsx`, add:

```tsx
const calendarDays = useMemo(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
  const startDate = new Date(firstDay)
  startDate.setDate(firstDay.getDate() - startOffset)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    return d
  })
}, [])

const trackingByDate = useMemo(() => {
  const map = new Map<string, Record<'Core' | 'Mould' | 'Melt' | 'Knockout', { planned: number; actual: number }>>()
  plans.forEach(p => {
    if (!STAGES.includes(p.stage)) return
    if (!map.has(p.date)) {
      map.set(p.date, { Core: { planned: 0, actual: 0 }, Mould: { planned: 0, actual: 0 }, Melt: { planned: 0, actual: 0 }, Knockout: { planned: 0, actual: 0 } })
    }
    const entry = map.get(p.date)!
    entry[p.stage].planned += Number(p.quantityScheduled) || 0
    entry[p.stage].actual += p.stage === 'Melt'
      ? Number(p.actualQuantity) || 0
      : Object.values(p.hourlyActuals || {}).reduce((s, v) => s + (Number(v) || 0), 0)
  })
  return map
}, [plans])
```

- [ ] **Step 2: Add the view toggle and calendar grid to the JSX**

Add state: `const [summaryView, setSummaryView] = useState<'calendar' | 'list'>('list')`.

Add above the stage tabs:

```tsx
<div className="flex justify-end">
  <div className="flex items-center gap-3 bg-white px-4 py-1.5 border border-[#E0E7FF] rounded-xl shadow-sm">
    <button onClick={() => setSummaryView('calendar')} className={cn('text-sm font-semibold', summaryView === 'calendar' ? 'text-[#172554]' : 'text-[#94A3B8]')}>Calendar</button>
    <button onClick={() => setSummaryView('list')} className={cn('text-sm font-semibold', summaryView === 'list' ? 'text-[#172554]' : 'text-[#94A3B8]')}>List</button>
  </div>
</div>
```

Wrap the existing stage-tabs + `TrackingStageList` block in `{summaryView === 'list' && (...)}`, and add the calendar block as a sibling:

```tsx
{summaryView === 'calendar' && (
  <div className="bg-[#F4F6FB] border border-[#E0E7FF] rounded-xl p-4 overflow-x-auto">
    <div className="grid grid-cols-7 mt-2 mb-2 min-w-[800px]">
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
        <div key={day} className="py-2 text-center text-xs font-semibold text-[#64748B] uppercase tracking-wider">{day}</div>
      ))}
    </div>
    <div className="grid grid-cols-7 gap-3 min-w-[800px]">
      {calendarDays.map((date, i) => {
        const dateStr = toLocalDateString(date)
        const isToday = toLocalDateString(new Date()) === dateStr
        const counts = trackingByDate.get(dateStr)
        return (
          <button
            key={i}
            onClick={() => { setDateFilter(dateStr); setSummaryView('list') }}
            className="min-h-[110px] bg-white p-2 rounded-[12px] border border-[#E0E7FF] flex flex-col gap-1 text-left hover:border-[#4F46E5] transition-colors"
          >
            <span className={cn('text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full self-end', isToday ? 'bg-[#4F46E5] text-white' : 'text-[#64748B]')}>
              {date.getDate()}
            </span>
            {STAGES.map(stage => counts?.[stage]?.planned ? (
              <div key={stage} className="flex items-center justify-between px-1 text-[10.5px]">
                <span className="text-[#64748B]">{stage}</span>
                <span className="font-bold text-[#0F172A]">{counts[stage].actual} / {counts[stage].planned}</span>
              </div>
            ) : null)}
          </button>
        )
      })}
    </div>
  </div>
)}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual check**

Toggle Calendar/List, confirm each day cell shows correct actual/planned counts matching what you saw in list view for the same date, and clicking a day switches to List view on that date.

- [ ] **Step 5: Commit**

```bash
git add src/app/production/page.tsx
git commit -m "feat: add calendar view to Production Tracking"
```

---

### Task 8: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 2: Grep for dead legacy references**

Run: `grep -rn "schedules\.schema\|schedule-sync\|syncScheduleFromPlans\|CloseDayModal\|OrderTimelineDrawer\|/api/schedules" src --include="*.ts" --include="*.tsx"`
Expected: no output.

- [ ] **Step 3: Confirm Production Planning is untouched**

Run: `git diff master --stat -- src/app/production-planning src/modules/production/presentation/core-planning-modal.tsx src/modules/production/presentation/core-planning-tab.tsx src/modules/production/presentation/mould-planning-modal.tsx src/modules/production/presentation/mould-planning-tab.tsx src/modules/production/presentation/melt-planning-modal.tsx src/modules/production/presentation/melt-planning-tab.tsx src/modules/production/presentation/knockout-planning-modal.tsx src/modules/production/presentation/knockout-planning-tab.tsx src/modules/production/presentation/pour-planning-tab.tsx src/modules/production/presentation/inspection-tab.tsx`
Expected: no output (zero changes to any Planning file across this whole plan).

- [ ] **Step 4: End-to-end manual walkthrough**

Repeat Task 6 Step 4's full walkthrough (120/60 shortfall, close day, confirm carry-forward, confirm closed-date lock, confirm Planning unaffected) one more time end-to-end as a final sign-off, plus: open Melt's Enter Actuals for a heat row, enter an actual less than planned, Close Day, confirm the Melt shortfall also carries forward correctly.

- [ ] **Step 5: Report results to the user**

Summarize what was built, what was verified, and ask whether to push/merge through the branch flow (this repo pushes to both `origin` and `bitbucket`, and merges feature → dev → main only with explicit confirmation each step, per established workflow).
