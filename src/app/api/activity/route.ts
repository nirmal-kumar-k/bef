import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq, gte, inArray, lt, sql, type SQL } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { auditEvents, orders, stockMovements } from '@/infrastructure/database/schema'
import { getSessionUser } from '@/shared/lib/auth'

export const dynamic = 'force-dynamic'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f-]{36}$/i
const BOOKKEEPING = new Set(['updatedAt', 'createdAt', 'version', 'updatedById', 'updatedByName', 'id'])
// Fields worth showing for a create/delete (the full row is in the record).
const KEY_FIELDS = ['customerOrderNo', 'customer', 'deliveryDate', 'date', 'stage', 'quantityScheduled', 'heatNo', 'coreBoxCode', 'rejectedQuantity', 'cart']
const STOCK_REASON: Record<string, string> = {
  opening: 'Opening balance', inspection: 'Inspection accepted', inspection_correction: 'Inspection corrected',
  inspection_undo: 'Inspection undone', knockout: 'Knockout confirmed', adjustment: 'Stock adjusted',
}

// An IST calendar day starts at 18:30 UTC the previous day. Both sources store
// UTC (written by the app), so day filters convert here.
function istDayStartUtc(day: string) {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) - 330 * 60 * 1000)
}

type Change = { field: string; from: unknown; to: unknown }

// What makes a change worth highlighting (agreed 2026-11-06): deletions,
// stock adjustments (manual counts, inspection corrections/undos), planned
// quantities moved by 25% or more, and changes to an order's products or
// delivery date. Returns the reason in plain words, or null.
function importance(e: { entityType: string; action: string; stage?: string | null; changes: Change[]; reason?: string }): string | null {
  if (e.action === 'delete') return 'Deleted'
  if (e.entityType === 'stock') {
    return e.reason === 'adjustment' || e.reason === 'inspection_correction' || e.reason === 'inspection_undo' ? STOCK_REASON[e.reason] : null
  }
  if (e.action !== 'update') return null
  const has = (f: string) => e.changes.find(c => c.field === f)
  if (e.entityType === 'order') {
    if (has('cart')) return 'Products changed'
    if (has('deliveryDate')) return 'Delivery date changed'
    return null
  }
  if (e.stage === 'Inspection' && (has('quantityScheduled') || has('rejectedQuantity'))) return 'Inspection corrected'
  const q = has('quantityScheduled')
  if (q && typeof q.from === 'number' && typeof q.to === 'number' && q.from > 0) {
    const pct = Math.round(((q.to - q.from) / q.from) * 100)
    if (Math.abs(pct) >= 25) return `Quantity ${pct > 0 ? '+' : ''}${pct}%`
  }
  return null
}

// GET /api/activity - the change history (audit_events) merged with the stock
// ledger (stock_movements), newest first. Scope:
//   ?orderId=<uuid>    an order, every plan that belonged to it (incl. deleted
//                      ones) and the stock its inspections moved - any logged-in user
//   ?entityId=<uuid>   one plan or order and the stock it moved - any logged-in user
//   ?productId=<uuid>  one product's stock ledger - any logged-in user
//   otherwise          the whole feed - admin only
// Filters: ?from=&to= (IST days) &type=order|production_plan|stock &user=<name>
//          &important=1 &before=<ISO> (paging) &limit=
export async function GET(request: NextRequest) {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const q = request.nextUrl.searchParams
  const orderId = q.get('orderId'), entityId = q.get('entityId'), productId = q.get('productId')
  const scoped = !!(orderId || entityId || productId)
  if (!scoped && session.role !== 'admin') {
    return NextResponse.json({ error: 'Only an admin can view all activity' }, { status: 403 })
  }

  try {
    for (const id of [orderId, entityId, productId]) {
      if (id && !UUID.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }
    const from = q.get('from'), to = q.get('to')
    if ((from && !DATE.test(from)) || (to && !DATE.test(to))) return NextResponse.json({ error: 'from/to must be YYYY-MM-DD' }, { status: 400 })
    const type = q.get('type')
    if (type && !['order', 'production_plan', 'stock'].includes(type)) return NextResponse.json({ error: 'type must be order, production_plan or stock' }, { status: 400 })
    const before = q.get('before')
    const beforeDate = before ? new Date(before) : null
    if (beforeDate && isNaN(beforeDate.getTime())) return NextResponse.json({ error: 'before must be a timestamp' }, { status: 400 })
    const user = q.get('user')
    const importantOnly = q.get('important') === '1'
    const limit = Math.min(Math.max(Number(q.get('limit')) || 100, 1), 500)
    // When only important entries are wanted, read further back so a page
    // still fills after filtering.
    const fetchN = importantOnly ? Math.min(limit * 5, 2000) : limit
    const fromUtc = from ? istDayStartUtc(from) : null
    const toUtc = to ? (() => { const e = istDayStartUtc(to); e.setUTCDate(e.getUTCDate() + 1); return e })() : null

    // ---- changes to orders and plans
    let auditRows: (typeof auditEvents.$inferSelect)[] = []
    if (!productId && type !== 'stock') {
      const f: SQL[] = []
      if (orderId) {
        f.push(sql`(${auditEvents.entityId} = ${orderId}
          or (${auditEvents.entityType} = 'production_plan'
              and (${auditEvents.after}->>'orderId' = ${orderId} or ${auditEvents.before}->>'orderId' = ${orderId})))`)
      }
      if (entityId) f.push(eq(auditEvents.entityId, entityId))
      if (type) f.push(eq(auditEvents.entityType, type))
      if (user) f.push(eq(auditEvents.userName, user))
      if (fromUtc) f.push(gte(auditEvents.at, fromUtc))
      if (toUtc) f.push(lt(auditEvents.at, toUtc))
      if (beforeDate) f.push(lt(auditEvents.at, beforeDate))
      auditRows = await db.select().from(auditEvents).where(f.length ? and(...f) : undefined).orderBy(desc(auditEvents.at)).limit(fetchN)
    }

    // ---- stock movements
    let stockRows: (typeof stockMovements.$inferSelect)[] = []
    if (!type || type === 'stock') {
      const f: SQL[] = []
      if (orderId) f.push(eq(stockMovements.orderId, orderId))
      if (entityId) f.push(eq(stockMovements.planId, entityId))
      if (productId) f.push(eq(stockMovements.productId, productId))
      if (user) f.push(eq(stockMovements.userName, user))
      if (fromUtc) f.push(gte(stockMovements.at, fromUtc))
      if (toUtc) f.push(lt(stockMovements.at, toUtc))
      if (beforeDate) f.push(lt(stockMovements.at, beforeDate))
      stockRows = await db.select().from(stockMovements).where(f.length ? and(...f) : undefined).orderBy(desc(stockMovements.at)).limit(fetchN)
    }

    // Order numbers for context.
    const orderIds = [...new Set([
      ...auditRows.map(r => r.entityType === 'order' ? r.entityId : ((r.after || r.before || {}) as Record<string, unknown>).orderId as string | undefined),
      ...stockRows.map(r => r.orderId),
    ].filter(Boolean))] as string[]
    const orderNos = new Map<string, string>()
    if (orderIds.length) {
      for (const o of await db.select({ id: orders.id, no: orders.customerOrderNo }).from(orders).where(inArray(orders.id, orderIds))) orderNos.set(o.id, o.no)
    }

    const fromAudit = auditRows.map(r => {
      const b = (r.before || {}) as Record<string, unknown>
      const a = (r.after || {}) as Record<string, unknown>
      const snap = r.action === 'delete' ? b : a
      const oid = r.entityType === 'order' ? r.entityId : (snap.orderId as string | null) ?? null
      const fields = r.action === 'update'
        ? (r.changedFields || [])
        : KEY_FIELDS.filter(f => snap[f] !== undefined && snap[f] !== null && snap[f] !== '' && !BOOKKEEPING.has(f))
      const changes: Change[] = fields.map(f => ({ field: f, from: r.action === 'create' ? null : b[f] ?? null, to: r.action === 'delete' ? null : a[f] ?? null }))
      const stage = (snap.stage as string) ?? null
      return {
        id: r.id, at: r.at.toISOString(), userName: r.userName,
        entityType: r.entityType as 'order' | 'production_plan', entityId: r.entityId, action: r.action as 'create' | 'update' | 'delete',
        orderId: oid,
        orderNo: (oid && orderNos.get(oid)) || (r.entityType === 'order' ? (snap.customerOrderNo as string) : null) || null,
        date: (snap.date as string) ?? null, stage, changes,
        productName: null as string | null, note: null as string | null, reason: null as string | null,
        important: importance({ entityType: r.entityType, action: r.action, stage, changes }),
      }
    })
    const fromStock = stockRows.map(r => ({
      id: r.id, at: r.at.toISOString(), userName: r.userName,
      entityType: 'stock' as const, entityId: r.productId ?? r.id, action: 'update' as const,
      orderId: r.orderId, orderNo: (r.orderId && orderNos.get(r.orderId)) || null,
      date: null, stage: null,
      changes: [{ field: 'stock', from: r.balanceAfter - r.delta, to: r.balanceAfter }],
      productName: r.productName, note: r.note, reason: STOCK_REASON[r.reason] || r.reason,
      important: importance({ entityType: 'stock', action: 'update', changes: [], reason: r.reason }),
    }))

    let events = [...fromAudit, ...fromStock].sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0))
    if (importantOnly) events = events.filter(e => e.important)
    events = events.slice(0, limit)

    const users = session.role === 'admin' && !scoped
      ? [...new Set([
          ...(await db.selectDistinct({ name: auditEvents.userName }).from(auditEvents)).map(u => u.name),
          ...(await db.selectDistinct({ name: stockMovements.userName }).from(stockMovements)).map(u => u.name),
        ].filter(Boolean))]
      : undefined

    return NextResponse.json({ events, users })
  } catch (error) {
    console.error('GET /api/activity error:', error)
    return NextResponse.json({ error: 'Failed to load activity' }, { status: 500 })
  }
}
