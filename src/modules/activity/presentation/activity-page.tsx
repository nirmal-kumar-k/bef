'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { useLiveRefresh } from '@/shared/realtime/live-updates'
import { ActivityList, type ActivityEvent } from './activity-list'

// Admin feed of every change to orders and production plans, newest first.
export function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [users, setUsers] = useState<string[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [type, setType] = useState('')
  const [user, setUser] = useState('')
  const [orderNo, setOrderNo] = useState('')
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)
  const [error, setError] = useState('')

  const query = useCallback((before?: string) => {
    const q = new URLSearchParams({ limit: '100' })
    if (from) q.set('from', from)
    if (to) q.set('to', to)
    if (type) q.set('type', type)
    if (user) q.set('user', user)
    if (before) q.set('before', before)
    return `/api/activity?${q}`
  }, [from, to, type, user])

  const load = useCallback(async () => {
    setError('')
    const res = await fetch(query())
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { setError(body.error || 'Could not load activity'); setLoading(false); return }
    setEvents(body.events); setUsers(body.users || []); setMore(body.events.length === 100); setLoading(false)
  }, [query])

  useEffect(() => { load() }, [load])
  useLiveRefresh(['order', 'production_plan'], load)

  const loadMore = async () => {
    const last = events[events.length - 1]
    if (!last) return
    const res = await fetch(query(last.at))
    if (!res.ok) return
    const body = await res.json()
    setEvents(prev => [...prev, ...body.events]); setMore(body.events.length === 100)
  }

  // Order number is matched on what's already loaded (it is shown text).
  const shown = orderNo.trim() ? events.filter(e => (e.orderNo || '').toLowerCase().includes(orderNo.trim().toLowerCase())) : events

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-heading font-extrabold text-[#172554] tracking-tight">Activity</h1>
        <p className="text-[#64748B] text-sm">Every change to orders and production plans - who, when, and what changed.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-white border border-[#E0E7FF] rounded-xl p-4">
        <label className="text-xs text-[#64748B] flex flex-col gap-1">From<Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label className="text-xs text-[#64748B] flex flex-col gap-1">To<Input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
        <label className="text-xs text-[#64748B] flex flex-col gap-1">What
          <select value={type} onChange={e => setType(e.target.value)} className="h-9 rounded-md border border-[#E0E7FF] bg-white px-2 text-sm text-[#172554]">
            <option value="">Everything</option>
            <option value="order">Orders</option>
            <option value="production_plan">Plans</option>
          </select>
        </label>
        <label className="text-xs text-[#64748B] flex flex-col gap-1">Who
          <select value={user} onChange={e => setUser(e.target.value)} className="h-9 rounded-md border border-[#E0E7FF] bg-white px-2 text-sm text-[#172554]">
            <option value="">Anyone</option>
            {users.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
        <label className="text-xs text-[#64748B] flex flex-col gap-1">Order no.<Input placeholder="e.g. SO-12" value={orderNo} onChange={e => setOrderNo(e.target.value)} /></label>
      </div>

      <div className="bg-white border border-[#E0E7FF] rounded-xl px-5 py-2">
        {loading ? <p className="text-sm text-[#94A3B8] py-6 text-center">Loading...</p>
          : error ? <p className="text-sm text-red-600 py-6 text-center">{error}</p>
          : <ActivityList events={shown} empty="No changes match these filters." />}
      </div>
      {more && !orderNo && (
        <div className="flex justify-center"><Button variant="outline" onClick={loadMore}>Load older changes</Button></div>
      )}
    </div>
  )
}
