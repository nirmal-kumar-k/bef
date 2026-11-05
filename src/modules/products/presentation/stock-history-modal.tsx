'use client'

import { useCallback, useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { cn } from '@/shared/lib/utils'
import { useRole } from '@/shared/context/role-context'
import { formatWhen } from '@/shared/ui/conflict-dialog'
import { useEditing, useLiveRefresh } from '@/shared/realtime/live-updates'

type Movement = {
  id: string
  at: string
  delta: number
  balanceAfter: number
  reason: string
  planId: string | null
  orderId: string | null
  note: string | null
  userName: string | null
}

const REASON: Record<string, string> = {
  opening: 'Opening balance',
  inspection: 'Inspection accepted',
  inspection_correction: 'Inspection corrected',
  inspection_undo: 'Inspection undone',
  knockout: 'Knockout confirmed',
  adjustment: 'Manual adjustment',
}

// The stock ledger for one product: every change, newest first, each with the
// balance after it - so "why is stock 412?" is answered line by line.
export function StockHistoryModal({ productId, orders, onClose }: {
  productId: string | null
  orders: any[]
  onClose: () => void
}) {
  const { role } = useRole()
  const [data, setData] = useState<{ product: { name: string; stock: number | null }; movements: Movement[] } | null>(null)
  const [error, setError] = useState('')
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!productId) return
    const res = await fetch(`/api/products/${productId}/stock-movements`)
    if (res.ok) setData(await res.json())
    else setError('Could not load stock history')
  }, [productId])

  useEffect(() => {
    setData(null); setError(''); setCounted(''); setNote('')
    load()
  }, [load])
  useLiveRefresh(['product'], load, { immediate: true })
  // An adjustment being typed must not be reset by a live refresh elsewhere.
  useEditing(!!productId && (counted !== '' || note !== ''))

  const orderNo = (id: string | null) => (id && orders.find(o => (o.id || o._id) === id)?.customerOrderNo) || null

  const adjust = async () => {
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/products/${productId}/stock-movements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countedStock: Number(counted), note }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setError(body.error || 'Adjustment failed'); return }
      setCounted(''); setNote('')
      await load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!productId} onOpenChange={open => !open && onClose()}>
      <DialogContent className="bg-white border-[#E0E7FF] w-[95vw] max-w-3xl sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading font-bold text-[#172554]">
            Stock history{data ? ` - ${data.product.name}` : ''}
          </DialogTitle>
        </DialogHeader>
        {data && (
          <p className="text-sm text-[#64748B]">
            Current stock: <span className="font-mono font-semibold text-emerald-600">{data.product.stock ?? 0}</span>
            {' '}- every change below, newest first, with the balance after it.
          </p>
        )}

        <div className="border border-[#E0E7FF] rounded-xl overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-[#F4F6FB] text-[#64748B] text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">What</th>
                <th className="px-4 py-3 text-right">Change</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0E7FF]">
              {!data ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-[#94A3B8]">{error || 'Loading...'}</td></tr>
              ) : data.movements.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-[#94A3B8] italic">No stock movements yet.</td></tr>
              ) : data.movements.map(m => (
                <tr key={m.id}>
                  <td className="px-4 py-2.5 text-[#64748B]">{formatWhen(m.at)}</td>
                  <td className="px-4 py-2.5">
                    <div className="text-[#172554] font-medium">{REASON[m.reason] || m.reason}</div>
                    {(orderNo(m.orderId) || m.note) && (
                      <div className="text-xs text-[#94A3B8] whitespace-normal max-w-xs">
                        {orderNo(m.orderId) ? `Order ${orderNo(m.orderId)}` : ''}{orderNo(m.orderId) && m.note ? ' · ' : ''}{m.note}
                      </div>
                    )}
                  </td>
                  <td className={cn('px-4 py-2.5 text-right font-mono font-semibold', m.delta > 0 ? 'text-emerald-600' : 'text-red-500')}>
                    {m.delta > 0 ? `+${m.delta}` : m.delta}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-[#172554]">{m.balanceAfter}</td>
                  <td className="px-4 py-2.5 text-[#64748B]">{m.userName || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {role === 'Admin' && data && (
          <div className="rounded-xl border border-[#E0E7FF] bg-[#F8FAFF] p-4 space-y-3">
            <div className="text-sm font-semibold text-[#172554]">Adjust stock after a physical count</div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input type="number" min={0} placeholder="Counted quantity" value={counted} onChange={e => setCounted(e.target.value)} className="sm:w-44" />
              <Input placeholder="Reason (required), e.g. monthly count" value={note} onChange={e => setNote(e.target.value)} className="flex-1" />
              <Button onClick={adjust} disabled={saving || counted === '' || !note.trim()} className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white">
                {saving ? 'Saving...' : 'Record'}
              </Button>
            </div>
            {counted !== '' && Number.isInteger(Number(counted)) && (
              <p className="text-xs text-[#64748B]">
                This records a change of {Number(counted) - (data.product.stock ?? 0) >= 0 ? '+' : ''}{Number(counted) - (data.product.stock ?? 0)} against the current {data.product.stock ?? 0}.
              </p>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
