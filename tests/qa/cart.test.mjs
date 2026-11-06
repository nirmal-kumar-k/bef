// Cart ordering (order_items.position) and the planned-line edit guard.
import { sql, session, call, check, done, newId } from './_lib.mjs'

const A = await session('admin')
const apiOrders = async () => (await call(A, 'GET', '/api/orders')).body
const cartProducts = o => (o.cart || []).map(l => l.product)

// ---- the migration froze the existing order, gap-free
const gaps = await sql`select order_id from order_items group by order_id having max(position) <> count(*) - 1 or min(position) <> 0`
check('every order\'s lines are numbered 0..n-1 with no gaps', gaps.length === 0, `${gaps.length} order(s) with gaps`)
const dbOrder = await sql`select order_id, array_agg(product order by position) as products from order_items group by order_id`
const list = await apiOrders()
const mismatched = dbOrder.filter(r => JSON.stringify(cartProducts(list.find(o => o.id === r.order_id) || {})) !== JSON.stringify(r.products))
check('the API returns every cart in position order', mismatched.length === 0, `${mismatched.length} mismatched`)

// ---- scramble the PHYSICAL order: the API and the stock path must not care
const [multi] = await sql`
  select o.id from orders o
  where (select count(distinct oi.product) from order_items oi where oi.order_id = o.id) >= 2
    and (select count(*) from order_items oi join products p on p.name = oi.product_name or p.code = oi.product where oi.order_id = o.id and oi.position = 0) = 1
  limit 1`
if (multi) {
  const before = (await sql`select array_agg(product order by position) as p from order_items where order_id = ${multi.id}`)[0].p
  const physBefore = (await sql`select product from order_items where order_id = ${multi.id} order by ctid`).map(r => r.product)
  // An UPDATE writes a new row version at the end of the table: line 0 moves physically last.
  await sql`update order_items set quantity = quantity where order_id = ${multi.id} and position = 0`
  const physAfter = (await sql`select product from order_items where order_id = ${multi.id} order by ctid`).map(r => r.product)
  check('scramble worked: physical row order of the test order changed', JSON.stringify(physBefore) !== JSON.stringify(physAfter), `${physBefore} -> ${physAfter}`)
  const viaApi = cartProducts((await call(A, 'GET', `/api/orders/${multi.id}`)).body)
  check('after the scramble the API still returns the original order', JSON.stringify(viaApi) === JSON.stringify(before), viaApi.join(' | '))

  // Inspection on line 0 must credit line 0's product, not whatever is physically first.
  const [line0] = await sql`select p.id, coalesce(p.stock,0)::int stock from order_items oi join products p on p.name = oi.product_name or p.code = oi.product where oi.order_id = ${multi.id} and oi.position = 0 limit 1`
  const others = await sql`select p.id, coalesce(p.stock,0)::int stock from products p where p.id <> ${line0.id}`
  const itemId = `${multi.id}-0`
  await sql`insert into production_plans (date, order_id, item_id, stage, quantity_scheduled) values ('2026-12-10', ${multi.id}, ${itemId}, 'Knockout', 4)`
  const [{ avail }] = await sql`select (coalesce(sum(quantity_scheduled) filter (where stage='Knockout'),0) - coalesce(sum(coalesce(quantity_scheduled,0)+coalesce(rejected_quantity,0)) filter (where stage='Inspection'),0))::int avail from production_plans where item_id = ${itemId}`
  const ins = await call(A, 'POST', '/api/inspection-submit', { itemId, orderId: multi.id, patternRef: 'T', totalAvailable: avail, rejectedQty: 0, reason: '' })
  const after0 = (await sql`select coalesce(stock,0)::int s from products where id = ${line0.id}`)[0].s
  const othersAfter = await sql`select p.id, coalesce(p.stock,0)::int stock from products p where p.id <> ${line0.id}`
  const othersSame = others.every(o => othersAfter.find(x => x.id === o.id)?.stock === o.stock)
  check('after the scramble, inspecting line 0 credits line 0\'s product only', ins.status === 200 && after0 === line0.stock + avail && othersSame, `${line0.stock} -> ${after0} (+${avail})`)
} else {
  check('scramble test needs an order with 2+ different products (none found)', false)
}

// ---- new order: positions follow the submitted list
const line = (product, qty = 10) => ({ product, productName: `${product} name`, quantity: qty, deliveryQuantity: 0, weight: 1, ratePerKg: 1, unitCost: 1 })
const id = await newId()
const create = await call(A, 'POST', '/api/orders', { id, customerOrderNo: 'CART-TEST', customer: 'Cart', cart: [line('P-A'), line('P-B'), line('P-C')] })
const pos = await sql`select product, position from order_items where order_id = ${id} order by position`
check('new order: positions 0,1,2 in the submitted order', create.status === 201 && JSON.stringify(pos.map(r => [r.product, r.position])) === '[["P-A",0],["P-B",1],["P-C",2]]')
check('...and the response lists them in that order', JSON.stringify(cartProducts(create.body)) === '["P-A","P-B","P-C"]')

// unplanned order: anything goes
const free = await call(A, 'PUT', `/api/orders/${id}`, { cart: [line('P-C'), line('P-A'), line('P-B')] })
check('an order with NO plans can be freely reordered', free.status === 200 && JSON.stringify(cartProducts(free.body)) === '["P-C","P-A","P-B"]')
await call(A, 'PUT', `/api/orders/${id}`, { cart: [line('P-A'), line('P-B'), line('P-C')] })

// plan against line 1 (P-B)
await call(A, 'POST', '/api/production-plans', { date: '2026-12-11', orderId: id, itemId: `${id}-1`, stage: 'Core', quantityScheduled: 5 })
const cartNow = async () => (await sql`select array_agg(product order by position) p from order_items where order_id = ${id}`)[0].p
const put = cart => call(A, 'PUT', `/api/orders/${id}`, { cart })

let r = await put([line('P-A'), line('P-B', 99), line('P-C')])
check('planned line: changing its quantity is allowed', r.status === 200 && (await sql`select quantity from order_items where order_id = ${id} and position = 1`)[0].quantity === 99)
r = await put([line('P-A'), line('P-B'), line('P-C'), line('P-D')])
check('adding a line at the end is allowed', r.status === 200 && JSON.stringify(await cartNow()) === '["P-A","P-B","P-C","P-D"]')
r = await put([line('P-A'), line('P-B'), line('P-C')])
check('removing an unplanned line at the end is allowed', r.status === 200 && (await cartNow()).length === 3)

r = await put([line('P-B'), line('P-C')])
check('removing a line BEFORE a planned one (shifts it) is refused', r.status === 409 && /line 2 \(P-B\)/.test(r.body.error || ''), r.body.error?.slice(0, 80))
check('...and the cart was not changed', JSON.stringify(await cartNow()) === '["P-A","P-B","P-C"]')
r = await put([line('P-A'), line('P-X'), line('P-C')])
check('changing a planned line to another product is refused', r.status === 409)
r = await put([line('P-A'), line('P-C'), line('P-B')])
check('moving a planned line is refused', r.status === 409)
r = await put([line('P-A')])
check('removing a planned line is refused', r.status === 409)
r = await put([line('P-A'), line('P-B')])
check('removing an unplanned line AFTER a planned one is allowed', r.status === 200 && JSON.stringify(await cartNow()) === '["P-A","P-B"]')
const [plan] = await sql`select item_id from production_plans where order_id = ${id}`
check('the plan still points at P-B after all allowed edits', (await cartNow())[Number(plan.item_id.split('-').pop())] === 'P-B')

await call(A, 'DELETE', `/api/orders/${id}?force=true`)
await done()
