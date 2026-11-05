-- Deterministic cart ordering: order_items.position
-- (docs/MIGRATION-PLAN-cart-ordering.md, step 2).
--
-- production_plans.item_id is `${orderId}-${cartIndex}`. The cart used to be
-- read with no ORDER BY, i.e. in physical row order (ctid). This freezes
-- exactly that order into a real column, so every existing item_id keeps
-- resolving to the same product. Idempotent: does nothing if already applied.
-- Must run BEFORE `drizzle-kit push` on a database that lacks the column.

BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'position'
  ) THEN
    ALTER TABLE order_items ADD COLUMN position integer;

    WITH ordered AS (
      SELECT id, row_number() OVER (PARTITION BY order_id ORDER BY ctid) - 1 AS pos
      FROM order_items
    )
    UPDATE order_items oi SET position = ordered.pos FROM ordered WHERE oi.id = ordered.id;

    ALTER TABLE order_items ALTER COLUMN position SET NOT NULL;
    ALTER TABLE order_items ADD CONSTRAINT order_items_order_position_unique UNIQUE (order_id, position);
  END IF;
END $$;
COMMIT;
