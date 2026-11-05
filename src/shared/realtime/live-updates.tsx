'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { generateId } from '@/shared/lib/utils'

// Browser side of live updates (server side: src/infrastructure/realtime).
//
// One EventSource per tab receives every committed change. Screens opt in with
// useLiveRefresh(types, refetch). Anything that holds unsaved input opts in
// with useEditing(active): while any editor is active, refreshes are held back
// - a refresh would reset the editor's rows and wipe what is being typed - and
// run as soon as the last editor closes. The save itself is still protected by
// the version check, so nothing can be overwritten in the meantime.

export type LiveEvent = {
  type: 'production_plan' | 'order' | 'product' | 'day_closure' | 'master' | 'resync'
  action?: 'create' | 'update' | 'delete'
  id?: string | null
  table?: string
  date?: string | null
  stage?: string | null
  label?: string | null
  by?: string | null
  clientId?: string | null
  at?: string
}

type Subscriber = { types: string[]; fn: (e: LiveEvent) => void }

type Ctx = {
  subscribe: (s: Subscriber) => () => void
  editorOpened: () => void
  editorClosed: () => void
  holdBack: (run: () => void, e: LiveEvent) => boolean
}

const LiveCtx = createContext<Ctx | null>(null)

const NOUN: Record<string, [string, string]> = {
  production_plan: ['plan row', 'plan rows'],
  order: ['order', 'orders'],
  product: ['stock', 'stock'],
  day_closure: ['day', 'days'],
}
const VERB: Record<string, string> = { create: 'added', update: 'updated', delete: 'deleted' }

function describe(e: LiveEvent, count: number) {
  const who = e.by || 'Someone'
  if (e.type === 'day_closure') return `${who} ${e.action === 'delete' ? 'reopened' : 'closed'} ${e.date || 'a day'}`
  if (e.type === 'master') return `${who} ${VERB[e.action || 'update']} ${e.table || 'master data'}`
  if (e.type === 'product') return `${who} updated stock${e.label ? ` for ${e.label}` : ''}`
  if (e.type === 'order' && count === 1 && e.label) return `${who} ${VERB[e.action || 'update']} order ${e.label}`
  const [one, many] = NOUN[e.type] || ['item', 'items']
  return `${who} ${VERB[e.action || 'update']} ${count === 1 ? `a ${one}` : `${count} ${many}`}`
}

export function LiveUpdatesProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const clientId = useRef<string>('')
  const subscribers = useRef(new Set<Subscriber>())
  const editors = useRef(0)
  const pending = useRef(new Set<() => void>())
  const [heldBack, setHeldBack] = useState<string[]>([])
  const [toasts, setToasts] = useState<{ key: number; text: string }[]>([])
  const [connected, setConnected] = useState(true)
  const toastBatch = useRef(new Map<string, { e: LiveEvent; count: number }>())
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Tag this tab's own writes so the server can mark the resulting events,
  // and this tab can ignore its own changes coming back.
  useEffect(() => {
    if (!enabled) return
    if (!clientId.current) clientId.current = generateId()
    const w = window as unknown as { __befFetchTagged?: boolean }
    if (w.__befFetchTagged) return
    w.__befFetchTagged = true
    const original = window.fetch.bind(window)
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
      const sameOriginApi = url.startsWith('/api/') || url.startsWith(`${window.location.origin}/api/`)
      if (sameOriginApi && method !== 'GET' && method !== 'HEAD') {
        const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined))
        headers.set('X-Client-Id', clientId.current)
        return original(input, { ...init, headers })
      }
      return original(input, init)
    }
  }, [enabled])

  const flushToasts = useCallback(() => {
    toastTimer.current = null
    const batch = [...toastBatch.current.values()]
    toastBatch.current.clear()
    const added = batch.map(({ e, count }) => ({ key: Math.random(), text: describe(e, count) }))
    if (added.length === 0) return
    setToasts(t => [...t, ...added].slice(-3))
    setTimeout(() => setToasts(t => t.filter(x => !added.some(a => a.key === x.key))), 5000)
  }, [])

  const dispatch = useCallback((e: LiveEvent) => {
    for (const s of subscribers.current) {
      if (e.type === 'resync' || s.types.includes(e.type)) s.fn(e)
    }
    if (e.type === 'resync') return
    // Group a burst (e.g. one Planning save = one event per row) into one toast.
    const key = `${e.by}|${e.type}|${e.action}|${e.table || ''}`
    const prev = toastBatch.current.get(key)
    toastBatch.current.set(key, { e, count: (prev?.count || 0) + 1 })
    if (!toastTimer.current) toastTimer.current = setTimeout(flushToasts, 1200)
  }, [flushToasts])

  useEffect(() => {
    if (!enabled) return
    const source = new EventSource('/api/events')
    let opened = false
    source.addEventListener('ready', () => {
      setConnected(true)
      // A later "ready" means the stream dropped and came back: anything
      // published meanwhile was missed, so every screen reloads its data.
      if (opened) dispatch({ type: 'resync' })
      opened = true
    })
    source.onmessage = msg => {
      let e: LiveEvent
      try { e = JSON.parse(msg.data) } catch { return }
      if (e.clientId && e.clientId === clientId.current) return
      dispatch(e)
    }
    source.onerror = () => setConnected(false)
    return () => source.close()
  }, [enabled, dispatch])

  const ctx: Ctx = {
    subscribe: s => { subscribers.current.add(s); return () => { subscribers.current.delete(s) } },
    editorOpened: () => { editors.current++ },
    editorClosed: () => {
      editors.current = Math.max(0, editors.current - 1)
      if (editors.current === 0 && pending.current.size > 0) {
        const runs = [...pending.current]
        pending.current.clear()
        setHeldBack([])
        runs.forEach(run => run())
      }
    },
    holdBack: (run, e) => {
      if (editors.current === 0) return false
      pending.current.add(run)
      if (e.type !== 'resync') {
        const text = describe(e, 1)
        setHeldBack(h => (h.includes(text) ? h : [...h, text].slice(-3)))
      }
      return true
    },
  }

  return (
    <LiveCtx.Provider value={enabled ? ctx : null}>
      {children}
      {enabled && (
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col items-end gap-2 pointer-events-none max-w-[calc(100vw-2rem)]">
          {!connected && (
            <div className="rounded-full bg-amber-100 text-amber-900 text-xs font-medium px-3 py-1.5 shadow">
              Live updates paused - reconnecting...
            </div>
          )}
          {heldBack.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm px-4 py-2.5 shadow max-w-sm">
              <div className="font-semibold">{heldBack.join(' · ')}</div>
              <div className="text-xs mt-0.5">This screen will refresh when you close the window you are editing in.</div>
            </div>
          )}
          {toasts.map(t => (
            <div key={t.key} className="rounded-lg bg-[#172554] text-white text-sm px-4 py-2.5 shadow-lg">
              {t.text}
            </div>
          ))}
        </div>
      )}
    </LiveCtx.Provider>
  )
}

// Refetch this screen's data when any of `types` changes elsewhere (or after
// the live connection recovers). Bursts are coalesced into one refetch.
// `immediate` skips the hold-back for refetches that cannot wipe input (e.g.
// re-checking whether a day was closed).
export function useLiveRefresh(types: LiveEvent['type'][], refetch: () => unknown, opts?: { immediate?: boolean }) {
  const ctx = useContext(LiveCtx)
  const refetchRef = useRef(refetch)
  refetchRef.current = refetch
  const typesKey = types.join(',')
  useEffect(() => {
    if (!ctx) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const run = () => { refetchRef.current() }
    const unsubscribe = ctx.subscribe({
      types: typesKey.split(','),
      fn: e => {
        if (!opts?.immediate && ctx.holdBack(run, e)) return
        if (timer) clearTimeout(timer)
        timer = setTimeout(run, 300)
      },
    })
    return () => { unsubscribe(); if (timer) clearTimeout(timer) }
    // ctx is stable for the provider's lifetime; typesKey captures `types`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!ctx, typesKey])
}

// Marks an editor holding unsaved input. While any is active, live refreshes
// wait instead of resetting the screen under the user.
export function useEditing(active: boolean) {
  const ctx = useContext(LiveCtx)
  useEffect(() => {
    if (!ctx || !active) return
    ctx.editorOpened()
    return () => ctx.editorClosed()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!ctx, active])
}
