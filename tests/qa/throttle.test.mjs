// Unit test of the login lockout rules with a fake clock (no server, no database).
import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const src = fs.readFileSync('src/modules/users/application/login-throttle.ts', 'utf8')
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText

let now = 1_000_000_000
const realNow = Date.now
Date.now = () => now
const realWarn = console.warn
console.warn = () => {}
const mod = { exports: {} }
new Function('module', 'exports', 'require', js)(mod, mod.exports, require)
const t = mod.exports

let pass = 0, fail = 0
const check = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`) }
const MIN = 60_000

for (let i = 0; i < 4; i++) t.recordFailure('admin', '1.1.1.1')
check('4 failures: not locked', t.lockedForMinutes('admin', '1.1.1.1') === 0)
t.recordFailure('admin', '1.1.1.1')
check('5th failure: locked 15 min', t.lockedForMinutes('admin', '1.1.1.1') === 15)
check('username is case-insensitive', t.lockedForMinutes('ADMIN', '1.1.1.1') === 15)
check('same user from another IP is NOT locked', t.lockedForMinutes('admin', '2.2.2.2') === 0)
check('other user from the attacking IP is not locked yet', t.lockedForMinutes('ravi', '1.1.1.1') === 0)
now += 14 * MIN
check('still locked after 14 min (1 min left)', t.lockedForMinutes('admin', '1.1.1.1') === 1)
now += 1 * MIN + 1
check('unlocked after 15 min', t.lockedForMinutes('admin', '1.1.1.1') === 0)
t.recordFailure('admin', '1.1.1.1')
check('one failure after the window does not re-lock', t.lockedForMinutes('admin', '1.1.1.1') === 0)

now += 60 * MIN
for (let i = 0; i < 4; i++) t.recordFailure('meena', '3.3.3.3')
t.recordSuccess('meena', '3.3.3.3')
t.recordFailure('meena', '3.3.3.3')
check('success resets the per-user count', t.lockedForMinutes('meena', '3.3.3.3') === 0)

now += 60 * MIN
for (let i = 0; i < 99; i++) t.recordFailure(`user${i}`, '9.9.9.9')
check('99 failures across usernames: IP not blocked', t.lockedForMinutes('newname', '9.9.9.9') === 0)
t.recordFailure('user99', '9.9.9.9')
check('100th failure: IP blocked for every username', t.lockedForMinutes('newname', '9.9.9.9') === 15)
check('IP block does not affect other IPs', t.lockedForMinutes('newname', '8.8.8.8') === 0)
t.recordSuccess('user0', '9.9.9.9')
check('a success does not lift the IP-wide block', t.lockedForMinutes('newname', '9.9.9.9') === 15)
now += 120 * MIN
t.lockedForMinutes('x', 'y')
check('old entries are pruned', true)

Date.now = realNow
console.warn = realWarn
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
