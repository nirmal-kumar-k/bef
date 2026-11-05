import { and, asc, eq, gt } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { auditEvents } from '@/infrastructure/database/schema'
import { headers } from 'next/headers'
import { getSessionUser } from '@/shared/lib/auth'
import { publishChange } from '@/infrastructure/realtime'

// Change history and optimistic locking for production plans and orders.
//
// Every write path calls recordAudit() inside the SAME transaction as the
// change, so a change and its history row commit or roll back together.
// The actor always comes from the server-side session - a "changed by" value
// in a request body is never read.

export type EntityType = 'production_plan' | 'order'
export type Actor = { id: string | null; name: string | null; clientId?: string | null }

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Executor = typeof db | Tx

export async function currentActor(): Promise<Actor> {
  const user = await getSessionUser()
  // The browser tab that sent the request (set by the live-updates client),
  // so the change is not echoed back to the tab that made it. Not trusted for
  // anything else - who made the change always comes from the session.
  const raw = (await headers()).get('x-client-id')
  const clientId = raw && /^[A-Za-z0-9-]{1,64}$/.test(raw) ? raw : null
  return { id: user?.id ?? null, name: user?.name || user?.username || null, clientId }
}

// Bookkeeping columns that change on every write - not interesting as "what
// changed", and would make every edit look like it touched them.
const BOOKKEEPING = new Set(['updatedAt', 'createdAt', 'version', 'updatedById', 'updatedByName'])

// JSON round-trip so Dates, numeric strings and nested jsonb compare by value.
const norm = (v: unknown) => JSON.stringify(v ?? null)

export function changedFields(before: Record<string, unknown> | null, after: Record<string, unknown> | null): string[] {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})])
  return [...keys].filter(k => !BOOKKEEPING.has(k) && norm(before?.[k]) !== norm(after?.[k])).sort()
}

export async function recordAudit(ex: Executor, actor: Actor, e: {
  entityType: EntityType
  entityId: string
  action: 'create' | 'update' | 'delete'
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  version?: number | null
}) {
  const before = e.before ?? null
  const after = e.after ?? null
  const fields = changedFields(before, after)
  // An update that changed nothing but bookkeeping is not worth a history row.
  if (e.action === 'update' && fields.length === 0) return
  await ex.insert(auditEvents).values({
    // Set here rather than left to the column's now(): a timestamp column
    // without a time zone stores now() in the DB server's zone, which differs
    // between this PC and the Azure VM. A JS Date is always written as UTC,
    // the same way updatedAt is.
    at: new Date(),
    userId: actor.id,
    userName: actor.name,
    entityType: e.entityType,
    entityId: e.entityId,
    action: e.action,
    version: e.version ?? null,
    changedFields: fields,
    // JSON round-trip: jsonb columns need plain values, not Date objects.
    before: before ? JSON.parse(JSON.stringify(before)) : null,
    after: after ? JSON.parse(JSON.stringify(after)) : null,
  })
  // Same transaction: delivered to other screens only if this change commits.
  const row = (after || before || {}) as Record<string, unknown>
  await publishChange(ex, actor, {
    type: e.entityType,
    action: e.action,
    id: e.entityId,
    date: e.entityType === 'production_plan' ? (row.date as string) ?? null : null,
    stage: e.entityType === 'production_plan' ? (row.stage as string) ?? null : null,
    label: e.entityType === 'order' ? (row.customerOrderNo as string) ?? null : null,
  })
}

export type FieldChange = { field: string; from: unknown; to: unknown }
export type Conflict = {
  entityType: EntityType
  entityId: string
  currentVersion: number
  changedBy: string | null
  changedAt: string | null
  changes: FieldChange[]
}

// What happened to a record since the caller loaded `sinceVersion`: who, when,
// and per field the value the caller saw -> the value now stored.
export async function conflictDetails(
  ex: Executor,
  entityType: EntityType,
  entityId: string,
  sinceVersion: number,
  current: { version: number; updatedByName?: string | null; updatedAt?: Date | string | null },
): Promise<Conflict> {
  const events = await ex.select().from(auditEvents)
    .where(and(eq(auditEvents.entityType, entityType), eq(auditEvents.entityId, entityId), gt(auditEvents.version, sinceVersion)))
    .orderBy(asc(auditEvents.at))

  const merged = new Map<string, FieldChange>()
  for (const ev of events) {
    const b = (ev.before || {}) as Record<string, unknown>
    const a = (ev.after || {}) as Record<string, unknown>
    for (const f of ev.changedFields || []) {
      const prev = merged.get(f)
      merged.set(f, { field: f, from: prev ? prev.from : b[f] ?? null, to: a[f] ?? null })
    }
  }
  const names = [...new Set(events.map(e => e.userName).filter(Boolean))] as string[]
  const last = events[events.length - 1]
  const updatedAt = current.updatedAt instanceof Date ? current.updatedAt.toISOString() : current.updatedAt ?? null

  return {
    entityType,
    entityId,
    currentVersion: current.version,
    changedBy: names.length ? names.join(', ') : current.updatedByName ?? null,
    changedAt: last ? last.at.toISOString() : updatedAt,
    changes: [...merged.values()].filter(c => norm(c.from) !== norm(c.to)),
  }
}

// Parses an optional expected version from a request. undefined = the caller
// did not send one (older screen) and gets today's behaviour, no check.
export function parseExpectedVersion(value: unknown): { ok: true; version: number | undefined } | { ok: false; error: string } {
  if (value === undefined || value === null || value === '') return { ok: true, version: undefined }
  const n = typeof value === 'string' ? Number(value) : value
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) return { ok: false, error: 'version must be a positive integer' }
  return { ok: true, version: n }
}

export function conflictMessage(c: Conflict) {
  return `Changed by ${c.changedBy || 'someone else'} since you opened it - reload to see their changes.`
}
