import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq, gte, inArray, lt, sql, type SQL } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { auditEvents, orders } from '@/infrastructure/database/schema'
import { getSessionUser } from '@/shared/lib/auth'

export const dynamic = 'force-dynamic'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const BOOKKEEPING = new Set(['updatedAt', 'createdAt', 'version', 'updatedById', 'updatedByName', 'id'])
// Fields worth showing for a create/delete (the full row is in the record).
const KEY_FIELDS = ['customerOrderNo', 'customer', 'deliveryDate', 'date', 'stage', 'quantityScheduled', 'heatNo', 'coreBoxCode', 'rejectedQuantity', 'cart']

// An IST calendar day starts at 18:30 UTC the previous day. audit_events.at
// is stored as UTC (written by the app), so day filters convert here.
function istDayStartUtc(day: string) {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) - 330 * 60 * 1000)
}

// GET /api/activity - the change history (audit_events), newest first.
//   ?orderId=<uuid>  one order and every plan that belonged to it (any logged-in user)
//   otherwise        the whole feed (admin only), filterable by
//   ?from=&to= (IST days, inclusive) &type=order|production_plan &user=<name> &before=<ISO> (paging)
export async function GET(request: NextRequest) {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const q = request.nextUrl.searchParams
  const orderId = q.get('orderId')
  if (!orderId && session.role !== 'admin') {
    return NextResponse.json({ error: 'Only an admin can view all activity' }, { status: 403 })
  }

  try {
    const filters: SQL[] = []
    if (orderId) {
      if (!/^[0-9a-f-]{36}$/i.test(orderId)) return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 })
      // The order itself, plus plans whose before/after snapshot carries the
      // order - which still finds plans that have since been deleted.
      filters.push(sql`(${auditEvents.entityId} = ${orderId}
        or (${auditEvents.entityType} = 'production_plan'
            and (${auditEvents.after}->>'orderId' = ${orderId} or ${auditEvents.before}->>'orderId' = ${orderId})))`)
    }
    const from = q.get('from'), to = q.get('to')
    if ((from && !DATE.test(from)) || (to && !DATE.test(to))) return NextResponse.json({ error: 'from/to must be YYYY-MM-DD' }, { status: 400 })
    if (from) filters.push(gte(auditEvents.at, istDayStartUtc(from)))
    if (to) {
      const end = istDayStartUtc(to); end.setUTCDate(end.getUTCDate() + 1)
      filters.push(lt(auditEvents.at, end))
    }
    const type = q.get('type')
    if (type) {
      if (type !== 'order' && type !== 'production_plan') return NextResponse.json({ error: 'type must be order or production_plan' }, { status: 400 })
      filters.push(eq(auditEvents.entityType, type))
    }
    const user = q.get('user')
    if (user) filters.push(eq(auditEvents.userName, user))
    const before = q.get('before')
    if (before) {
      const b = new Date(before)
      if (isNaN(b.getTime())) return NextResponse.json({ error: 'before must be a timestamp' }, { status: 400 })
      filters.push(lt(auditEvents.at, b))
    }
    const limit = Math.min(Math.max(Number(q.get('limit')) || 100, 1), 500)

    const rows = await db.select().from(auditEvents)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(auditEvents.at)).limit(limit)

    // Order numbers for context (orders may since have been deleted - then
    // the snapshot in the event still has it for the order's own events).
    const orderIds = [...new Set(rows.map(r => {
      const snap = (r.after || r.before || {}) as Record<string, unknown>
      return r.entityType === 'order' ? r.entityId : (snap.orderId as string | undefined)
    }).filter(Boolean))] as string[]
    const orderNos = new Map<string, string>()
    if (orderIds.length) {
      const found = await db.select({ id: orders.id, no: orders.customerOrderNo }).from(orders).where(inArray(orders.id, orderIds))
      for (const o of found) orderNos.set(o.id, o.no)
    }

    const users = session.role === 'admin' && !orderId
      ? (await db.selectDistinct({ name: auditEvents.userName }).from(auditEvents)).map(u => u.name).filter(Boolean)
      : undefined

    return NextResponse.json({
      events: rows.map(r => {
        const b = (r.before || {}) as Record<string, unknown>
        const a = (r.after || {}) as Record<string, unknown>
        const snap = r.action === 'delete' ? b : a
        const oid = r.entityType === 'order' ? r.entityId : (snap.orderId as string | null) ?? null
        const fields = r.action === 'update'
          ? (r.changedFields || [])
          : KEY_FIELDS.filter(f => snap[f] !== undefined && snap[f] !== null && snap[f] !== '' && !BOOKKEEPING.has(f))
        return {
          id: r.id,
          at: r.at.toISOString(),
          userName: r.userName,
          entityType: r.entityType,
          entityId: r.entityId,
          action: r.action,
          orderId: oid,
          orderNo: (oid && orderNos.get(oid)) || (r.entityType === 'order' ? (snap.customerOrderNo as string) : null) || null,
          date: (snap.date as string) ?? null,
          stage: (snap.stage as string) ?? null,
          changes: fields.map(f => ({ field: f, from: r.action === 'create' ? null : b[f] ?? null, to: r.action === 'delete' ? null : a[f] ?? null })),
        }
      }),
      users,
    })
  } catch (error) {
    console.error('GET /api/activity error:', error)
    return NextResponse.json({ error: 'Failed to load activity' }, { status: 500 })
  }
}
