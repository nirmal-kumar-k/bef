#!/usr/bin/env node
//
// Creates the first admin account for an empty BEF database.
//
// The app no longer creates a default admin/admin123 on first login - that was
// a takeover on any publicly reachable server - so a fresh database needs this
// run once. It refuses if an admin already exists: resetting an existing
// password is done from the Users page, not here.
//
// Usage (from the project folder):
//   node scripts/create-admin.mjs
//
// Asks for name, username and password (the password is not echoed and never
// appears in shell history). Uses DATABASE_URL from the environment or
// .env.local.

import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import postgres from 'postgres'

// Same rule as src/modules/users/domain/password.ts.
const MIN_PASSWORD_LENGTH = 8

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const envFile = path.join(appDir, '.env.local')
  if (fs.existsSync(envFile)) {
    const line = fs.readFileSync(envFile, 'utf8').split(/\r?\n/).find(l => l.startsWith('DATABASE_URL='))
    if (line) return line.slice('DATABASE_URL='.length).replace(/^["']|["']$/g, '')
  }
  console.error(`ERROR: DATABASE_URL not set and not found in ${envFile}`)
  process.exit(1)
}

function ask(question, { hidden = false } = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  if (hidden) {
    // Print the prompt, then swallow every echoed keystroke.
    rl._writeToOutput = s => { if (s.includes(question)) rl.output.write(question) }
  }
  return new Promise(resolve => rl.question(question, answer => {
    rl.close()
    if (hidden) process.stdout.write('\n')
    resolve(answer.trim())
  }))
}

const sql = postgres(databaseUrl())
try {
  const [{ admins }] = await sql`select count(*)::int as admins from users where role = 'admin'`
  if (admins > 0) {
    console.error(`Refusing: ${admins} admin account(s) already exist. Reset passwords from the Users page.`)
    process.exit(1)
  }

  const name = await ask('Full name: ')
  const username = await ask('Username: ')
  if (!name || !username) {
    console.error('Name and username are required.')
    process.exit(1)
  }
  const password = await ask('Password: ', { hidden: true })
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
    process.exit(1)
  }
  if (password !== await ask('Repeat password: ', { hidden: true })) {
    console.error('Passwords do not match.')
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const [row] = await sql`
    insert into users (name, username, password_hash, role, is_active)
    values (${name}, ${username}, ${passwordHash}, 'admin', true)
    returning username`
  console.log(`Created admin "${row.username}". Log in with it now.`)
} catch (error) {
  console.error(error.code === '23505' ? 'A user with that username already exists.' : `ERROR: ${error.message}`)
  process.exitCode = 1
} finally {
  await sql.end()
}
