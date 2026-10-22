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

- [ ] **Remove the default-admin fallback** — *parked by the owner until the
  end of the current round, decision pending.*
  `auth.actions.ts` creates `admin` / `admin123` and signs it in whenever the
  users table is empty, and line 66 accepts `admin`/`admin123` outright. The
  existing local `admin` account also still uses `admin123` (verified against
  the hash 2026-10-22).
- [ ] **`pnpm lint` does not run** — the script calls `eslint`, which is not
  installed. Pre-existing.

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
