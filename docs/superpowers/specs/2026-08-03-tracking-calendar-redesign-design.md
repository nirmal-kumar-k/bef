# Production Tracking — Calendar-Driven Day Modal — Design Spec

Date: 2026-08-03
Status: Approved by user, pending implementation plan

## Problem

Production Tracking (`/production`) currently has a Calendar/List toggle. Calendar cells are static (non-clickable) and styled differently from Production Planning's own calendar. List view requires clicking a stage tab, then an "Enter Actuals" button per row, which opens a separate popup modal (`TrackingActualsModal`) for hourly entry. Switching from Calendar into that flow feels disconnected, and an earlier fix (a "Back to Calendar" link) was a band-aid on top of a page-navigation model that shouldn't need one.

The goal: make Tracking's calendar visually match Planning's calendar, make its day cells clickable, and replace the deep click-through-tabs-then-modal flow with a single day-detail modal that opens directly from a calendar click — richer than today's popup, with actuals entered inline in an hourly grid matching Planning's own modals. List view stays as a lighter-weight, separate view.

## Non-goals (carried over from the original Production Tracking spec)

- Production Planning (`/production-planning`, its tabs/modals) is not touched.
- Inspection stage stays out of scope.
- Overachievement (actual > planned) auto-adjustment stays out of scope.

## Design

### 1. Calendar view (`src/app/production/page.tsx`)

- Restyle Tracking's calendar cards to match Production Planning's calendar exactly: same rounded white cells, same colored-dot + stage-label + `done / planned` row layout per stage.
- Add a fourth colored dot for **Knockout** (Planning's calendar only tracks Core/Mould/Melt; Tracking tracks Knockout too).
- Cells become clickable. Clicking a day opens `TrackingDayModal` for that date. The calendar itself does not navigate or change `dateFilter`/`summaryView` state — the modal is a pure overlay.
- The existing Calendar/List toggle is unchanged.

### 2. `TrackingDayModal` (new component)

Opened from a calendar-day click. Props: `{ date: string, plans, orders, shifts, isClosed, onClose, onSaved, onCloseDay }`.

- **Header:** the date, stage tabs (Core / Mould / Melt / Knockout), and a Close Day button — same disabled/label logic as today (`Day Closed` once locked, `Closing...` mid-request).
- **Core / Mould / Knockout tabs:** a Day/Night shift selector at the top (mirrors Planning's own modals — hour-slot columns are shift-specific, since Day and Night shifts have different start/end times, so rows from different shifts can't share one column header set). Below it, one flat table (no per-machine sub-tabs — Tracking's daily row count is far smaller than Planning's) listing that stage/date's rows filtered to the selected shift. Columns = the selected shift's hour slots (`generateTimeSlots`, same as Planning's modals). Each cell shows the read-only planned target and an editable actual-input beneath/beside it. Pending (carried-forward) rows keep today's treatment: red highlight, sorted first. Default shift selection: whichever shift has rows for that stage/date (or the first one, if both do).
- **Melt tab:** one row per heat, single editable "Actual Quantity" field per row — matches Melt's existing actual-entry shape (no hourly grid; Melt never had one).
- **Saving:** explicit save action (per tab, matching Planning's own explicit-save convention — no autosave-on-blur), persisting via the existing `PUT /api/production-plans/[id]` route (`hourlyActuals` for Core/Mould/Knockout, `actualQuantity` for Melt). Closing the modal with unsaved changes should not silently discard them (implementation plan to specify exact confirmation behavior).

### 3. List view (`tracking-stage-list.tsx`)

Stays as today's simpler flat table (stage tabs + one row per plan), but the "Enter Actuals" button and popup are replaced:

- **Core / Mould / Knockout:** the "Actual (so far)" column becomes read-only — same sum-of-`hourlyActuals` display as today, just no longer clickable into a popup. Editing these three stages' actuals happens exclusively through `TrackingDayModal`'s hourly grid, avoiding two divergent editing paths for the same `hourlyActuals` map.
- **Melt:** the actual-quantity field stays inline-editable directly in the List row (Melt already stores actuals as a single `actualQuantity` field, so no data-modeling conflict exists here).

### 4. Data flow / API

No new endpoints and no schema changes. Reuses:

- `PUT /api/production-plans/[id]` — saving `hourlyActuals` (modal) or `actualQuantity` (modal's Melt tab, and List's inline Melt field).
- `POST /api/production-plans/close-day`, `GET /api/production-day-closures` — unchanged, triggered from the modal header instead of the page header.
- `GET /api/production-plans`, `/api/orders`, `/api/shifts` — same fetches the page already makes.

### 5. Components affected

- **New:** `src/modules/production/presentation/tracking-day-modal.tsx` (modal shell, stage tabs, Close Day), `src/modules/production/presentation/tracking-hourly-grid.tsx` (Core/Mould/Knockout actuals table), `src/modules/production/presentation/tracking-melt-actuals-table.tsx` (Melt's per-heat table).
- **Modified:** `src/app/production/page.tsx` (calendar restyle + clickable cells + modal wiring; the "Back to Calendar" link added earlier this session is removed since it's no longer needed — Calendar/List navigation, not day-drill-down, is the only page-level nav left), `src/modules/production/presentation/tracking-stage-list.tsx` (List's actuals column per the above).
- **Deleted:** `src/modules/production/presentation/tracking-actuals-modal.tsx` (old per-row popup, fully superseded by `TrackingDayModal`).

## Testing / verification plan

- Typecheck (`tsc --noEmit`) clean after each component change.
- Manually verify: calendar visually matches Planning's calendar style plus a Knockout dot; clicking a day opens the modal without navigating the page; entering hourly actuals in the modal and saving updates List's read-only total and the calendar's `done/planned` counts; Melt's inline List field and the modal's Melt tab both save to the same `actualQuantity` and agree with each other; Close Day from the modal still carries forward shortfalls and locks the date exactly as today; Production Planning is unaffected (no diff to its files).
