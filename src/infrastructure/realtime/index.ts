import { sql } from 'drizzle-orm'
import postgres from 'postgres'
import { db } from '@/infrastructure/database/client'

// Live updates: publish / subscribe over Postgres LISTEN/NOTIFY.
//
// Publish: publishChange() runs pg_notify inside the caller's transaction.
// Postgres only delivers a NOTIFY when that transaction COMMITS, so a refused
// (409) or failed save can never announce a change that did not happen.
//
// Subscribe: one dedicated LISTEN connection per server process fans each
// notification out to every open /api/events stream (Server-Sent Events).
//
// Every publish goes through publishChange(), so adding another transport
// later (e.g. an MQTT broker for machine data) is a change in this one file.

export const CHANNEL = 'bef_changes'

export type ChangeType = 'production_plan' | 'order' | 'product' | 'day_closure' | 'master'

export type ChangeEvent = {
  type: ChangeType
  action: 'create' | 'update' | 'delete'
  id?: string | null
  // master data: which list changed (customers, patterns, ...)
  table?: string
  // production plans: lets a screen ignore days/stages it isn't showing
  date?: string | null
  stage?: string | null
  label?: string | null
  by: string | null
  byId: string | null
  // the browser tab that made the change - that tab already has it
  clientId: string | null
  at: string
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Executor = typeof db | Tx

export async function publishChange(
  ex: Executor,
  actor: { id: string | null; name: string | null; clientId?: string | null },
  e: Omit<ChangeEvent, 'by' | 'byId' | 'clientId' | 'at'>,
) {
  const event: ChangeEvent = { ...e, by: actor.name, byId: actor.id, clientId: actor.clientId ?? null, at: new Date().toISOString() }
  // NOTIFY payloads are capped at 8000 bytes; events are a few hundred.
  await ex.execute(sql`select pg_notify(${CHANNEL}, ${JSON.stringify(event)})`)
}

// ---- subscribe side (server process) --------------------------------------

type Listener = (payload: string) => void
type Hub = { listeners: Set<Listener>; started: boolean; listenClient?: postgres.Sql }

// On globalThis so dev hot-reloads reuse one LISTEN connection, same as the db client.
const g = globalThis as unknown as { befRealtimeHub?: Hub }
const hub: Hub = g.befRealtimeHub ?? (g.befRealtimeHub = { listeners: new Set(), started: false })

function broadcast(payload: string) {
  for (const l of hub.listeners) {
    try { l(payload) } catch { /* a dead stream is removed by its own cleanup */ }
  }
}

function ensureListening() {
  if (hub.started) return
  hub.started = true
  const url = process.env.DATABASE_URL!
  hub.listenClient = postgres(url, { max: 1, prepare: false })
  let first = true
  hub.listenClient.listen(CHANNEL, payload => broadcast(payload), () => {
    // postgres.js re-runs this after reconnecting to the database. Anything
    // published while the connection was down was missed, so tell every
    // browser to reload its data.
    if (!first) broadcast(JSON.stringify({ type: 'resync' }))
    first = false
  }).catch(err => {
    console.error('Realtime LISTEN failed:', err)
    hub.started = false
  })
}

export function subscribe(listener: Listener): () => void {
  ensureListening()
  hub.listeners.add(listener)
  return () => { hub.listeners.delete(listener) }
}
