// Stock safety under simultaneous use: inspections, corrections, knockout confirms.
import { sql, session, call, check, done, singleLineOrder } from './_lib.mjs'

const A = await session('admin')
const fx = await singleLineOrder()
const stock = async () => (await sql`select coalesce(stock,0)::int s from products where id = ${fx.productId}`)[0].s
const inspRows = async () => (await sql`select count(*)::int n from production_plans where item_id = ${fx.itemId} and stage = 'Inspection'`)[0].n
const available = async () => (await sql`select
    (coalesce(sum(quantity_scheduled) filter (where stage='Knockout'),0)
    - coalesce(sum(coalesce(quantity_scheduled,0)+coalesce(rejected_quantity,0)) filter (where stage='Inspection'),0))::int as a
    from production_plans where item_id = ${fx.itemId}`)[0].a

const marker = (await sql`insert into production_plans (date, order_id, item_id, stage, quantity_scheduled)
  values ('2026-10-29', ${fx.orderId}, ${fx.itemId}, 'Knockout', 37) returning id`)[0].id
const viaApi = (await call(A, 'GET', '/api/production-plans?from=2026-10-29&to=2026-10-29&stage=Knockout')).body
check('server reads the SCRATCH database', viaApi.some(p => p.id === marker))

let avail = await available(), s0 = await stock(), r0 = await inspRows()
const stale = await call(A, 'POST', '/api/inspection-submit', { itemId: fx.itemId, orderId: fx.orderId, patternRef: 'T', totalAvailable: avail + 5, rejectedQty: 0, reason: '' })
check('inspection with an out-of-date waiting count -> 409', stale.status === 409, stale.body.error)
check('...and wrote nothing', (await stock()) === s0 && (await inspRows()) === r0)

avail = await available(); s0 = await stock(); r0 = await inspRows()
const burst = await Promise.all(Array.from({ length: 10 }, () =>
  call(A, 'POST', '/api/inspection-submit', { itemId: fx.itemId, orderId: fx.orderId, patternRef: 'T', totalAvailable: avail, rejectedQty: 2, reason: 'test' })))
const ok = burst.filter(r => r.status === 200).length, conflict = burst.filter(r => r.status === 409).length
check('10 simultaneous inspections of one batch: exactly 1 accepted', ok === 1 && conflict === 9, `200 x${ok}, 409 x${conflict}`)
check('exactly one inspection row created', (await inspRows()) === r0 + 1)
check(`stock rose once, by the accepted ${avail - 2}`, (await stock()) === s0 + avail - 2, `${s0} -> ${await stock()}`)
check('nothing left waiting afterwards', (await available()) === 0)

const ids = await sql`insert into production_plans (date, order_id, item_id, stage, quantity_scheduled)
  select '2026-10-29', ${fx.orderId}, ${fx.itemId}, 'Inspection', 1 from generate_series(1,10) returning id`
s0 = await stock()
await Promise.all(ids.map(({ id }) => call(A, 'PUT', `/api/production-plans/${id}`, { quantityScheduled: 2 })))
check('10 simultaneous batch corrections (+1 each): stock +10, none lost', (await stock()) === s0 + 10, `${s0} -> ${await stock()}`)

const ko = await sql`insert into production_plans (date, order_id, item_id, stage, quantity_scheduled, actual_quantity, is_confirmed)
  select '2026-10-29', ${fx.orderId}, ${fx.itemId}, 'Knockout', 1, 1, false from generate_series(1,15) returning id`
const [{ cav }] = await sql`select coalesce(nullif(cavities,0),1)::int cav from products where id = ${fx.productId}`
s0 = await stock()
await Promise.all([...ko, ...ko].map(({ id }) => call(A, 'POST', '/api/knockout-confirm', { planIds: [id] })))
const [{ confirmed }] = await sql`select count(*)::int confirmed from production_plans where id in ${sql(ko.map(k => k.id))} and is_confirmed`
check('30 simultaneous confirms of 15 plans: all 15 confirmed', confirmed === 15)
check(`stock +${15 * cav} exactly (each plan counted once)`, (await stock()) === s0 + 15 * cav, `${s0} -> ${await stock()}`)

await done()
