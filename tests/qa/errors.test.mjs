// Write errors come back as clear 4xx messages, not 500s.
import { sql, session, call, check, done } from './_lib.mjs'

const A = await session('admin')
const stamp = Date.now()

const missing = await call(A, 'POST', '/api/customers', { label: 'No code' })
check('customer without its code -> 400 naming the field', missing.status === 400 && /^Value is required$/.test(missing.body.error || ''), `${missing.status} ${missing.body.error}`)

const ok = await call(A, 'POST', '/api/customers', { value: `QA-${stamp}`, label: 'QA customer' })
check('a complete customer still saves (201)', ok.status === 201)
const dupC = await call(A, 'POST', '/api/customers', { value: `QA-${stamp}`, label: 'Duplicate' })
check('duplicate customer code -> 409 with its own message', dupC.status === 409 && dupC.body.error === 'A customer with this code already exists', `${dupC.status} ${dupC.body.error}`)

const [anyUser] = await sql`select username from users limit 1`
const dupU = await call(A, 'POST', '/api/users', { name: 'Dup', username: anyUser.username, password: 'longenough1', role: 'operator' })
check('duplicate username -> 409 "A user with this username already exists" (was 500)', dupU.status === 409 && dupU.body.error === 'A user with this username already exists', `${dupU.status} ${dupU.body.error}`)

const badId = await call(A, 'PUT', '/api/customers/not-a-uuid', { value: 'x', label: 'y' })
check('malformed record id -> 400, not 500', badId.status === 400, `${badId.status} ${badId.body.error}`)

const grade = await call(A, 'POST', '/api/grades', {})
check('grade with nothing filled in -> 400 naming a field', grade.status === 400 && /is required$/.test(grade.body.error || ''), `${grade.status} ${grade.body.error}`)

await done()
