# BEF — Technical Backlog

Findings from a full codebase audit on 2026-08-06. Ordered by what actually hurts,
not by effort. Every item states the evidence it was found on, so nothing here has
to be re-derived later.

Status key: `[ ]` open · `[~]` in progress · `[x]` done

---

## P0 — Security

Nothing here is theoretical; each was verified against the running code or database.

### [ ] 1. API routes do not enforce roles
**Evidence:** only 2 of 22 route files reference `role`; `proxy.ts` guards exactly one
path (`ADMIN_ONLY_PATHS = ['/users']`). Meanwhile 10 UI files gate features on
`useRole`.
**Impact:** role restrictions exist only in the browser. Any authenticated user can
call delete/update endpoints directly (orders, production plans, equipment, day
closures) regardless of what the UI shows them.
**Fix:** a shared `requireRole()` helper used by every mutating route
(POST/PUT/DELETE). Read the session with the existing `getSessionUser()`.
**Risk:** low — additive guard. Must audit which roles legitimately need which
mutation before enforcing, or it will lock out real users.

### [ ] 2. Mass assignment on `PUT /api/production-plans/[id]`
**Evidence:** the route strips only `id`/`createdAt`/`updatedAt`, then copies every
remaining key into the update.
**Impact:** a client can set any column — `isConfirmed`, `quantityScheduled`,
`isPending`, `carriedForwardFromDate`. Reachable by any logged-in user, since
Tracking calls this route. This also silently swallowed `actualMeltWeight` for months
(see item 14's history).
**Fix:** explicit allow-list of updatable fields per stage. Reject unknown keys
loudly rather than ignoring them.
**Also check:** the same pattern in other PUT/POST routes.

### [ ] 3. Default admin auto-creation runs in production
**Evidence:** `auth.actions.ts` — if `userCount === 0`, it creates `admin` /
`admin123` and signs that session straight in.
**Impact:** if the users table is ever emptied, or a fresh database is pointed at the
app, anyone who guesses those credentials owns the system. On a plain-HTTP public IP
this is a full takeover.
**Fix:** delete the fallback; seed the first admin with a one-off script instead.

### [ ] 4. Production is served over plain HTTP
**Evidence:** `20.238.27.79` with no TLS; nginx present but not terminating HTTPS.
**Impact:** credentials and the session cookie cross the network in clear text. It is
also the root cause of the `crypto.randomUUID` outage — that API only exists in
secure contexts — and forces the auth cookie to be non-Secure.
**Fix:** domain name → nginx + Let's Encrypt. Once `X-Forwarded-Proto: https`
arrives, `isRequestSecure()` switches to Secure cookies on its own, no code change.

---

## P1 — Data integrity

### [ ] 5. `production_plans` has no foreign keys, and cannot have one as-is
**Evidence:** 4 FKs exist in the whole schema (shift_breaks, pattern_core_boxes,
pattern_products, order_items). `production_plans.order_id` is `text` while
`orders.id` is `uuid` — the two cannot even be joined without a cast.
**Impact:** referential integrity is enforced only by hand-written cleanup in the
order delete route. Any path that misses it leaves silent orphans. (Currently 0
orphans — the app-level cleanup works, but nothing guarantees it.)
**Fix:** migrate `order_id`/`equipment_id`/`shift_id` to `uuid`, then add FKs with
`ON DELETE CASCADE`. Needs a data migration and careful testing — not a quick win.

### [ ] 6. No optimistic locking on plan updates
**Evidence:** no version column, no `If-Match`, no conditional `where` on
`updatedAt`.
**Impact:** two supervisors editing the same day silently overwrite each other, last
write wins. Realistic where day and night shift overlap.
**Fix:** a `version` integer bumped on write, with the update conditioned on the
version the client read. Surface a "changed elsewhere, reload" message on conflict.

### [ ] 7. `itemId` is a positional string
**Evidence:** convention is `${orderId}-${cartIndex}`, parsed back via
`split('-')` in several components.
**Impact:** reordering or deleting a cart line silently repoints every existing
plan's `itemId` at a different product. Nothing prevents or detects this.
**Fix:** give cart items stable ids and reference those.

---

## P1 — Scaling

### [ ] 8. `GET /api/production-plans` returns the entire table
**Evidence:** no filter, no pagination. Both `/production` and `/production-planning`
fetch every plan ever created and filter client-side — and refetch all of it after
every single save.
**Impact:** invisible at 54 rows; a multi-megabyte payload per interaction at 50k.
This is the item most likely to become a hard outage as real data accumulates.
**Fix:** accept `?from=&to=&stage=` and scope the query. Client already knows the
date range it needs.

### [ ] 9. No indexes beyond primary keys
**Evidence:** `pg_indexes` shows only `*_pkey` on production_plans, orders,
production_day_closures.
**Impact:** every filter on `date`, `stage`, `order_id` is a full table scan.
**Fix:** composite index on `(date, stage)` and one on `order_id`. Minutes of work,
purely additive.

### [ ] 10. Saves are sequential
**Evidence:** `handleSaveDayPlan` uses `for … await fetch` — one round trip per row.
**Impact:** a 20-row day is 20 serial requests.
**Fix:** `Promise.all`, or better a batch endpoint that writes the day in one
transaction (which would also make a partially-failed save impossible).

---

## P1 — Reliability

### [ ] 11. Fetch results are widely discarded
**Evidence:** 50 `await fetch` calls across the client; 11 discard the response
entirely without checking `res.ok`.
**Impact:** a rejected write looks identical to a successful one. This has already
caused two production bugs this month — Melt rows lost to a 500 with no error shown,
and a List input displaying a value that never persisted.
**Fix:** a small `apiFetch()` wrapper that throws on non-ok and is used everywhere.

### [ ] 12. No `error.tsx` or `loading.tsx` anywhere
**Evidence:** zero of either in `src/app`.
**Impact:** no error boundary at all — an unhandled render error drops the user on
Next's default screen, which is exactly the "this page couldn't load" experience.
Every page also hand-rolls its own loading string.
**Fix:** route-level `error.tsx` + `loading.tsx`. Purely additive, cannot regress
existing behaviour.

### [ ] 13. Zero automated tests
**Evidence:** no jest/vitest/playwright, no test files.
**Impact:** every regression this month was found manually, in the browser, by the
user.
**Fix:** start with the pure functions where the money logic lives —
`computeCarryForwards`, `shortfallForRow`, `generateTimeSlots`, `generateId`. Cheap,
no UI harness needed, and covers the code most expensive to get wrong.

---

## P2 — Code health

### [ ] 14. The four planning modals are near-duplicates
**Evidence:** melt 1393 lines, core 1068, mould 1045, knockout 1000. Core/Mould/
Knockout are ~90% identical.
**Impact:** the same fix has had to be applied to all four files three separate times
in one session (native dialogs → themed, `crypto.randomUUID` → `generateId`,
unsaved-changes guards). The duplication actively manufactures bugs.
**Fix:** extract the shared scheduling-grid logic into a hook + shared components.
Highest value of anything here, and the highest risk — this is the most bug-prone
code in the app. Deserves a dedicated pass, not a drive-by.

### [ ] 15. Dead dependencies
**Evidence:** 0 usages each of `@reduxjs/toolkit`, `react-redux`, `i18next`,
`react-i18next`, `docx`, `lucide-react`.
**Fix:** remove after a confirming grep.

### [ ] 16. Phosphor icons are deprecated
**Evidence:** deprecation hints on every icon import; `lucide-react` is already
installed and unused.
**Fix:** migrate the 36 files to lucide, or drop lucide. Mechanical either way.

### [ ] 17. Data fetching is entirely client-side
**Evidence:** 5 pages fetch in `useEffect`; 24 files are `'use client'`.
**Impact:** larger JS bundle, slower first paint, manual loading states everywhere.
**Fix:** server-render initial data, hydrate for interaction. Realistic gain is
limited to initial load since these screens are heavily interactive — moderate
effort, deferred payoff.

### [ ] 18. Repeated table and badge markup
**Fix:** a `DataTable` wrapper (sorting/empty/loading) and a `StatusBadge` mapping
status → colour, both used across Orders/Planning/Tracking.

### [ ] 19. Blocking dialogs used for non-blocking messages
**Evidence:** "Day Closed — 3 items carried forward" is a modal requiring dismissal.
**Fix:** a toast for confirmations; keep the dialog for genuine decisions.

---

## P2 — Operations

### [ ] 20. No backup automation
**Evidence:** no `pg_dump` or backup script anywhere in the repo.
**Impact:** a production database holding real order and production history with no
verified recovery path.
**Fix:** scheduled `pg_dump` with retention, and a documented restore that has
actually been tested once.

### [ ] 21. Azure migration outstanding for `variance_reason`
The column exists locally but not on Azure. `npx drizzle-kit push` on the VM before
the shortfall-reason work is deployed, or those queries will 500.

---

## Verified healthy

Worth recording so it is not re-investigated:

- `.env.local` correctly gitignored; **no secrets in git history** (full history checked)
- `JWT_SECRET` is 96 characters
- bcrypt cost factor 10
- Cookies are `httpOnly` + `sameSite=lax`
- 0 orphaned `production_plans` rows at time of audit
