// Stock ledger: every stock change is a movement; products.stock always equals
// the sum of its movements; product saves can no longer overwrite stock.
import { sql, twoUsers, call, check, done, newId, singleLineOrder } from './_lib.mjs'

const [A, B] = await twoUsers() // A = admin, B = the other account
const fx = await singleLineOrder()
const stockOf = async id => (await sql`select coalesce(stock,0)::int s from products where id = ${id}`)[0].s
const movesOf = async id => sql`select * from stock_movements where product_id = ${id} order by at, balance_after`
const invariantBroken = async () => sql`
  select p.name, coalesce(p.stock,0) stock, coalesce(sum(m.delta),0)::int ledger
  from products p left join stock_movements m on m.product_id = p.id
  group by p.id, p.name, p.stock having coalesce(p.stock,0) <> coalesce(sum(m.delta),0)`

// ---- migration: opening balances
const bad0 = await invariantBroken()
check('after the opening-balance migration: stock = sum of movements for EVERY product', bad0.length === 0, bad0.map(b => `${b.name}: ${b.stock} vs ${b.ledger}`).join('; '))
const [{ n: openings }] = await sql`select count(*)::int n from stock_movements where reason = 'opening'`
const [{ n: nonZero }] = await sql`select count(*)::int n from products where coalesce(stock,0) <> 0 and id in (select product_id from stock_movements where reason='opening')`
check('one opening movement per product that had stock', openings === nonZero, `${openings} openings`)

// ---- inspection
const avail = async () => (await sql`select (coalesce(sum(quantity_scheduled) filter (where stage='Knockout'),0) - coalesce(sum(coalesce(quantity_scheduled,0)+coalesce(rejected_quantity,0)) filter (where stage='Inspection'),0))::int a from production_plans where item_id = ${fx.itemId}`)[0].a
await sql`insert into production_plans (date, order_id, item_id, stage, quantity_scheduled) values ('2026-12-20', ${fx.orderId}, ${fx.itemId}, 'Knockout', 12)`
let s0 = await stockOf(fx.productId)
const a = await avail()
const ins = await call(B, 'POST', '/api/inspection-submit', { itemId: fx.itemId, orderId: fx.orderId, patternRef: 'T', totalAvailable: a, rejectedQty: 2, reason: 'scratch' })
let m = (await movesOf(fx.productId)).at(-1)
check('inspection -> "inspection" movement: +accepted, balance, batch, order, who', ins.status === 200 && m.reason === 'inspection' && m.delta === a - 2
  && m.balance_after === s0 + a - 2 && m.plan_id === ins.body.row.id && m.order_id === fx.orderId && m.user_name === B.user.name,
  `${m.reason} ${m.delta} -> ${m.balance_after}`)

// ---- correction and undo (inside the plan's transaction)
const insPlan = ins.body.row
const corr = await call(A, 'PUT', `/api/production-plans/${insPlan.id}`, { quantityScheduled: insPlan.quantityScheduled - 1, rejectedQuantity: 3, rejectionReason: 'recount', version: insPlan.version })
m = (await movesOf(fx.productId)).at(-1)
check('inspection correction -> "inspection_correction" movement of -1', corr.status === 200 && m.reason === 'inspection_correction' && m.delta === -1 && m.plan_id === insPlan.id)
const undo = await call(A, 'DELETE', `/api/production-plans/${insPlan.id}?version=${corr.body.version}`)
m = (await movesOf(fx.productId)).at(-1)
check('inspection undo -> "inspection_undo" movement reversing the batch', undo.status === 200 && m.reason === 'inspection_undo' && m.delta === -(insPlan.quantityScheduled - 1))
check('...and stock is back where it started', (await stockOf(fx.productId)) === s0)

// ---- knockout confirm
const [ko] = await sql`insert into production_plans (date, order_id, item_id, stage, quantity_scheduled, actual_quantity, is_confirmed) values ('2026-12-20', ${fx.orderId}, ${fx.itemId}, 'Knockout', 1, 2, false) returning id`
await call(A, 'POST', '/api/knockout-confirm', { planIds: [ko.id] })
m = (await movesOf(fx.productId)).at(-1)
check('knockout confirm -> "knockout" movement linked to the plan', m.reason === 'knockout' && m.plan_id === ko.id && m.delta > 0)

// ---- product saves can no longer touch stock (the stale-form bug)
const [prod] = await sql`select * from products where id = ${fx.productId}`
const before = await stockOf(fx.productId)
const putP = await call(A, 'PUT', `/api/products/${fx.productId}`, { code: prod.code, name: prod.name, customer: prod.customer, weight: prod.weight, cavities: prod.cavities, grade: prod.grade, remarks: prod.remarks, images: prod.images, linkedPattern: prod.linked_pattern, stock: 99999 })
check('saving the product form with a stale/odd stock value leaves stock untouched', putP.status === 200 && (await stockOf(fx.productId)) === before, `${before} -> ${await stockOf(fx.productId)}`)
const newProdId = await newId()
const postP = await call(A, 'POST', '/api/products', { id: newProdId, code: `QA-${Date.now()}`, name: `QA product ${Date.now()}`, stock: 500 })
check('creating a product ignores a stock value: starts at 0', postP.status === 201 && (await stockOf(newProdId)) === 0)

// ---- manual adjustment
const adjBad1 = await call(B, 'POST', `/api/products/${newProdId}/stock-movements`, { countedStock: 5, note: 'x' })
const adjBad2 = await call(A, 'POST', `/api/products/${newProdId}/stock-movements`, { countedStock: 5, note: '' })
const adjBad3 = await call(A, 'POST', `/api/products/${newProdId}/stock-movements`, { countedStock: -1, note: 'x' })
check('adjustment: non-admin 403, no reason 400, negative count 400', adjBad1.status === (B.user.role === 'admin' ? 200 : 403) && adjBad2.status === 400 && adjBad3.status === 400, `${adjBad1.status}/${adjBad2.status}/${adjBad3.status}`)
const s1 = await stockOf(newProdId)
const adj = await call(A, 'POST', `/api/products/${newProdId}/stock-movements`, { countedStock: s1 + 40, note: 'monthly count' })
m = (await movesOf(newProdId)).at(-1)
check('adjustment to a counted quantity records the difference with the reason', adj.status === 200 && m.reason === 'adjustment' && m.delta === 40 && m.note === 'monthly count' && (await stockOf(newProdId)) === s1 + 40)

// ---- history endpoint reads like a bank statement
const hist = (await call(A, 'GET', `/api/products/${fx.productId}/stock-movements`)).body
const chron = [...hist.movements].reverse()
const chainOk = chron.every((mv, i) => i === 0 || mv.balanceAfter === chron[i - 1].balanceAfter + mv.delta)
check('history: newest first, and every balance = previous balance + change', hist.movements.length >= 4 && new Date(hist.movements[0].at) >= new Date(hist.movements.at(-1).at) && chainOk && chron.at(-1).balanceAfter === hist.product.stock)

// ---- concurrency: mixed simultaneous changes keep the invariant
await sql`insert into production_plans (date, order_id, item_id, stage, quantity_scheduled) select '2026-12-21', ${fx.orderId}, ${fx.itemId}, 'Knockout', 3 from generate_series(1,5)`
const kos = await sql`insert into production_plans (date, order_id, item_id, stage, quantity_scheduled, actual_quantity, is_confirmed) select '2026-12-21', ${fx.orderId}, ${fx.itemId}, 'Knockout', 1, 1, false from generate_series(1,8) returning id`
const a2 = await avail()
await Promise.all([
  ...kos.map(k => call(A, 'POST', '/api/knockout-confirm', { planIds: [k.id] })),
  call(B, 'POST', '/api/inspection-submit', { itemId: fx.itemId, orderId: fx.orderId, patternRef: 'T', totalAvailable: a2, rejectedQty: 0, reason: '' }),
  call(A, 'POST', `/api/products/${newProdId}/stock-movements`, { countedStock: 7, note: 'race' }),
])
const bad1 = await invariantBroken()
check('after a burst of simultaneous changes: stock = sum of movements everywhere', bad1.length === 0, bad1.map(b => `${b.name}: ${b.stock} vs ${b.ledger}`).join('; '))

// ---- deleting a product keeps its ledger
const del = await call(A, 'DELETE', `/api/products/${newProdId}`)
const kept = await sql`select count(*)::int n from stock_movements where product_id is null and product_name like 'QA product %'`
check('deleting a product keeps its history (product link cleared, name kept)', del.status === 200 && kept[0].n >= 2, `${kept[0].n} rows kept`)

await done()
