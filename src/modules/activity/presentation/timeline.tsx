'use client'

import { useState } from 'react'
import { cn } from '@/shared/lib/utils'
import { fieldLabel, formatValue } from '@/shared/ui/conflict-dialog'

export type ActivityEvent = {
  id: string
  at: string
  userName: string | null
  entityType: 'order' | 'production_plan' | 'stock'
  entityId: string
  action: 'create' | 'update' | 'delete'
  orderId: string | null
  orderNo: string | null
  date: string | null
  stage: string | null
  changes: { field: string; from: unknown; to: unknown }[]
  productName: string | null
  note: string | null
  reason: string | null
  important: string | null
}

const VERB = { create: 'added', update: 'changed', delete: 'deleted' } as const

const initials = (name: string | null) =>
  (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

function dayLabel(iso: string) {
  const d = new Date(iso)
  const key = (x: Date) => x.toLocaleDateString('en-CA')
  const today = new Date(); const yesterday = new Date(Date.now() - 86400000)
  if (key(d) === key(today)) return 'Today'
  if (key(d) === key(yesterday)) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

// What the entry is about, in the words the floor uses.
export function subject(e: ActivityEvent, withOrder: boolean) {
  if (e.entityType === 'stock') return `${e.reason || 'Stock'}${e.productName ? ` · ${e.productName}` : ''}`
  if (e.entityType === 'order') return `order ${e.orderNo || ''}`.trim()
  const day = e.date ? new Date(`${e.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''
  return `${e.stage || ''} plan${day ? ` · ${day}` : ''}${withOrder && e.orderNo ? ` · ${e.orderNo}` : ''}`.trim()
}

function Change({ c, action }: { c: ActivityEvent['changes'][number]; action: ActivityEvent['action'] }) {
  if (action !== 'update') {
    return <span>{fieldLabel(c.field)} <span className="text-[#172554]">{formatValue(action === 'delete' ? c.from : c.to)}</span></span>
  }
  return (
    <span>
      {fieldLabel(c.field)}{' '}
      <span className="tabular-nums text-[#94A3B8] line-through decoration-[#CBD5E1]">{formatValue(c.from)}</span>
      <span className="mx-1 text-[#94A3B8]">→</span>
      <span className="tabular-nums font-semibold text-[#172554]">{formatValue(c.to)}</span>
    </span>
  )
}

// The pour line: a quiet vertical spine; each change hangs off it as the
// editor's initials. Important changes carry an amber "ingot" tag naming why.
export function Timeline({ events, withOrder = true }: { events: ActivityEvent[]; withOrder?: boolean }) {
  const [open, setOpen] = useState<string | null>(null)
  const groups: { label: string; items: ActivityEvent[] }[] = []
  for (const e of events) {
    const label = dayLabel(e.at)
    if (groups.at(-1)?.label !== label) groups.push({ label, items: [] })
    groups.at(-1)!.items.push(e)
  }

  return (
    <div className="space-y-6">
      {groups.map(g => (
        <section key={g.label}>
          <h4 className="font-heading text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#94A3B8] mb-2 pl-11">{g.label}</h4>
          <ol className="relative">
            {/* the spine */}
            <span aria-hidden className="absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-[#E0E7FF] via-[#C7D2FE] to-[#E0E7FF]" />
            {g.items.map(e => {
              const first = e.changes[0]
              const isOpen = open === e.id
              const more = e.changes.length > 1 || !!e.note
              return (
                <li key={e.id} className="relative">
                  <button
                    type="button"
                    onClick={() => more && setOpen(isOpen ? null : e.id)}
                    aria-expanded={more ? isOpen : undefined}
                    className={cn(
                      'group w-full text-left flex gap-3 rounded-lg py-2 pr-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/40',
                      more && 'hover:bg-[#F8FAFF] cursor-pointer',
                      !more && 'cursor-default',
                    )}
                  >
                    <span className={cn(
                      'relative z-10 shrink-0 w-[31px] h-[31px] rounded-full bg-white grid place-items-center text-[10.5px] font-bold tracking-wide',
                      e.important
                        ? 'text-[#B45309] ring-2 ring-[#F59E0B] shadow-[0_0_0_4px_rgba(245,158,11,0.14)]'
                        : 'text-[#4F46E5] ring-1 ring-[#E0E7FF]',
                    )}>
                      {initials(e.userName)}
                    </span>
                    <span className="min-w-0 flex-1 pt-[5px]">
                      <span className="flex items-baseline gap-2">
                        <span className="min-w-0 truncate text-[13px] text-[#64748B]">
                          <span className="font-semibold text-[#172554]">{e.userName || 'Someone'}</span>{' '}
                          {e.entityType === 'stock' ? '' : `${VERB[e.action]} `}
                          <span className="text-[#172554]">{subject(e, withOrder)}</span>
                        </span>
                        <span className="ml-auto shrink-0 text-[11px] tabular-nums text-[#94A3B8]">{time(e.at)}</span>
                      </span>
                      {(first || e.important) && (
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[#64748B]">
                          {e.important && (
                            <span className="rounded-[4px] bg-gradient-to-b from-[#F59E0B] to-[#D97706] px-1.5 py-[1px] text-[10.5px] font-semibold text-white shadow-sm">
                              {e.important}
                            </span>
                          )}
                          {first && <Change c={first} action={e.action} />}
                          {more && !isOpen && <span className="text-[11px] text-[#94A3B8] group-hover:text-[#4F46E5]">+ details</span>}
                        </span>
                      )}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="ml-[43px] mb-2 rounded-lg border border-[#E0E7FF] bg-[#F8FAFF] px-3 py-2 text-[12px] text-[#64748B] space-y-1 animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none">
                      {e.changes.slice(1).map(c => <div key={c.field}><Change c={c} action={e.action} /></div>)}
                      {e.note && <div>Note: <span className="text-[#172554]">{e.note}</span></div>}
                      {withOrder && e.orderNo && e.entityType === 'stock' && <div>Order <span className="text-[#172554]">{e.orderNo}</span></div>}
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}

// Up to three recent important changes, shown above the timeline.
export function Highlights({ events, withOrder = true }: { events: ActivityEvent[]; withOrder?: boolean }) {
  const top = events.filter(e => e.important).slice(0, 3)
  if (top.length === 0) return null
  return (
    <div>
      <h4 className="font-heading text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#94A3B8] mb-2">Highlights</h4>
      <div className="grid gap-2">
        {top.map(e => (
          <div key={e.id} className="relative overflow-hidden rounded-lg border border-[#FDE68A] bg-[#FFFBEB] pl-4 pr-3 py-2">
            <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-[#F59E0B] to-[#D97706]" />
            <div className="flex items-baseline gap-2 text-[12.5px]">
              <span className="font-semibold text-[#92400E]">{e.important}</span>
              <span className="min-w-0 truncate text-[#78350F]/80">{subject(e, withOrder)}</span>
              <span className="ml-auto shrink-0 text-[11px] text-[#B45309]/70">{dayLabel(e.at)}, {time(e.at)}</span>
            </div>
            <div className="text-[11.5px] text-[#92400E]/70">by {e.userName || 'someone'}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
