'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { useEditing, useLiveRefresh } from '@/shared/realtime/live-updates'

// Admin-only: record a physical count. The server works out the difference
// against the stock at that moment, so a stale number on screen can't skew it.
export function StockAdjustForm({ productId }: { productId: string }) {
  const [stock, setStock] = useState<number | null>(null)
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/products/${productId}/stock-movements`)
    if (res.ok) setStock((await res.json()).product.stock ?? 0)
  }, [productId])
  useEffect(() => { load() }, [load])
  useLiveRefresh(['product'], load, { immediate: true })
  // A count being typed must not be reset by a live refresh elsewhere.
  useEditing(counted !== '' || note !== '')

  const diff = counted !== '' && Number.isInteger(Number(counted)) && stock !== null ? Number(counted) - stock : null

  const record = async () => {
    setSaving(true); setMessage(null)
    try {
      const res = await fetch(`/api/products/${productId}/stock-movements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countedStock: Number(counted), note }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setMessage({ ok: false, text: body.error || 'Could not record the count' }); return }
      setMessage({ ok: true, text: body.delta === 0 ? 'Count matches - nothing to change.' : `Recorded ${body.delta > 0 ? '+' : ''}${body.delta}. Stock is now ${body.stock}.` })
      setCounted(''); setNote('')
      await load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between">
        <span className="font-heading text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#94A3B8]">Record a physical count</span>
        <span className="text-xs text-[#64748B]">In stock: <span className="font-semibold tabular-nums text-[#172554]">{stock ?? '…'}</span></span>
      </div>
      <div className="flex gap-2">
        <Input type="number" min={0} inputMode="numeric" placeholder="Counted" value={counted} onChange={e => setCounted(e.target.value)} className="w-28 bg-white" aria-label="Counted quantity" />
        <Input placeholder="Reason, e.g. monthly count" value={note} onChange={e => setNote(e.target.value)} className="flex-1 bg-white" aria-label="Reason for the adjustment" />
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-[#64748B] min-h-4">
          {diff !== null && (diff === 0 ? 'Matches the system.' : <>Will record <span className="font-semibold tabular-nums text-[#172554]">{diff > 0 ? '+' : ''}{diff}</span></>)}
        </span>
        <Button onClick={record} disabled={saving || counted === '' || !note.trim()} size="sm" className="ml-auto bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white">
          {saving ? 'Recording...' : 'Record count'}
        </Button>
      </div>
      {message && <p className={message.ok ? 'text-xs text-emerald-700' : 'text-xs text-red-600'}>{message.text}</p>}
    </div>
  )
}
