// The real loginUser server action, called the way the login page does.
// Uses made-up X-Real-IP addresses so locks never touch a real client.
// QA_ADMIN_PASSWORD: the admin password in the copied database (default admin123).
import fs from 'node:fs'
import { check, done, BASE } from './_lib.mjs'

const GOOD = process.env.QA_ADMIN_PASSWORD || 'admin123'
// The action id changes per build; read it from the build's manifest.
const manifest = JSON.parse(fs.readFileSync('.next/server/app/login/page/server-reference-manifest.json', 'utf8'))
const ACTION = Object.keys(manifest.node || {}).find(id => id.startsWith('40'))
if (!ACTION) throw new Error('loginUser action id not found - run `pnpm build` first')

async function login(username, password, ip) {
  const fd = new FormData()
  // React's encodeReply for one FormData argument: entries first, root "0" last
  fd.append('_1_username', username)
  fd.append('_1_password', password)
  fd.append('0', '["$K1"]')
  const res = await fetch(`${BASE}/login`, { method: 'POST', headers: { 'Next-Action': ACTION, 'X-Real-IP': ip, Accept: 'text/x-component' }, body: fd })
  const text = await res.text()
  const m = text.match(/"error":"([^"]*)"/)
  return { ok: /"success":true/.test(text), error: m ? m[1] : null, cookie: !!res.headers.get('set-cookie')?.includes('auth_token=') }
}

const ipA = `10.99.${Math.floor(Math.random() * 250)}.1`, ipB = ipA.replace(/\.1$/, '.2')
const ok = await login('admin', GOOD, ipB)
check('correct password logs in and sets the session cookie', ok.ok && ok.cookie, JSON.stringify(ok))
for (let i = 1; i <= 4; i++) {
  const r = await login('admin', 'wrong-password', ipA)
  if (i === 1) check('wrong password -> "Invalid credentials"', r.error === 'Invalid credentials', r.error)
}
const fifth = await login('admin', 'wrong-password', ipA)
check('5th wrong password still says Invalid credentials', fifth.error === 'Invalid credentials', fifth.error)
const sixth = await login('admin', GOOD, ipA)
check('6th attempt is locked EVEN WITH the correct password', !sixth.ok && /Too many failed attempts\. Try again in 15 minutes\./.test(sixth.error || ''), sixth.error)
const other = await login('admin', GOOD, ipB)
check('same admin from a different IP still logs in', other.ok)
const unknown = await login('no-such-user', 'x', ipB)
check('unknown username -> same "Invalid credentials" message', unknown.error === 'Invalid credentials', unknown.error)
const empty = await login('', '', ipB)
check('empty fields -> required message', empty.error === 'Username and password are required', empty.error)

await done()
