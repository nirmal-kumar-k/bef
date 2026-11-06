// Production-plan API: filters, payload validation, round-trips of the exact
// payloads the planning modals / Tracking / Inspection send.
import { sql, session, call, check, done, BASE } from './_lib.mjs'

const A = await session('admin')
const get = async q => call(A, 'GET', `/api/production-plans${q}`)

// ---- GET
const [{ total }] = await sql`select count(*)::int total from production_plans`
const all = await get('')
check('GET no params returns every plan', all.status === 200 && all.body.length === total, `${all.body.length}/${total}`)
const dates = [...new Set(all.body.map(p => p.date))].sort()
const mid = dates[Math.floor(dates.length / 2)]
const [{ n: nFrom }] = await sql`select count(*)::int n from production_plans where date >= ${mid}`
const rFrom = await get(`?from=${mid}`)
check('GET ?from filters inclusively', rFrom.status === 200 && rFrom.body.length === nFrom && rFrom.body.every(p => p.date >= mid), `${rFrom.body.length}/${nFrom}`)
const [{ n: nDay }] = await sql`select count(*)::int n from production_plans where date = ${mid} and stage = 'Core'`
const rDay = await get(`?from=${mid}&to=${mid}&stage=Core`)
check('GET from+to+stage', rDay.status === 200 && rDay.body.length === nDay && rDay.body.every(p => p.date === mid && p.stage === 'Core'), `${rDay.body.length}/${nDay}`)
check('GET bad date -> 400', (await get('?from=21-10-2026')).status === 400)
check('GET bad stage -> 400', (await get('?stage=Bogus')).status === 400)

// ---- PUT with a payload shaped exactly like core-planning-modal's buildPlansToSave
const [core] = await sql`select id from production_plans where stage = 'Core' order by updated_at desc limit 1`
const plan = all.body.find(p => p.id === core.id)
const modalPayload = {
  id: plan.id, _id: plan.id, orderId: plan.orderId, itemId: plan.itemId, stage: 'Core',
  patternRef: plan.patternRef, coreBoxCode: plan.coreBoxCode, quantityScheduled: plan.quantityScheduled,
  shiftId: plan.shiftId, laborersAssigned: plan.laborersAssigned, workersAssigned: plan.workersAssigned,
  equipmentId: plan.equipmentId, hourlyEquipments: plan.hourlyEquipments, hourlyTargets: plan.hourlyTargets,
  hourlyWorkers: plan.hourlyWorkers, isConfirmed: plan.isConfirmed, possibleQuantity: Number(plan.possibleQuantity),
  _isNew: false, date: plan.date, version: plan.version,
}
// version / who-changed-it legitimately change on every save
const strip = p => { const { updatedAt, version, updatedById, updatedByName, ...rest } = p; return JSON.stringify(rest) }
const fresh = async () => (await get('')).body.find(p => p.id === plan.id)

const put1 = await call(A, 'PUT', `/api/production-plans/${plan.id}`, modalPayload)
check('PUT Core-modal payload -> 200', put1.status === 200, put1.status === 200 ? '' : JSON.stringify(put1.body))
const after1 = await fresh()
check('PUT round-trip leaves the row unchanged', strip(after1) === strip(plan))

const put2 = await call(A, 'PUT', `/api/production-plans/${plan.id}`, { ...modalPayload, version: after1.version, actualMeltWeight: 5, isAdmin: true })
check('PUT unknown fields -> 400 naming them', put2.status === 400 && /actualMeltWeight/.test(put2.body.error) && /isAdmin/.test(put2.body.error), put2.body.error)
const put3 = await call(A, 'PUT', `/api/production-plans/${plan.id}`, { quantityScheduled: 'ten' })
check('PUT wrong type -> 400', put3.status === 400, put3.body.error)
const put4 = await call(A, 'PUT', `/api/production-plans/${plan.id}`, { quantityScheduled: 2.5 })
check('PUT fractional integer -> 400', put4.status === 400, put4.body.error)
const put5 = await call(A, 'PUT', `/api/production-plans/${plan.id}`, { itemId: null })
check('PUT null into NOT NULL column -> 400', put5.status === 400, put5.body.error)
const after2 = await fresh()
check('rejected PUTs wrote nothing', strip(after2) === strip(plan) && after2.updatedAt === after1.updatedAt && after2.version === after1.version)

const put6 = await call(A, 'PUT', `/api/production-plans/${plan.id}`, { hourlyActuals: plan.hourlyActuals || {}, varianceReason: plan.varianceReason })
check('PUT Tracking partial payload -> 200', put6.status === 200, put6.status === 200 ? '' : JSON.stringify(put6.body))
const put7 = await call(A, 'PUT', `/api/production-plans/${plan.id}`, { id: plan.id, _id: plan.id, createdAt: plan.createdAt, updatedAt: plan.updatedAt })
check('PUT with only ignored keys -> 200', put7.status === 200)

// Melt-modal shape (numeric + melt fields)
const [melt] = await sql`select id from production_plans where stage = 'Melt' order by updated_at desc limit 1`
if (melt) {
  const m = all.body.find(p => p.id === melt.id)
  const meltPayload = {
    id: m.id, _id: m.id, orderId: m.orderId, itemId: m.itemId, stage: 'Melt', patternRef: m.patternRef,
    quantityScheduled: m.quantityScheduled, mouldsScheduled: m.mouldsScheduled, shiftId: m.shiftId, laborersAssigned: 1,
    equipmentId: m.equipmentId, heatNumber: m.heatNumber, startTime: m.startTime ?? undefined, endTime: m.endTime ?? undefined,
    grade: m.grade ?? undefined, heatNo: m.heatNo ?? undefined, heatSequenceNumber: m.heatSequenceNumber ?? undefined,
    isFirstHeat: !!m.isFirstHeat, isConfirmed: m.isConfirmed, _isNew: false, date: m.date, version: m.version,
  }
  const putM = await call(A, 'PUT', `/api/production-plans/${m.id}`, meltPayload)
  check('PUT Melt-modal payload -> 200', putM.status === 200, putM.status === 200 ? '' : JSON.stringify(putM.body))
  const afterM = (await get('')).body.find(p => p.id === m.id)
  const norm = p => { const { updatedAt, laborersAssigned, version, updatedById, updatedByName, ...rest } = p; return JSON.stringify(rest) }
  check('PUT Melt round-trip leaves the row unchanged', norm(afterM) === norm(m))
  const putN = await call(A, 'PUT', `/api/production-plans/${m.id}`, { actualQuantity: afterM.actualQuantity === null ? null : Number(afterM.actualQuantity), varianceReason: afterM.varianceReason })
  check('PUT Melt Tracking payload (numeric) -> 200', putN.status === 200, putN.status === 200 ? '' : JSON.stringify(putN.body))
}

// ---- POST: upsert on an existing id must update, never duplicate
const latest = await fresh()
const post1 = await call(A, 'POST', '/api/production-plans', { ...modalPayload, _isNew: true, version: latest.version })
const [{ total: total2 }] = await sql`select count(*)::int total from production_plans`
check('POST upsert on existing id -> 201, no new row', post1.status === 201 && total2 === total, `${post1.status}, rows ${total2}/${total}`)
const post2 = await call(A, 'POST', '/api/production-plans', { ...modalPayload, id: undefined, _id: undefined, bogus: 1 })
check('POST unknown field -> 400', post2.status === 400, post2.body.error)
const post3 = await call(A, 'POST', '/api/production-plans', { stage: 'Core', quantityScheduled: 1 })
check('POST missing date/itemId -> 400', post3.status === 400, post3.body.error)
const [{ total: total3 }] = await sql`select count(*)::int total from production_plans`
check('rejected POSTs created nothing', total3 === total, `${total3}/${total}`)

const noAuth = await fetch(`${BASE}/api/production-plans`)
check('no cookie -> 401', noAuth.status === 401)

await done()
