import { db } from '@/infrastructure/database/client'
import { currentActor } from '@/infrastructure/audit'
import { publishChange, type ChangeType } from '@/infrastructure/realtime'

type Ctx = { params?: Promise<Record<string, string>> }

// For routes that are not audited (master data, day re-open): runs the
// handler unchanged and, only if it returned success, tells other screens.
// By the time a handler returns, its write has committed, so only completed
// changes are announced.
export function publishOnSuccess<R extends Request, C>(
  type: ChangeType, table: string, action: 'create' | 'update' | 'delete',
  handler: (request: R, ctx: C) => Promise<Response>,
): (request: R, ctx: C) => Promise<Response> {
  return async (request, ctx) => {
    const res = await handler(request, ctx)
    if (res.ok) {
      try {
        const c = ctx as Ctx | undefined
        const params = c?.params ? await c.params : undefined
        await publishChange(db, await currentActor(), { type, table, action, id: params?.id ?? null })
      } catch (err) {
        // The change itself succeeded; a missed live update only means other
        // screens refresh on their next reload.
        console.error(`Live update for ${table} ${action} failed:`, err)
      }
    }
    return res
  }
}
