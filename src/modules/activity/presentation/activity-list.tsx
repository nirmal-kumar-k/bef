'use client'

import { cn } from '@/shared/lib/utils'
import { fieldLabel, formatValue, formatWhen } from '@/shared/ui/conflict-dialog'

export type ActivityEvent = {
  id: string
  at: string
  userName: string | null
  entityType: 'order' | 'production_plan'
  entityId: string
  action: 'create' | 'update' | 'delete'
  orderId: string | null
  orderNo: string | null
  date: string | null
  stage: string | null
  changes: { field: string; from: unknown; to: unknown }[]
}

const VERB = { create: 'created', update: 'changed', delete: 'deleted' } as const
const TONE = { create: 'bg-emerald-50 text-emerald-700', update: 'bg-[#EEF2FF] text-[#4F46E5]', delete: 'bg-red-50 text-red-600' } as const

function what(e: ActivityEvent, showOrder: boolean) {
  if (e.entityType === 'order') return `order ${e.orderNo || ''}`.trim()
  const day = e.date ? new Date(`${e.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''
  return `${e.stage || ''} plan${day ? ` for ${day}` : ''}${showOrder && e.orderNo ? `, order ${e.orderNo}` : ''}`.trim()
}

// One line per change: who, when, what, and each field's old -> new value.
export function ActivityList({ events, showOrder = true, empty = 'No changes recorded yet.' }: {
  events: ActivityEvent[]
  showOrder?: boolean
  empty?: string
}) {
  if (events.length === 0) return <p className="text-sm text-[#94A3B8] italic py-4 text-center">{empty}</p>
  return (
    <ul className="divide-y divide-[#E0E7FF]">
      {events.map(e => (
        <li key={e.id} className="py-3 flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-semibold text-[#172554]">{e.userName || 'Someone'}</span>
            <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', TONE[e.action])}>{VERB[e.action]}</span>
            <span className="text-[#172554]">{what(e, showOrder)}</span>
            <span className="text-xs text-[#94A3B8] ml-auto">{formatWhen(e.at)}</span>
          </div>
          {e.changes.length > 0 && (
            <div className="flex flex-col gap-0.5 pl-1">
              {e.changes.slice(0, 8).map(c => (
                <div key={c.field} className="text-xs text-[#64748B]">
                  <span className="text-[#172554]">{fieldLabel(c.field)}</span>
                  {e.action === 'update' ? (
                    <>: <span className="line-through">{formatValue(c.from)}</span> → <span className="font-semibold text-[#172554]">{formatValue(c.to)}</span></>
                  ) : (
                    <>: {formatValue(e.action === 'delete' ? c.from : c.to)}</>
                  )}
                </div>
              ))}
              {e.changes.length > 8 && <div className="text-xs text-[#94A3B8]">+{e.changes.length - 8} more field(s)</div>}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
