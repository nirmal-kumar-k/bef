// Sessions end when a password, role or active flag changes (or the user is deleted).
import { sql, session, sessionFor, call, check, done, BASE } from './_lib.mjs'

const admin = await session('admin')
const stamp = Date.now()
const username = `qa-sess-${stamp}`
const created = await call(admin, 'POST', '/api/users', { name: 'QA Session', username, password: 'firstpass1', role: 'operator' })
if (created.status !== 201) throw new Error(`could not create the test user: ${created.status} ${created.body.error}`)
const row = async () => (await sql`select id, role, name, username, session_version, is_active from users where username = ${username}`)[0]
const ok = async who => (await fetch(`${BASE}/api/orders`, { headers: { Cookie: who.cookie } })).status

let u = await row()
const t1 = await sessionFor(u)
check('a fresh session works', (await ok(t1)) === 200)
const legacy = await sessionFor(u, undefined)
check('a token issued before revocation existed (no version) still works', (await ok(legacy)) === 200)

const nameOnly = await call(admin, 'PUT', `/api/users/${u.id}`, { name: 'QA Session Renamed', phone: '123' })
check('changing only name/phone does NOT log the user out', nameOnly.status === 200 && (await ok(t1)) === 200)

const pw = await call(admin, 'PUT', `/api/users/${u.id}`, { password: 'secondpass2' })
check('password changed -> the old session is refused immediately (401)', pw.status === 200 && (await ok(t1)) === 401)
check('...including the pre-revocation token', (await ok(legacy)) === 401)
const page = await fetch(`${BASE}/orders`, { headers: { Cookie: t1.cookie }, redirect: 'manual' })
check('...and pages send that browser to the login screen', page.status >= 300 && page.status < 400 && /\/login/.test(page.headers.get('location') || ''), `${page.status} ${page.headers.get('location')}`)
u = await row()
const t2 = await sessionFor(u)
check('a new login after the change works', (await ok(t2)) === 200)

await call(admin, 'PUT', `/api/users/${u.id}`, { role: 'manager' })
check('role changed -> previous session refused', (await ok(t2)) === 401)
u = await row()
const t3 = await sessionFor(u)
await call(admin, 'PUT', `/api/users/${u.id}`, { isActive: false })
check('user deactivated -> session refused', (await ok(t3)) === 401)
u = await row()
check('...and even a token with the current version is refused while inactive', (await ok(await sessionFor(u))) === 401)

// An admin changing their OWN password stays logged in on this browser.
const selfPw = process.env.QA_ADMIN_PASSWORD || 'admin123' // unchanged value; the version still moves
const selfRes = await fetch(`${BASE}/api/users/${admin.user.id}`, { method: 'PUT', headers: admin.headers, body: JSON.stringify({ password: selfPw }) })
const newCookie = (selfRes.headers.get('set-cookie') || '').match(/auth_token=[^;]+/)?.[0]
check('admin changes own password -> the response re-issues their session', selfRes.status === 200 && !!newCookie)
check('...the new session works', !!newCookie && (await fetch(`${BASE}/api/orders`, { headers: { Cookie: newCookie } })).status === 200)
check('...and the old one is refused (any other device is logged out)', (await ok(admin)) === 401)

// deleting the user
const fresh = { headers: { Cookie: newCookie, 'Content-Type': 'application/json' } }
await call(fresh, 'PUT', `/api/users/${u.id}`, { isActive: true })
u = await row()
const t4 = await sessionFor(u)
check('reactivated user can log in again', (await ok(t4)) === 200)
await call(fresh, 'DELETE', `/api/users/${u.id}`)
check('user deleted -> session refused', (await ok(t4)) === 401)

await done()
