'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Switch } from '@/shared/ui/switch'
import { useLiveRefresh } from '@/shared/realtime/live-updates'
import { Highlights, Timeline, type ActivityEvent } from './timeline'

const PAGE = 100
const selectClass = 'h-9 rounded-md border border-[#E0E7FF] bg-white px-2 text-sm text-[#172554] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/40'

// Admin feed of every change to orders, plans and stock, newest first.
export function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [users, setUsers] = useState<string[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [type, setType] = useState('')
  const [user, setUser] = useState('')
  const [importantOnly, setImportantOnly] = useState(false)
  const [orderNo, setOrderNo] = useState('')
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)
  const [error, setError] = useState('')

  const query = useCallback((before?: string) => {
    const q = new URLSearchParams({ limit: String(PAGE) })
    if (from) q.set('from', from)
    if (to) q.set('to', to)
    if (type) q.set('type', type)
    if (user) q.set('user', user)
    if (importantOnly) q.set('important', '1')
    if (before) q.set('before', before)
    return `/api/activity?${q}`
  }, [from, to, type, user, importantOnly])

  const load = useCallback(async () => {
    setError('')
    const res = await fetch(query())
    const body = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) { setError(body.error || 'Could not load activity'); return }
    setEvents(body.events); setUsers(body.users || []); setMore(body.events.length === PAGE)
  }, [query])

  useEffect(() => { load() }, [load])
  useLiveRefresh(['order', 'production_plan', 'product'], load)

  const loadMore = async () => {
    const last = events[events.length - 1]
    if (!last) return
    const res = await fetch(query(last.at))
    if (!res.ok) return
    const body = await res.json()
    setEvents(prev => [...prev, ...body.events]); setMore(body.events.length === PAGE)
  }

  // Order number is matched on what's loaded (it's display text).
  const term = orderNo.trim().toLowerCase()
  const shown = term ? events.filter(e => (e.orderNo || '').toLowerCase().includes(term)) : events

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="space-y-1">
        <div className="font-heading text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#94A3B8]">Admin</div>
        <h1 className="text-3xl font-heading font-extrabold text-[#172554] tracking-tight">Activity</h1>
        <p className="text-[#64748B] text-sm">Who changed which order, plan or stock figure, and when.</p>
      </div>

      <div className="bg-white border border-[#E0E7FF] rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <label className="text-xs text-[#64748B] flex flex-col gap-1">From<Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label className="text-xs text-[#64748B] flex flex-col gap-1">To<Input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
          <label className="text-xs text-[#64748B] flex flex-col gap-1">What
            <select value={type} onChange={e => setType(e.target.value)} className={selectClass}>
              <option value="">Everything</option>
              <option value="order">Orders</option>
              <option value="production_plan">Plans</option>
              <option value="stock">Stock</option>
            </select>
          </label>
          <label className="text-xs text-[#64748B] flex flex-col gap-1">Who
            <select value={user} onChange={e => setUser(e.target.value)} className={selectClass}>
              <option value="">Anyone</option>
              {users.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label className="text-xs text-[#64748B] flex flex-col gap-1">Order no.<Input placeholder="e.g. SO-12" value={orderNo} onChange={e => setOrderNo(e.target.value)} /></label>
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-[#64748B] cursor-pointer select-none">
          <Switch checked={importantOnly} onCheckedChange={checked => setImportantOnly(checked)} />
          Important only
          <span className="text-[#94A3B8]">- deletions, stock adjustments, quantity changes of 25%+, product or delivery-date changes</span>
        </label>
      </div>

      <div className="bg-white border border-[#E0E7FF] rounded-xl px-5 py-5 space-y-6">
        {loading ? <p className="text-sm text-[#94A3B8] text-center py-6">Loading...</p>
          : error ? <p className="text-sm text-red-600 text-center py-6">{error}</p>
          : shown.length === 0 ? <p className="text-sm text-[#94A3B8] text-center py-6">No changes match these filters.</p>
          : (
            <>
              {!importantOnly && <Highlights events={shown} />}
              <Timeline events={shown} />
            </>
          )}
      </div>
      {more && !term && (
        <div className="flex justify-center"><Button variant="outline" onClick={loadMore}>Load older changes</Button></div>
      )}
    </div>
  )
}
