// Shared helpers for the QA suite. Run through `pnpm qa` (scripts/qa.sh), which
// starts a production build on QA_BASE_URL against a SCRATCH copy of the
// database. Every test refuses to run against anything but that copy.
import { SignJWT } from 'jose'
import postgres from 'postgres'

export const BASE = process.env.QA_BASE_URL || 'http://localhost:3001'
export const QA_DB = process.env.QA_DB_NAME || 'bef_foundry_test'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing - run with node --env-file=.env.local')
export const sql = postgres(process.env.DATABASE_URL.replace(/\/[^/?]+(\?|$)/, `/${QA_DB}$1`), { max: 5 })
const [{ db }] = await sql`select current_database() as db`
if (db !== QA_DB) throw new Error(`refusing to run: connected to ${db}, expected the scratch database ${QA_DB}`)

const key = new TextEncoder().encode(process.env.JWT_SECRET)

// A session for an existing user, signed like the app's own login.
export async function session(username) {
  const [u] = await sql`select id, role, name, username from users where username = ${username}`
  if (!u) throw new Error(`no user ${username} in the scratch database`)
  const token = await new SignJWT({ id: u.id, role: u.role, name: u.name, username: u.username })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('20m').sign(key)
  const cookie = `auth_token=${token}`
  return { user: u, cookie, headers: { Cookie: cookie, 'Content-Type': 'application/json' } }
}

// Two distinct users: the admin plus any other account.
export async function twoUsers() {
  const [other] = await sql`select username from users where username <> 'admin' order by created_at limit 1`
  if (!other) throw new Error('the QA suite needs a second user besides admin')
  return [await session('admin'), await session(other.username)]
}

export async function call(who, method, path, body, extraHeaders = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...who.headers, ...extraHeaders },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

let pass = 0, fail = 0
export function check(name, cond, extra = '') {
  cond ? pass++ : fail++
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`)
}

export async function done() {
  console.log(`\n${pass} passed, ${fail} failed`)
  await sql.end()
  process.exit(fail ? 1 : 0)
}

export const sleep = ms => new Promise(r => setTimeout(r, ms))
export const newId = async () => (await sql`select gen_random_uuid() as id`)[0].id

// An order with exactly one cart line that resolves to a real product.
export async function singleLineOrder() {
  const [fx] = await sql`
    select o.id, p.id as product_id from orders o
    join order_items oi on oi.order_id = o.id
    join products p on p.name = oi.product_name or p.code = oi.product
    where (select count(*) from order_items x where x.order_id = o.id) = 1
    limit 1`
  if (!fx) throw new Error('the QA suite needs an order with one cart line mapped to a product')
  return { orderId: fx.id, productId: fx.product_id, itemId: `${fx.id}-0` }
}

// A timestamp column without time zone, read as the UTC instant the app wrote.
export async function storedUtc(table, column, where) {
  const [r] = await sql.unsafe(`select ${column}::text as raw from ${table} where ${where} order by ${column} desc limit 1`)
  return new Date(r.raw.replace(' ', 'T') + 'Z')
}
