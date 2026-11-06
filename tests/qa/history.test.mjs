// Change history, who-changed-it and optimistic locking (409 conflicts).
import { sql, twoUsers, call, check, done, newId, singleLineOrder, storedUtc } from './_lib.mjs'

const [A, B] = await twoUsers()
const plan = async id => (await sql`select * from production_plans where id = ${id}`)[0]
const events = async id => sql`select * from audit_events where entity_id = ${id} order by at, version nulls last`

// ---------------- plans
const [p0] = await sql`select * from production_plans where stage = 'Core' and version = 1 and updated_by_name is null order by date desc limit 1`
if (!p0) throw new Error('needs a never-edited Core plan')
const t0 = Date.now()

const a1 = await call(A, 'PUT', `/api/production-plans/${p0.id}`, { quantityScheduled: p0.quantity_scheduled + 1, version: 1 })
let now = await plan(p0.id)
check('A saves with the current version -> 200, version 2', a1.status === 200 && now.version === 2, `${a1.status}`)
check('row records who: A', now.updated_by_name === A.user.name && now.updated_by_id === A.user.id, now.updated_by_name)
let ev = await events(p0.id)
check('one history row: update by A, field quantityScheduled, before/after right',
  ev.length === 1 && ev[0].action === 'update' && ev[0].user_name === A.user.name && ev[0].version === 2
  && JSON.stringify(ev[0].changed_fields) === '["quantityScheduled"]'
  && ev[0].before.quantityScheduled === p0.quantity_scheduled && ev[0].after.quantityScheduled === p0.quantity_scheduled + 1,
  JSON.stringify(ev[0]?.changed_fields))
const at = await storedUtc('audit_events', 'at', `entity_id = '${p0.id}'`)
check('history time stored as real UTC (no 5.5h shift)', Math.abs(at.getTime() - t0) < 60000, `${at.toISOString()} vs ${new Date(t0).toISOString()}`)

const b1 = await call(B, 'PUT', `/api/production-plans/${p0.id}`, { quantityScheduled: 999, version: 1 })
now = await plan(p0.id)
check('B saves with the OLD version -> 409', b1.status === 409, b1.body.error)
check('...conflict names A, with the field change from -> to', b1.body.conflict?.changedBy === A.user.name
  && b1.body.conflict?.changes?.some(c => c.field === 'quantityScheduled' && c.from === p0.quantity_scheduled && c.to === p0.quantity_scheduled + 1)
  && b1.body.conflict?.currentVersion === 2, JSON.stringify(b1.body.conflict?.changes))
check("...and B's value was NOT written", now.quantity_scheduled === p0.quantity_scheduled + 1 && now.version === 2)

const b2 = await call(B, 'PUT', `/api/production-plans/${p0.id}`, { quantityScheduled: 999, version: b1.body.conflict.currentVersion })
now = await plan(p0.id)
check('B "keep mine" (resend with current version) -> 200, B is the editor', b2.status === 200 && now.quantity_scheduled === 999 && now.updated_by_name === B.user.name && now.version === 3)

const legacy = await call(A, 'PUT', `/api/production-plans/${p0.id}`, { quantityScheduled: p0.quantity_scheduled })
check('a save WITHOUT a version still works as before', legacy.status === 200 && (await plan(p0.id)).version === 4)

const spoof = await call(B, 'PUT', `/api/production-plans/${p0.id}`, { quantityScheduled: p0.quantity_scheduled + 2, updatedByName: 'Hacker', updatedById: A.user.id, version: 4 })
now = await plan(p0.id)
const lastEv = (await events(p0.id)).at(-1)
check('a faked "changed by" in the body is ignored', spoof.status === 200 && now.updated_by_name === B.user.name && now.updated_by_id === B.user.id && lastEv.user_name === B.user.name, now.updated_by_name)

const noop = await call(A, 'PUT', `/api/production-plans/${p0.id}`, { quantityScheduled: now.quantity_scheduled, version: now.version })
check('a save that changes nothing adds no history row', noop.status === 200 && (await events(p0.id)).at(-1).id === lastEv.id)

now = await plan(p0.id)
const race = await Promise.all(Array.from({ length: 5 }, (_, i) => call(i % 2 ? A : B, 'PUT', `/api/production-plans/${p0.id}`, { quantityScheduled: 500 + i, version: now.version })))
check('5 simultaneous saves with the same version -> exactly 1 wins', race.filter(r => r.status === 200).length === 1 && race.filter(r => r.status === 409).length === 4, race.map(r => r.status).join(','))

// delete
const [d0] = await sql`select * from production_plans where stage = 'Mould' order by date desc limit 1`
await call(A, 'PUT', `/api/production-plans/${d0.id}`, { quantityScheduled: d0.quantity_scheduled + 1, version: d0.version })
const dStale = await call(B, 'DELETE', `/api/production-plans/${d0.id}?version=${d0.version}`)
check('B deletes a row A changed since B loaded it -> 409, row kept', dStale.status === 409 && !!(await plan(d0.id)), dStale.body.error)
const cur = await plan(d0.id)
const dOk = await call(B, 'DELETE', `/api/production-plans/${d0.id}?version=${cur.version}`)
const dEv = (await events(d0.id)).at(-1)
check('delete with the current version -> gone, history keeps the full row', dOk.status === 200 && !(await plan(d0.id)) && dEv.action === 'delete' && dEv.user_name === B.user.name && dEv.before.id === d0.id && dEv.before.itemId === d0.item_id)

// create + idempotent upsert
const id = await newId()
const body = { id, _id: id, _isNew: true, date: '2026-11-15', orderId: p0.order_id, itemId: p0.item_id, stage: 'Core', quantityScheduled: 7 }
const c1 = await call(A, 'POST', '/api/production-plans', body)
const c2 = await call(A, 'POST', '/api/production-plans', { ...body, quantityScheduled: 8 })
const cEv = await events(id)
check('new row: version 1, creator recorded, "create" history', c1.status === 201 && c1.body.version === 1 && c1.body.updatedByName === A.user.name && cEv[0]?.action === 'create')
check('double-submit of the same new row collapses: version 2, "update" history', c2.status === 201 && c2.body.version === 2 && cEv.length === 2 && cEv[1].action === 'update')

// ---------------- orders
const cart = [{ product: 'T-PROD', productName: 'Test product', quantity: 10, deliveryQuantity: 0, weight: 1, ratePerKg: 1, unitCost: 1 }]
const ordId = await newId()
const o1 = await call(A, 'POST', '/api/orders', { id: ordId, customerOrderNo: 'TEST-BC-1', customer: 'Test', cart })
check('order create -> version 1, creator, "create" history', o1.status === 201 && o1.body.version === 1 && o1.body.updatedByName === A.user.name && (await events(ordId))[0]?.action === 'create')
const o2 = await call(A, 'PUT', `/api/orders/${ordId}`, { customerOrderNo: 'TEST-BC-1', customer: 'Test', cart, version: 1 })
check('order saved with identical cart -> no history row', o2.status === 200 && (await events(ordId)).length === 1)
const o3 = await call(A, 'PUT', `/api/orders/${ordId}`, { customer: 'Test Ltd', cart, version: o2.body.version })
const o4 = await call(B, 'PUT', `/api/orders/${ordId}`, { customer: 'B edit', cart, version: o2.body.version })
check('order: stale edit -> 409 naming A, customer Test -> Test Ltd', o3.status === 200 && o4.status === 409 && o4.body.conflict?.changedBy === A.user.name
  && o4.body.conflict?.changes?.some(c => c.field === 'customer' && c.from === 'Test' && c.to === 'Test Ltd'), JSON.stringify(o4.body.conflict?.changes))
const legacyOrder = await call(B, 'PUT', `/api/orders/${ordId}`, { customer: 'Test Ltd', cart })
check('order save without a version still works', legacyOrder.status === 200)

const pIds = []
for (let i = 0; i < 3; i++) {
  const r = await call(A, 'POST', '/api/production-plans', { date: '2026-11-16', orderId: ordId, itemId: `${ordId}-0`, stage: 'Core', quantityScheduled: 3 + i })
  pIds.push(r.body.id)
}
const od = await call(B, 'DELETE', `/api/orders/${ordId}?force=true`)
const left = await sql`select count(*)::int n from production_plans where order_id = ${ordId}`
const planDel = await sql`select count(*)::int n from audit_events where entity_id in ${sql(pIds)} and action = 'delete' and before is not null`
const ordDel = (await events(ordId)).at(-1)
check('order delete: order + 3 plans gone, each with a full "delete" history row',
  od.status === 200 && left[0].n === 0 && planDel[0].n === 3 && ordDel.action === 'delete' && ordDel.before.cart?.length === 1, `${planDel[0].n} plan rows`)

// ---------------- inspection / knockout / close-day write history too
const fx = await singleLineOrder()
await sql`insert into production_plans (date, order_id, item_id, stage, quantity_scheduled) values ('2026-11-17', ${fx.orderId}, ${fx.itemId}, 'Knockout', 9)`
const [{ a }] = await sql`select (coalesce(sum(quantity_scheduled) filter (where stage='Knockout'),0) - coalesce(sum(coalesce(quantity_scheduled,0)+coalesce(rejected_quantity,0)) filter (where stage='Inspection'),0))::int a from production_plans where item_id = ${fx.itemId}`
const ins = await call(B, 'POST', '/api/inspection-submit', { itemId: fx.itemId, orderId: fx.orderId, patternRef: 'T', totalAvailable: a, rejectedQty: 0, reason: '' })
const insEv = ins.body.row ? await events(ins.body.row.id) : []
check('inspection batch: "create" history by B', ins.status === 200 && insEv[0]?.action === 'create' && insEv[0]?.user_name === B.user.name, `${ins.status}`)

const [ko] = await sql`insert into production_plans (date, order_id, item_id, stage, quantity_scheduled, actual_quantity, is_confirmed) values ('2026-11-17', ${fx.orderId}, ${fx.itemId}, 'Knockout', 1, 1, false) returning id`
await call(A, 'POST', '/api/knockout-confirm', { planIds: [ko.id] })
const koEv = await events(ko.id)
check('knockout confirm: version bumped, "update" history with isConfirmed', (await plan(ko.id)).version === 2 && koEv[0]?.changed_fields?.includes('isConfirmed'))

await sql`insert into production_plans (date, order_id, item_id, stage, quantity_scheduled, hourly_actuals) values ('2026-11-20', ${fx.orderId}, ${fx.itemId}, 'Core', 10, '{"07:00": 4}')`
const cd = await call(A, 'POST', '/api/production-plans/close-day', { date: '2026-11-20' })
const cfRows = await sql`select id from production_plans where carried_forward_from_date = '2026-11-20'`
const cfEv = cfRows.length ? await events(cfRows[0].id) : []
check('close day: carry-forward row has "create" history and editor', cd.status === 200 && cfRows.length === 1 && cfEv[0]?.action === 'create' && (await plan(cfRows[0].id)).updated_by_name === A.user.name)

await done()
