# TODO — Pending Changes

Working list, ordered by what to do next. Full evidence for each item lives in
[TECHNICAL-BACKLOG.md](./TECHNICAL-BACKLOG.md); this file is the running queue.

Last updated: 2026-08-06

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

---

## Next up — low risk, no UI impact

Chosen deliberately over Phase 3: these are contained, and none touches the
screens just tested.

- [ ] **Whitelist the `PUT /api/production-plans/[id]` payload**
  Currently copies every key from the request body into the update, so any
  client can set `isConfirmed`, `quantityScheduled`, `isPending`. Same
  permissiveness silently swallowed `actualMeltWeight` for months. Zod schema
  per route, reject unknown fields loudly.

- [ ] **Date-scope `GET /api/production-plans`**
  Returns the entire table with no filter; Planning and Tracking both fetch
  every plan ever created and refetch all of it after every save. 54 rows
  today, an outage at 50k. Accept `?from=&to=&stage=`.

- [ ] **Remove the default-admin fallback**
  `auth.actions.ts` creates `admin` / `admin123` and signs it in whenever the
  users table is empty. ~10 lines to delete; seed the first admin with a script.

- [ ] **Add `error.tsx` and `loading.tsx`**
  Neither exists anywhere in `src/app`. No error boundary at all — an unhandled
  render error drops the user on Next's default page. Purely additive.

- [ ] **Remove dead dependencies**
  `@reduxjs/toolkit`, `react-redux`, `i18next`, `react-i18next`, `docx`,
  `lucide-react` — 0 usages each. (`shadcn` is NOT dead: `globals.css` imports
  `shadcn/tailwind.css`.)

---

## Phase 3 — Cart ordering (deferred, deliberately)

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
