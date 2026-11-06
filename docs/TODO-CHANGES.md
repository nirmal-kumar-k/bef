# TODO — Pending Changes

Working list, ordered by what to do next. Full evidence for each item lives in
[TECHNICAL-BACKLOG.md](./TECHNICAL-BACKLOG.md); this file is the running queue.

Last updated: 2026-10-22

---

## Done

- [x] **Next.js 16.2.6 → 16.2.12** — cleared 9 advisories including a
  middleware/proxy bypass (GHSA-6gpp-xcg3-4w24) that applied to this app, since
  `proxy.ts` is the entire auth gate and the build runs Turbopack single-locale.
- [x] **Backup script** (`scripts/backup-db.sh`) — verified dump, 14-day
  retention, self-checks with `pg_restore --list`. **Not yet installed on
  Azure.**
- [x] **Restore rehearsal on local** — restored into a scratch database and
  compared: all 14 tables, row counts, 4 FKs, 14 PKs, 19 indexes, 4 enums, 164
  columns identical. Scratch database dropped.
- [x] **Foreign keys on `production_plans`** (local only) — `order_id`,
  `equipment_id`, `shift_id` converted `text` → `uuid`; FKs added (orders
  CASCADE, equipment/shifts SET NULL); indexes on `(date, stage)` and
  `(order_id)`. 54 rows intact, 0 orphans, `drizzle-kit push` reports no
  changes.
- [x] **Backlog calculation verified correct** — Knockout remaining matches
  hand-computed values, sums across both shifts, and no Melt pours are dropped
  (`siblingMoulds = 0` in every pattern group).
- [x] **Whitelist the production-plans payload** (2026-10-22) — `PUT /[id]`
  and `POST` both validate against one zod schema (`_plan-payload.ts`);
  unknown fields and wrong types get a 400 naming them. Payload shapes of all
  four planning modals, Tracking and Inspection were read from the code and
  replayed against the API: 22/22 checks pass. Note this stops *unknown and
  malformed* writes only — who may write `isConfirmed` etc. is the roles item.
- [x] **`GET /api/production-plans` accepts `?from=&to=&stage=`**
  (2026-10-22) — server side only. Planning must keep the full history (its
  backlog sums every plan per item); Tracking could scope to the visible month
  but that is a UI change, not yet made.
- [x] **`error.tsx`, `loading.tsx`, `global-error.tsx`** (2026-10-22).
- [x] **Dead dependencies removed** (2026-10-22). `components.json` still
  names `lucide` as the shadcn icon library — re-add `lucide-react` if a shadcn
  component is ever added.

---

## Next up

- [x] **Default-admin fallback removed** (2026-10-22) — an empty users table
  no longer creates `admin`/`admin123`. The first admin of a fresh database is
  created with `node scripts/create-admin.mjs` (hidden password prompt,
  refuses if an admin exists). Its refusal path is tested; its create path has
  not been run, as that needs an empty database.
- [x] **Login lockout** (2026-10-22) — 5 failures per username+IP locks that
  pair for 15 min; 20 failures from one IP blocks the IP for 15 min. In
  memory, so `pm2 restart bef` clears every lock. IP comes from nginx's
  `X-Real-IP`.
- [x] **Minimum password length 8** (2026-10-22) — enforced in the Users API
  (create and reset) and the user modal.
- [ ] **Change the `admin` password on Azure and locally** — still
  `admin123` on both (verified against the hashes 2026-10-22). Users page →
  edit admin → Reset Password.
- [x] **Inspection batches dated in IST** (2026-10-29) — `inspection-submit`
  stamped "today" with the server clock, and the Azure VM runs on UTC, so a
  batch submitted 00:00–05:30 IST was dated the previous day. Now uses
  `businessDateString()` (Asia/Kolkata). Checked: none of the 4 existing
  inspection rows on Azure were affected. Every other date is chosen in the
  browser (IST) or sent by it (Close Day), so was already correct.
- [x] **Backups** (2026-10-29)
  - On the VM, daily at 02:00 IST (server clock is UTC):
    `30 20 * * * /usr/bin/bash /home/azureuser/babufoundry/scripts/backup-db.sh >> /home/azureuser/bef-backup.log 2>&1`
    (`bash` explicitly: the script has no execute bit after `git pull`.)
  - Off the VM: `scripts/pull-backups.ps1` copies new dumps to
    `D:\BEF-backups` on the office PC; a Windows scheduled task runs it daily
    and catches up if the PC was off. Registered with:
    `Register-ScheduledTask -TaskName 'BEF pull backups' -Action (New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -ExecutionPolicy Bypass -File D:\BEF\scripts\pull-backups.ps1') -Trigger (New-ScheduledTaskTrigger -Daily -At 9:30am) -Settings (New-ScheduledTaskSettingsSet -StartWhenAvailable)`
  - Local copies are never pruned (~1.4 MB/day).
- [x] **Concurrency step A** (2026-10-29)
  - Stock is added in the database (`stock = stock + n`) in Inspection,
    Knockout-confirm and the inspection-correction sync, so simultaneous
    additions cannot overwrite each other.
  - Inspection computes the pieces waiting on the server under a per-item
    lock and refuses (409, "reload") if the inspector's figure is out of date,
    so one batch cannot be inspected twice. The screen reloads on that 409.
  - Knockout-confirm claims each plan before adding stock, so a double
    confirm counts once. Note: nothing in the app calls this route.
  - Login IP-wide cap raised 20 → 100 (the office shares one public IP).
  - Tested on a scratch copy of the database against the production build:
    10 simultaneous inspections of one batch → 1 accepted, 9 refused, stock
    up once; 10 simultaneous corrections → none lost; 30 simultaneous
    confirms of 15 plans → each counted once. Not yet run against the old
    code to show the test fails there.
- [ ] **Decide: remove `/api/knockout-confirm`?** Unused, and adds stock at
  Knockout while Inspection is where stock is meant to be created.
- [x] **Concurrency steps B+C** (2026-11-05) — change history and
  optimistic locking for production plans and orders.
  - `audit_events`: one row per create/update/delete (who, when, changed
    fields, full before/after), written in the same transaction as the change.
    Who always comes from the session. Order deletes record each removed plan.
  - `version` + `updated_by_*` on plans and orders. A save carrying an older
    version gets 409 with who changed what; screens show a conflict dialog
    (Planning, Orders) or keep the unsaved figures with a message (Tracking,
    Inspection). Requests without a version behave as before.
  - "Edited by NAME · time" on plan rows (4 modals, Tracking) and orders.
  - Fixed on the way: Tracking ignored save results; failed order saves were
    silent; the order form cleared itself on a failed save.
  - History times are set by the app in UTC: local Postgres runs Asia/Calcutta,
    Azure's runs UTC, so now() would differ. (Pre-existing: `created_at` and
    insert-time `updated_at` still use now(), so read IST locally.)
  - Tested on a scratch copy: 25/25 B+C checks, 53/53 regression checks.
    Not yet seen in a browser.
  - **Azure needs `drizzle-kit push` for this** (10 additive statements).
- [x] **Live updates** (2026-11-05) — publish/subscribe over Postgres
  LISTEN/NOTIFY, delivered to browsers as Server-Sent Events (`/api/events`).
  - Publish: `publishChange()` (src/infrastructure/realtime) runs `pg_notify`
    inside the save's transaction, so only committed changes are announced.
    Plans and orders publish via `recordAudit`; Close Day and the three
    stock-changing paths publish explicitly; master-data routes and day
    re-open are wrapped with `publishOnSuccess`.
  - Subscribe: one LISTEN connection per server process fans out to every
    open stream; on a database reconnect it sends `resync` and browsers
    reload. 25s heartbeat; `X-Accel-Buffering: no` so nginx needs no change.
  - Browser: `LiveUpdatesProvider` (root layout). Screens use
    `useLiveRefresh`; editors with unsaved input use `useEditing`, which holds
    refreshes back (amber banner) until they close. A tab ignores its own
    changes via an `X-Client-Id` header. Toasts group bursts.
  - Wired: Orders, Planning (incl. Inspection), Tracking (+ live day-closed
    lock), Products. Tracking's reloads no longer flash "Loading...".
  - QA on a scratch copy: 19/19 realtime checks (64 ms delivery; no event for
    409/400/no-op/failed saves; recovery after a killed LISTEN connection)
    and 78/78 regression checks. Browser behaviour not yet seen.
  - MQTT can be added later inside `publishChange()` if machines start
    sending data.
  - Noted, not changed: creating a customer with missing fields returns 500
    instead of a validation message.
- [x] **Security upgrade + shadcn** (2026-11-05) — shadcn moved to
  devDependencies; Next.js 16.2.12 → 16.4.3 (5 critical advisories incl.
  unauthenticated RCE); overrides for browserslist, source-map-js,
  baseline-browser-mapping. Runtime audit 85 → 2 (zod: fix only in v4; fflate:
  browser-side 3D viewer). Both left deliberately.
- [x] **QA suite in the project** — `pnpm qa` (scripts/qa.sh, tests/qa).
- [x] **Cart ordering (Phase 3)** (2026-11-05) — `order_items.position`
  backfilled from ctid (verified identical to what the app showed; 0 gaps),
  every cart read ordered by it, edits guarded: planned lines can't be
  removed/moved/swapped (409 with a clear message). Migration:
  scripts/migrations/2026-11-05-order-items-position.sql — **run on Azure
  BEFORE drizzle-kit push** at the next deploy.
- [x] **Stock ledger (step D)** (2026-11-05) — `stock_movements`: one row per
  change (reason, delta, balance after, plan/order, who). `moveStock()`
  (src/infrastructure/stock) is the only way stock changes: it updates
  products.stock and writes the movement in one transaction, so
  stock = sum(movements) always. Inspection corrections/undo now run inside
  the plan's transaction. Product saves can no longer write stock (the form
  sent back stale stock and erased concurrent inspections). Admin
  "Adjust stock" takes a counted quantity + required reason. "History" button
  on Planning > Finished Stock. Opening balances:
  scripts/migrations/post/2026-11-05-stock-opening-balances.sql — **run on
  Azure AFTER drizzle-kit push**. Tests: tests/qa/stock.test.mjs (14).
- [x] **Clear write errors** (2026-11-05) — dbErrorResponse(): missing field
  -> 400 naming it, duplicate -> 409 (the old `error.code === '23505'`
  checks never fired because Drizzle wraps the error in `cause`).
- [x] **Sessions end on password/role/active change** (2026-11-05) —
  users.session_version carried in the token; checked per request (15s cache).
- [x] **ESLint** (2026-11-05) — eslint 10.13 + eslint-config-next 16.4.3,
  `pnpm lint` passes with 0 errors (326 warnings, mostly `any` and unused
  vars) and runs in `pnpm qa`. Bugs found and fixed through it: the product
  form erased the product's customer when saved on first open; the order form
  set state inside useMemo; three planning modals' backlog memo missed
  removedRows. React-Compiler-only rules downgraded to warnings (app does not
  use the compiler) after review.
- [x] **History/Activity screens (step E)** (2026-11-05) — GET /api/activity
  (whole feed: admin only; `?orderId=`: any logged-in user, includes the
  order's deleted plans; IST day filters; paging). Admin > Activity page with
  filters; a History section in the View Order window. Tests:
  tests/qa/activity.test.mjs (14). Full suite 163/163.
  - Redesigned 2026-11-06: history is on demand - a small "History" button
    (View Order header, Finished Stock rows, every saved plan row in the four
    planning modals and Tracking) opens a slide-over panel: a timeline grouped
    by day with initials on a "pour line", one line per change, tap for
    details. Important changes (deletions; stock adjustments incl. inspection
    corrections/undos; planned quantity moved 25%+; order products or delivery
    date changed) get an amber tag naming why, a Highlights strip and an
    "Important only" switch. Stock movements are part of the timeline; the
    stock count form sits in the product panel. API: ?entityId=, ?productId=,
    type=stock, important=1. Tests: 25 activity checks; full suite 174/174.
- [ ] **Sessions survive a password change** — a login cookie stays valid for
  7 days even after the password is reset or the user is deactivated
  (backlog 0d).
- [ ] **`pnpm lint` does not run** — the script calls `eslint`, which is not
  installed. Pre-existing.

---

## Phase 3 — Cart ordering — DONE 2026-11-05 (history below kept for context)

Full plan: [MIGRATION-PLAN-cart-ordering.md](./MIGRATION-PLAN-cart-ordering.md)

**Why deferred:** touches 5 API routes, 3 of which write production records and
adjust stock, plus a UI change TypeScript cannot verify. Deferred to bank the
current tested build rather than because it does not matter.

**Why it still matters:** `item_id` is `${orderId}-${cartIndex}`, and the cart
relation is loaded with no ordering. Worse than first assessed — the Knockout
backlog keys its quantity maths off the *representative* cart index, so a
reshuffle would compute requirements against the wrong product, not merely
mislabel one.

**Current risk level — measured, not assumed:** editing an order does
`DELETE all cart rows` then `INSERT` from the incoming array. Today that
round-trips consistently (client reads physical order, sends it back, rows are
re-laid in that order), so the mechanism exists but is not firing. It becomes
materially more likely with more cart rows or any bulk data operation.

**Interim safeguard:** avoid editing the cart of any order that already has
production plans against it. That is the only action that can trigger a
reshuffle.

Steps: add `position` column → backfill from `ctid` → `orderBy: position` on all
5 call sites → set `position` on insert (create *and* update paths) → block
reordering/removal in the Orders UI once plans exist.

---

## Remaining backlog

Bigger pieces, each needing its own plan.

- [ ] **Enforce roles on API routes** — only 2 of 22 check role; `proxy.ts`
  guards one path. Role restrictions currently exist only in the browser.
  Requires deciding which roles may perform which mutations.
- [ ] **Optimistic locking** — no version column; concurrent edits are
  last-write-wins.
- [ ] **`item_id` → `order_items.id`** — replace the positional pointer with a
  real foreign key. Follows Phase 3.
- [ ] **Deduplicate the four planning modals** — melt 1393 / core 1068 / mould
  1045 / knockout 1000 lines, ~90% identical. Same fix has had to be applied
  four times over in a single session.
- [ ] **Automated tests** — none exist. Start with the pure functions carrying
  the money logic: `computeCarryForwards`, `shortfallForRow`,
  `generateTimeSlots`, `generateId`.
- [ ] **HTTPS on Azure** — needs a domain. Root cause of the
  `crypto.randomUUID` outage and forces a non-Secure auth cookie.
- [ ] **Install backup automation on Azure** — script is written and verified
  locally; cron entry not yet added.
- [ ] Code health: Phosphor → lucide (Phosphor is deprecated), Server
  Components for initial fetch, `DataTable`/`StatusBadge` abstractions, toast
  for non-blocking confirmations.

---

## Blocking any deploy to Azure

- [ ] **Azure database migrations have NOT been run.** Local is ahead by:
  `variance_reason` column, the uuid/FK conversion, and both indexes. Deploying
  current `main` code against the un-migrated Azure database will 500 on
  production-plans queries.
  Order: verified `pg_dump` → `drizzle-kit push` → build → restart.
