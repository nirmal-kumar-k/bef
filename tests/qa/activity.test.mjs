// Activity / order history API (audit_events read side) and the Activity page.
import { sql, session, call, check, done, newId, BASE } from './_lib.mjs'

const admin = await session('admin')
const [nonAdminRow] = await sql`select username from users where role <> 'admin' and is_active order by created_at limit 1`
const other = nonAdminRow ? await session(nonAdminRow.username) : null

// ---- build a small history: order, two plans, an edit, a delete
const orderId = await newId()
await call(admin, 'POST', '/api/orders', { id: orderId, customerOrderNo: 'ACT-TEST', customer: 'Activity', cart: [{ product: 'P', productName: 'P', quantity: 5, deliveryQuantity: 0, weight: 1, ratePerKg: 1, unitCost: 1 }] })
const p1 = (await call(admin, 'POST', '/api/production-plans', { date: '2026-12-15', orderId, itemId: `${orderId}-0`, stage: 'Core', quantityScheduled: 10 })).body
const p2 = (await call(admin, 'POST', '/api/production-plans', { date: '2026-12-16', orderId, itemId: `${orderId}-0`, stage: 'Mould', quantityScheduled: 4 })).body
await call(admin, 'PUT', `/api/production-plans/${p1.id}`, { quantityScheduled: 12, version: p1.version })
await call(admin, 'DELETE', `/api/production-plans/${p2.id}?version=${p2.version}`)

// ---- order history
const h = await call(other || admin, 'GET', `/api/activity?orderId=${orderId}`)
const ev = h.body.events || []
check('order history is open to any logged-in user', h.status === 200, `${h.status}`)
check('it holds the order create and both plan creates', ev.some(e => e.entityType === 'order' && e.action === 'create' && e.orderNo === 'ACT-TEST')
  && ev.filter(e => e.entityType === 'production_plan' && e.action === 'create').length === 2)
const upd = ev.find(e => e.entityId === p1.id && e.action === 'update')
check('the plan edit shows Quantity 10 -> 12', !!upd && upd.changes.some(c => c.field === 'quantityScheduled' && c.from === 10 && c.to === 12), JSON.stringify(upd?.changes))
check('the DELETED plan is still in the order history (with its stage/date)', ev.some(e => e.entityId === p2.id && e.action === 'delete' && e.stage === 'Mould' && e.date === '2026-12-16'))
check('newest first', ev.every((e, i) => i === 0 || new Date(ev[i - 1].at) >= new Date(e.at)))

// ---- full feed: admin only
const feed = await call(admin, 'GET', '/api/activity?limit=50')
check('admin full feed: 200 with events and the list of people', feed.status === 200 && feed.body.events.length > 0 && Array.isArray(feed.body.users))
if (other) {
  const denied = await call(other, 'GET', '/api/activity')
  check('non-admin full feed -> 403', denied.status === 403)
}

// ---- filters
const plansOnly = (await call(admin, 'GET', '/api/activity?type=production_plan&limit=50')).body.events
check('type=production_plan returns only plan events', plansOnly.length > 0 && plansOnly.every(e => e.entityType === 'production_plan'))
const byUser = (await call(admin, 'GET', `/api/activity?user=${encodeURIComponent(admin.user.name)}&limit=50`)).body.events
check('user filter returns only that person', byUser.length > 0 && byUser.every(e => e.userName === admin.user.name))

// IST day boundaries: what we just did is "today" in IST, not tomorrow
const istToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
const istTomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + 86400000))
const today = (await call(admin, 'GET', `/api/activity?from=${istToday}&to=${istToday}&limit=500`)).body.events
const tomorrow = (await call(admin, 'GET', `/api/activity?from=${istTomorrow}&limit=500`)).body.events
check(`date filter uses IST days: today's changes found under ${istToday}, none under tomorrow`, today.some(e => e.entityId === orderId) && !tomorrow.some(e => e.entityId === orderId))

// paging
const page1 = (await call(admin, 'GET', '/api/activity?limit=3')).body.events
const page2 = (await call(admin, 'GET', `/api/activity?limit=3&before=${encodeURIComponent(page1.at(-1).at)}`)).body.events
check('paging with ?before= continues with older events, no overlap', page2.length > 0 && page2.every(e => new Date(e.at) < new Date(page1.at(-1).at)) && !page2.some(e => page1.some(x => x.id === e.id)))

// bad input
const bad = await Promise.all(['?from=12-2026-01', '?type=bogus', '?orderId=nope', '?before=never'].map(q => call(admin, 'GET', `/api/activity${q}`)))
check('bad filters -> 400', bad.every(r => r.status === 400), bad.map(r => r.status).join(','))

// ---- the page
const pageAdmin = await fetch(`${BASE}/activity`, { headers: { Cookie: admin.cookie }, redirect: 'manual' })
check('Activity page loads for an admin', pageAdmin.status === 200)
if (other) {
  const pageOther = await fetch(`${BASE}/activity`, { headers: { Cookie: other.cookie }, redirect: 'manual' })
  check('...and sends a non-admin away', pageOther.status >= 300 && pageOther.status < 400)
}

await call(admin, 'DELETE', `/api/orders/${orderId}?force=true`)
await done()
