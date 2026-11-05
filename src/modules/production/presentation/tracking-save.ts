import { formatWhen } from '@/shared/ui/conflict-dialog'

// Saves Tracking rows in parallel and reports which were NOT saved and why.
// Previously every response was discarded, so a refused or failed save
// vanished silently. Each body carries the row's version, so a row someone
// else saved meanwhile is refused (409) rather than overwritten.
export async function saveTrackingRows(
  rowIds: string[],
  bodyFor: (rowId: string) => Record<string, unknown> | null,
  labelFor: (rowId: string) => string,
): Promise<{ failedIds: string[]; message: string | null }> {
  const results = await Promise.all(rowIds.map(async rowId => {
    const body = bodyFor(rowId)
    if (!body) return { rowId, problem: null as string | null }
    try {
      const res = await fetch(`/api/production-plans/${rowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) return { rowId, problem: null }
      const data = await res.json().catch(() => ({}))
      if (res.status === 409 && data.conflict) {
        const when = formatWhen(data.conflict.changedAt)
        return { rowId, problem: `${labelFor(rowId)}: saved by ${data.conflict.changedBy || 'someone else'}${when ? ` at ${when}` : ''} while you were editing` }
      }
      return { rowId, problem: `${labelFor(rowId)}: ${data.error || `HTTP ${res.status}`}` }
    } catch {
      return { rowId, problem: `${labelFor(rowId)}: network error` }
    }
  }))

  const failed = results.filter(r => r.problem)
  if (failed.length === 0) return { failedIds: [], message: null }
  return {
    failedIds: failed.map(r => r.rowId),
    message: `${failed.length} row(s) were NOT saved:\n${failed.map(r => `• ${r.problem}`).join('\n')}\n\n`
      + 'Your figures for those rows are still in the boxes. Check them against the refreshed values, then Save again to keep yours.',
  }
}

// Keeps only the given keys - used to hold on to the edits of rows that
// failed to save while clearing the ones that went through.
export function pick<T>(obj: Record<string, T>, keys: string[]): Record<string, T> {
  return Object.fromEntries(keys.filter(k => k in obj).map(k => [k, obj[k]]))
}
