-- Stock ledger: opening balances (runs AFTER drizzle-kit push, which creates
-- the stock_movements table).
--
-- The ledger starts today. Each product's current stock becomes one
-- 'opening' movement, so products.stock = sum(movements) holds from the
-- start. Idempotent: only products with no movements yet get a row, and
-- products at 0 need none.

INSERT INTO stock_movements (id, at, product_id, product_name, delta, balance_after, reason, note)
SELECT gen_random_uuid(), (now() AT TIME ZONE 'utc'), p.id, p.name, p.stock, p.stock, 'opening',
       'Stock when the ledger started'
FROM products p
WHERE coalesce(p.stock, 0) <> 0
  AND NOT EXISTS (SELECT 1 FROM stock_movements m WHERE m.product_id = p.id);
