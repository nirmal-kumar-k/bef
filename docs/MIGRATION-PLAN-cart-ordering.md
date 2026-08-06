# Migration Plan — Deterministic Cart Ordering (`order_items.position`)

Status: **DRAFT — nothing has been executed.** Written for review.
Date: 2026-08-06

---

## The problem

`production_plans.item_id` is the string `` `${orderId}-${cartIndex}` `` — a
**positional** pointer. Every screen resolves the product with
`order.cart[idx]`.

That array comes from a Drizzle relation with **no ordering**:

```ts
// src/app/api/orders/route.ts
db.query.orders.findMany({
  with: { cart: true },                                   // <- no orderBy
  orderBy: (orders, { desc }) => [desc(orders.createdAt)] // <- orders, not cart
})
```

The `orderBy` applies to **orders**, not to the cart relation. Postgres makes no
guarantee about row order without an explicit `ORDER BY`; today it returns
physical order, which can change after an `UPDATE` or `VACUUM`.

If that order ever shifts, every production plan for the affected order silently
starts attributing quantities to a **different product** — no error, nothing
visible in the UI.

### Why `ORDER BY id` is not the fix

`order_items` has no column recording entry position:

```
id, order_id, product, product_name, quantity,
delivery_quantity, weight, rate_per_kg, unit_cost
```

No `position`, no `created_at`, and `id` is a random UUID. Ordering by `id`
gives a stable but **arbitrary** order. Verified against real local data:

```
orders with MULTIPLE cart items: 3
  order fc3bca01 (3 items) -> ORDER BY id gives same order? NO
  order 871f260d (2 items) -> yes
  order 66d4ec8d (2 items) -> yes
```

Applying it would reorder `fc3bca01` and repoint its plans at the wrong
products — causing exactly the corruption this migration exists to prevent.

---

## Current state (LOCAL, 2026-08-06)

The order the API returns today, i.e. what every existing `item_id` means:

```
order 20ffd64d
   position 0 : ASPIRE-140-CLOSED (ASPIRE BRACKET CLOSE)
order 63a11692
   position 0 : FISH FRY (FF-BHG)
order 66d4ec8d
   position 0 : ASPIRE-140-CLOSED (ASPIRE BRACKET CLOSE)
   position 1 : ASPIRE-140-OPEN (ASPIRE BRACKET OPEN)
order 871f260d
   position 0 : ASPIRE-140-CLOSED (ASPIRE BRACKET CLOSE)
   position 1 : ASPIRE-140-CLOSED (ASPIRE BRACKET CLOSE)
order fc3bca01
   position 0 : FISH FRY (FF-BHG)
   position 1 : ASPIRE-140-CLOSED (ASPIRE BRACKET CLOSE)
   position 2 : ASPIRE-140-OPEN (ASPIRE BRACKET OPEN)

plans pointing past the end of their cart: 0
```

**The goal is to freeze exactly this ordering**, not to impose a new one.
Azure holds different data and must be captured separately at migration time.

---

## Step 0 — Backup

`scripts/backup-db.sh`, and confirm it verified. This migration rewrites how
every `item_id` resolves; a bad backfill is not correctable by hand.

---

## Step 1 — Capture the current order BEFORE changing anything

Run on the target database and **keep the output**. It is the only record of
what the ordering was, and the only way to check the backfill afterwards.

```sql
SELECT order_id, ctid::text, product_name,
       row_number() OVER (PARTITION BY order_id ORDER BY ctid) - 1 AS current_index
FROM order_items
ORDER BY order_id, ctid;
```

Also confirm no plan already points past the end of its cart (must be 0):

```sql
SELECT count(*) FROM production_plans p
WHERE (SELECT count(*) FROM order_items oi WHERE oi.order_id::text = p.order_id)
      <= (regexp_match(p.item_id, '-([0-9]+)$'))[1]::int;
```

---

## Step 2 — Add and backfill `position`

`ctid` is the physical row location, which is what Postgres returns in the
absence of `ORDER BY`. Backfilling from it therefore records the ordering the
application has *actually* been using, keeping every existing `item_id` valid.

```sql
BEGIN;

ALTER TABLE order_items ADD COLUMN position integer;

-- Freeze today's de-facto order.
WITH ordered AS (
  SELECT id,
         row_number() OVER (PARTITION BY order_id ORDER BY ctid) - 1 AS pos
  FROM order_items
)
UPDATE order_items oi
SET position = ordered.pos
FROM ordered
WHERE oi.id = ordered.id;

ALTER TABLE order_items ALTER COLUMN position SET NOT NULL;

-- Two rows in the same order can never share a position.
ALTER TABLE order_items
  ADD CONSTRAINT order_items_order_position_unique UNIQUE (order_id, position);

COMMIT;
```

### Verify before continuing

This must return the **same product at the same index** as Step 1's output:

```sql
SELECT order_id, position, product_name
FROM order_items ORDER BY order_id, position;
```

If any row differs, roll back (Step 5) — do not proceed.

---

## Step 3 — Code changes

**a. Schema** — `src/infrastructure/database/schema/orders.schema.ts`

```ts
export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  // Cart position, 0-based. production_plans.item_id is `${orderId}-${position}`,
  // so this ordering is load-bearing: change a row's position and every plan
  // for that order silently resolves to a different product.
  position: integer('position').notNull(),
  ...
})
```

**b. Order the relation** — every place the cart is read:

```ts
db.query.orders.findMany({
  with: { cart: { orderBy: (items, { asc }) => [asc(items.position)] } },
  orderBy: (orders, { desc }) => [desc(orders.createdAt)],
})
```

All five call sites must be updated — **every** one of these loads the cart, and
any left unordered can still resolve an index to the wrong product:

```
src/app/api/orders/route.ts:11
src/app/api/orders/[id]/route.ts:14
src/app/api/inspection-submit/route.ts:32
src/app/api/knockout-confirm/route.ts:29
src/app/api/production-plans/_inspection-stock-sync.ts:15
```

The last three matter as much as the first two: `inspection-submit` and
`knockout-confirm` write production records, and `_inspection-stock-sync`
adjusts product stock — all keyed off the cart index. An unordered read there
corrupts stock levels rather than just a display name.

**c. Set `position` on insert** — `src/app/api/orders/route.ts`, where cart lines
are inserted, add `position: index` from the incoming array order.

**d. Editing an order** must preserve or explicitly renumber positions. This is
the risk point: the current update path deletes and re-inserts cart lines. If
re-inserted in a different order, positions change and existing plans repoint.
**Needs review before this migration is considered complete.**

---

## Step 4 — Verification

1. `npx tsc --noEmit` and `npx next build`
2. Open an order with multiple cart lines — items appear in the same order as before
3. Open Production Planning for a date with plans against that order — the same
   product names appear against the same rows as before the migration
4. Re-run Step 2's verification query and compare with Step 1's captured output

---

## Step 5 — Rollback

```sql
BEGIN;
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_order_position_unique;
ALTER TABLE order_items DROP COLUMN IF EXISTS position;
COMMIT;
```

Then revert the code commit. Because the backfill only *records* the existing
order rather than changing it, dropping the column returns the system to exactly
its prior behaviour.

---

## Decisions needed

1. **Ordering source for the backfill.** `ctid` (physical order) is what the app
   currently returns, so it preserves existing meaning. The alternative — asking
   you to specify the correct order per multi-item order by hand — is safer in
   theory but only practical because there are 3 such orders locally. Azure may
   have more.
2. **Step 3d, order editing.** Whether to renumber on edit, or forbid reordering
   an order's cart once production plans exist against it. This is a product
   decision, not a technical one.
3. **Scope.** Do this before, after, or together with the foreign-key migration?
   They touch different tables and are independent, but both want a backup and a
   quiet moment.
