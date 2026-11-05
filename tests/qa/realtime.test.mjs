// Live updates: what each open stream receives, how fast, and what it must not.
import { sql, twoUsers, call, check, done, sleep, newId, singleLineOrder, BASE } from './_lib.mjs'

const [A, B] = await twoUsers()

// Minimal Server-Sent Events reader: collects events with their arrival time.
async function openStream(who) {
  const ctrl = new AbortController()
  const res = await fetch(`${BASE}/api/events`, { headers: { Cookie: who.cookie }, signal: ctrl.signal })
  const s = { status: res.status, events: [], comments: 0, readyCount: 0, close: () => ctrl.abort() }
  if (!res.ok) return s
  ;(async () => {
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = ''
    try {
      for (;;) {
        const { value, done: end } = await reader.read(); if (end) break
        buf += dec.decode(value, { stream: true })
        let i
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, i); buf = buf.slice(i + 2)
          if (block.startsWith(':')) { s.comments++; continue }
          const ev = /^event: (.*)$/m.exec(block)?.[1]
          const data = /^data: (.*)$/m.exec(block)?.[1]
          if (ev === 'ready') { s.readyCount++; continue }
          if (data) s.events.push({ at: Date.now(), e: JSON.parse(data) })
        }
      }
    } catch { /* aborted */ }
  })()
  for (let i = 0; i < 50 && s.readyCount === 0; i++) await sleep(50)
  return s
}
const waitFor = async (stream, pred, ms = 2000) => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const hit = stream.events.find(x => pred(x.e))
    if (hit) return { hit, ms: hit.at - t0 }
    await sleep(20)
  }
  return { hit: null }
}

const anon = await fetch(`${BASE}/api/events`)
check('no login -> stream refused (401)', anon.status === 401)
const sA = await openStream(A), sB = await openStream(B)
check('both users get a live stream', sA.status === 200 && sB.status === 200 && sA.readyCount === 1 && sB.readyCount === 1)

const [p] = await sql`select * from production_plans where stage = 'Core' order by date desc limit 1`
const t0 = Date.now()
const put = await call(B, 'PUT', `/api/production-plans/${p.id}`, { quantityScheduled: p.quantity_scheduled + 1, version: p.version }, { 'X-Client-Id': 'tab-B-1' })
const got = await waitFor(sA, e => e.type === 'production_plan' && e.id === p.id)
check('B saves a plan -> A receives it', put.status === 200 && !!got.hit)
check(`...within 1 second (took ${got.hit ? got.hit.at - t0 : '?'} ms)`, !!got.hit && got.hit.at - t0 < 1000)
const e1 = got.hit?.e || {}
check('...event says who, what, which day/stage', e1.by === B.user.name && e1.action === 'update' && e1.date === p.date && e1.stage === 'Core')
check("...and carries B's tab id, so B's own tab can ignore it", e1.clientId === 'tab-B-1')
check("B's other tabs receive it too", !!(await waitFor(sB, e => e.id === p.id)).hit)

sA.events.length = 0
const stale = await call(A, 'PUT', `/api/production-plans/${p.id}`, { quantityScheduled: 1, version: p.version })
const bad = await call(A, 'PUT', `/api/production-plans/${p.id}`, { bogusField: 1 })
await sleep(800)
check('a refused (409) and an invalid (400) save send NO event', stale.status === 409 && bad.status === 400 && sA.events.length === 0, `${stale.status}/${bad.status}, ${sA.events.length} events`)

const [now] = await sql`select version, quantity_scheduled from production_plans where id = ${p.id}`
sA.events.length = 0
await call(B, 'PUT', `/api/production-plans/${p.id}`, { quantityScheduled: now.quantity_scheduled, version: now.version })
await sleep(800)
check('a save that changes nothing sends no event', sA.events.length === 0)

const ordId = await newId()
const o = await call(B, 'POST', '/api/orders', { id: ordId, customerOrderNo: 'RT-TEST-1', customer: 'Realtime', cart: [{ product: 'T', productName: 'T', quantity: 1, deliveryQuantity: 0, weight: 1, ratePerKg: 1, unitCost: 1 }] })
const go = await waitFor(sA, e => e.type === 'order' && e.id === ordId)
check('B creates an order -> A sees "order RT-TEST-1 created by B"', o.status === 201 && go.hit?.e.action === 'create' && go.hit?.e.label === 'RT-TEST-1' && go.hit?.e.by === B.user.name)

for (let i = 0; i < 2; i++) await call(B, 'POST', '/api/production-plans', { date: '2026-12-01', orderId: ordId, itemId: `${ordId}-0`, stage: 'Core', quantityScheduled: 1 })
sA.events.length = 0
await call(B, 'DELETE', `/api/orders/${ordId}?force=true`)
await sleep(800)
const del = sA.events.filter(x => x.e.action === 'delete')
check('order delete -> events for the order and both its plans', del.filter(x => x.e.type === 'production_plan').length === 2 && del.some(x => x.e.type === 'order' && x.e.id === ordId), `${del.length} delete events`)

const fx = await singleLineOrder()
await sql`insert into production_plans (date, order_id, item_id, stage, quantity_scheduled) values ('2026-12-02', ${fx.orderId}, ${fx.itemId}, 'Knockout', 6)`
const [{ avail }] = await sql`select (coalesce(sum(quantity_scheduled) filter (where stage='Knockout'),0) - coalesce(sum(coalesce(quantity_scheduled,0)+coalesce(rejected_quantity,0)) filter (where stage='Inspection'),0))::int avail from production_plans where item_id = ${fx.itemId}`
sA.events.length = 0
const ins = await call(B, 'POST', '/api/inspection-submit', { itemId: fx.itemId, orderId: fx.orderId, patternRef: 'T', totalAvailable: avail, rejectedQty: 0, reason: '' })
await sleep(800)
check('inspection -> "plan created" AND "stock updated" events', ins.status === 200 && sA.events.some(x => x.e.type === 'production_plan' && x.e.action === 'create') && sA.events.some(x => x.e.type === 'product'))

sA.events.length = 0
const c = await call(B, 'POST', '/api/customers', { value: `RT-CUST-${Date.now()}`, label: 'Realtime Test Customer' })
const gc = await waitFor(sA, e => e.type === 'master' && e.table === 'customers')
check('B adds a customer -> master/customers event', c.status === 201 && !!gc.hit, `${c.status}`)
const cBad = await call(B, 'POST', '/api/customers', {})
await sleep(600)
check('a failed master-data save sends no event', cBad.status >= 400 && sA.events.filter(x => x.e.table === 'customers').length === 1, `${cBad.status}`)

await sql`insert into production_plans (date, order_id, item_id, stage, quantity_scheduled, hourly_actuals) values ('2026-12-05', ${fx.orderId}, ${fx.itemId}, 'Core', 10, '{"07:00": 3}')`
sA.events.length = 0
const cd = await call(B, 'POST', '/api/production-plans/close-day', { date: '2026-12-05' })
await sleep(800)
check('close day -> day_closure event + carry-forward plan created', cd.status === 200 && sA.events.some(x => x.e.type === 'day_closure' && x.e.date === '2026-12-05') && sA.events.some(x => x.e.type === 'production_plan' && x.e.action === 'create'))
sA.events.length = 0
const cdAgain = await call(B, 'POST', '/api/production-plans/close-day', { date: '2026-12-05' })
await sleep(600)
check('closing an already-closed day (409) sends nothing', cdAgain.status === 409 && sA.events.length === 0)

sA.events.length = 0
const killed = await sql`select pg_terminate_backend(pid) from pg_stat_activity where datname = current_database() and query ilike 'listen%'`
const rs = await waitFor(sA, e => e.type === 'resync', 15000)
check('LISTEN connection killed -> server reconnects and sends "resync"', killed.length >= 1 && !!rs.hit, `${killed.length} killed, resync after ${rs.ms ?? '-'} ms`)
const [p2] = await sql`select version, quantity_scheduled from production_plans where id = ${p.id}`
await call(B, 'PUT', `/api/production-plans/${p.id}`, { quantityScheduled: p2.quantity_scheduled + 1, version: p2.version })
check('...and live events flow again afterwards', !!(await waitFor(sA, e => e.type === 'production_plan' && e.id === p.id && e.action === 'update', 3000)).hit)

await sleep(26000)
check('idle stream gets a heartbeat within 26s', sA.comments >= 1, `${sA.comments} heartbeat(s)`)

sA.close(); sB.close()
await done()
