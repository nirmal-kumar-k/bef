# Migration Plan — Referential Integrity for `production_plans`

Status: **DRAFT — nothing has been executed.** Written for review.
Date: 2026-08-06

---

## Why this is needed

`production_plans` is the **only** table in the schema without referential
integrity. Every other table already uses `uuid` keys with proper constraints:

| Table | Key columns | Constrained |
|---|---|---|
| `order_items` | `order_id uuid` | ✅ FK → orders, ON DELETE CASCADE |
| `shift_breaks` | `shift_id uuid` | ✅ FK → shifts, ON DELETE CASCADE |
| `pattern_core_boxes` | `pattern_id uuid` | ✅ FK → patterns, ON DELETE CASCADE |
| `pattern_products` | `pattern_id uuid` | ✅ FK → patterns, ON DELETE CASCADE |
| **`production_plans`** | `order_id **text**`, `equipment_id **text**`, `shift_id **text**`, `item_id **text**` | ❌ **none** |

Because the columns are `text` while the referenced `id`s are `uuid`, a foreign
key cannot be added without changing the column type first. Integrity is
currently maintained only by hand-written cleanup in the order-delete route —
any code path that forgets it leaves silent orphans.

---

## Pre-flight results (LOCAL database, 2026-08-06)

```
production_plans.order_id      total=54  null=0  not-a-uuid=0
production_plans.equipment_id  total=54  null=8  not-a-uuid=0
production_plans.shift_id      total=54  null=1  not-a-uuid=0
order_id pointing at a missing order: 0
```

Local data is clean and would migrate without loss.
**These same checks MUST be re-run on Azure before touching it** — Azure holds
different data and has never been validated.

---

## Step 0 — Backup (mandatory, not optional)

There is currently **no backup automation at all**. Do not alter column types on
production without one.

```bash
# On the Azure VM
cd ~/babufoundry
export DB_URL=$(grep DATABASE_URL .env.local | cut -d '=' -f2-)

# Full logical backup, timestamped
pg_dump "$DB_URL" -Fc -f ~/bef-backup-$(date +%F-%H%M).dump

# Verify it is readable and non-trivial in size
ls -lh ~/bef-backup-*.dump
pg_restore --list ~/bef-backup-*.dump | head
```

A backup you have not verified is not a backup. `pg_restore --list` proves the
file parses.

---

## Step 1 — Pre-flight validation ON AZURE

Run before anything else. If any count is non-zero, **stop** and report back —
the migration would fail or silently drop data.

```sql
-- 1. Values that are not valid UUIDs (must all be 0)
SELECT
  count(*) FILTER (WHERE order_id     IS NOT NULL AND order_id     !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') AS bad_order_id,
  count(*) FILTER (WHERE equipment_id IS NOT NULL AND equipment_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') AS bad_equipment_id,
  count(*) FILTER (WHERE shift_id     IS NOT NULL AND shift_id     !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') AS bad_shift_id
FROM production_plans;

-- 2. Orphans: references to rows that no longer exist (must all be 0)
SELECT
  (SELECT count(*) FROM production_plans p WHERE p.order_id     IS NOT NULL AND NOT EXISTS (SELECT 1 FROM orders    o WHERE o.id::text = p.order_id))     AS orphan_orders,
  (SELECT count(*) FROM production_plans p WHERE p.equipment_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM equipment e WHERE e.id::text = p.equipment_id)) AS orphan_equipment,
  (SELECT count(*) FROM production_plans p WHERE p.shift_id     IS NOT NULL AND NOT EXISTS (SELECT 1 FROM shifts    s WHERE s.id::text = p.shift_id))     AS orphan_shifts;
```

**If orphans exist**, they must be resolved first — either deleted, or the FK
added as `NOT VALID` and cleaned up later. That is a decision, not a default.

---

## Step 2 — The migration

Runs in a single transaction: it either fully applies or fully rolls back.

```sql
BEGIN;

-- Empty strings are not valid UUIDs; normalise them to NULL first.
UPDATE production_plans SET equipment_id = NULL WHERE equipment_id = '';
UPDATE production_plans SET shift_id     = NULL WHERE shift_id     = '';
UPDATE production_plans SET order_id     = NULL WHERE order_id     = '';

-- Convert text -> uuid
ALTER TABLE production_plans
  ALTER COLUMN order_id     TYPE uuid USING order_id::uuid,
  ALTER COLUMN equipment_id TYPE uuid USING equipment_id::uuid,
  ALTER COLUMN shift_id     TYPE uuid USING shift_id::uuid;

-- Referential integrity, with deliberate delete behaviour (see decisions below)
ALTER TABLE production_plans
  ADD CONSTRAINT production_plans_order_id_fk
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  ADD CONSTRAINT production_plans_equipment_id_fk
    FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE SET NULL,
  ADD CONSTRAINT production_plans_shift_id_fk
    FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL;

-- Indexes (backlog item 9). FK columns are not indexed automatically in
-- Postgres, and every screen filters on date/stage.
CREATE INDEX IF NOT EXISTS production_plans_date_stage_idx ON production_plans (date, stage);
CREATE INDEX IF NOT EXISTS production_plans_order_id_idx   ON production_plans (order_id);

COMMIT;
```

### Decisions required before running — these are yours, not defaults

| Column | Proposed | What it means | Alternative |
|---|---|---|---|
| `order_id` | `ON DELETE CASCADE` | Deleting an order deletes its production plans. **Matches what the app already does by hand** in the order-delete route. | `RESTRICT` — deleting an order with plans is blocked, forcing an explicit decision |
| `equipment_id` | `ON DELETE SET NULL` | Retiring a machine keeps the production history, just unlinks the machine | `RESTRICT` — cannot delete equipment that has ever been used |
| `shift_id` | `ON DELETE SET NULL` | Deleting a shift keeps the history | `RESTRICT` |

I recommend the proposed column because it preserves production history —
deleting a machine should never erase the record of what it produced.

---

## Step 3 — Update the Drizzle schema to match

`production-plans.schema.ts` must change from `text(...)` to `uuid(...)` with
`.references(...)`, otherwise the next `drizzle-kit push` will try to revert the
database to `text`.

```ts
orderId: uuid('order_id').references(() => orders.id, { onDelete: 'cascade' }),
equipmentId: uuid('equipment_id').references(() => equipment.id, { onDelete: 'set null' }),
shiftId: uuid('shift_id').references(() => shifts.id, { onDelete: 'set null' }),
```

**Verify afterwards** that `drizzle-kit push` reports *no changes* — that
confirms schema and database agree.

### Application impact to check
- `orderId` becomes nullable in TypeScript. Anywhere it is treated as a
  guaranteed string will now be flagged by `tsc` — that is the point.
- The order-delete route's manual plan cleanup becomes redundant. It can stay
  (harmless) or be removed once the FK is trusted.

---

## Rollback

If Step 2 fails it rolls back on its own. If a problem is found *after* commit:

```sql
BEGIN;
ALTER TABLE production_plans
  DROP CONSTRAINT IF EXISTS production_plans_order_id_fk,
  DROP CONSTRAINT IF EXISTS production_plans_equipment_id_fk,
  DROP CONSTRAINT IF EXISTS production_plans_shift_id_fk;
ALTER TABLE production_plans
  ALTER COLUMN order_id     TYPE text USING order_id::text,
  ALTER COLUMN equipment_id TYPE text USING equipment_id::text,
  ALTER COLUMN shift_id     TYPE text USING shift_id::text;
COMMIT;
```

Then revert the Drizzle schema commit. Full recovery path remains the Step 0 dump.

---

## NOT in this migration — `item_id` (needs its own plan)

`item_id` cannot be made a foreign key as it stands, and the reason is a real
latent bug rather than a style problem.

**What it is today:** the string `` `${orderId}-${cartIndex}` `` — a *positional*
pointer into the cart array. Every screen resolves the product with
`order.cart[idx]`.

**Why that is unsafe:** `orders` has no `cart` column. `cart` is a Drizzle
relation to `order_items`, assembled per request:

```ts
db.query.orders.findMany({
  with: { cart: true },                                   // <- no ordering
  orderBy: (orders, { desc }) => [desc(orders.createdAt)] // <- orders, not cart
})
```

The `orderBy` applies to **orders**, not to the cart relation, so the order of
`order_items` rows is **not guaranteed by Postgres**. Row order can change after
an UPDATE or a VACUUM. If it ever does, every production plan for that order
silently starts attributing quantities to a **different product** — with no
error and nothing in the UI to reveal it.

### ⚠️ Correction: adding `ORDER BY id` is NOT a safe fix

An earlier draft of this document called this a one-line change. **That was
wrong and would have caused the exact corruption described above.**

`order_items` has no column recording cart position — its columns are
`id, order_id, product, product_name, quantity, delivery_quantity, weight,
rate_per_kg, unit_cost`. There is no `position`, no `created_at`, nothing
sequential, and `id` is a random UUID.

So `ORDER BY id` imposes a *stable but arbitrary* order, not the order the
items were entered in. Tested against real local data:

```
orders with MULTIPLE cart items: 3
  order fc3bca01 (3 items) -> ORDER BY id gives same order? NO
  order 871f260d (2 items) -> yes
  order 66d4ec8d (2 items) -> yes

1 of 3 multi-item orders would be REORDERED
```

Because `item_id` is `${orderId}-${index}`, reordering that order silently
repoints every one of its production plans at a different product.

### The actual fix (its own migration)

1. Add a `position` integer column to `order_items`.
2. **Backfill from the current physical order**, freezing today's de-facto
   ordering so every existing `item_id` stays valid.
3. Apply `orderBy: position` to the cart relation.
4. Set `position` on insert from then on.
5. *Later, optionally:* repoint `item_id` at `order_items.id` and add a real FK.
   This touches every component that parses `itemId`.

Today's ordering is stable in practice (physical order, no updates to cart rows
yet) — the risk is that nothing guarantees it stays that way.

---

## Execution order

1. **Backup** (Step 0) — and verify it
2. **Pre-flight checks on Azure** (Step 1) — report results before continuing
3. **Migration** (Step 2) — only if pre-flight is all zeros
4. **Drizzle schema update** (Step 3) + typecheck + build
5. **Cart `position` column** — separate migration, see above. Deliberately NOT
   bundled here: it needs its own backfill and carries its own risk.
6. `item_id` → `order_items.id` — later still, separate plan again.
