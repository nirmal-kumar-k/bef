import { useState } from 'react'
import { BacklogItem } from './daily-planning-modal'
import { CheckCircle, MagnifyingGlass, PencilSimple, Trash, X } from '@phosphor-icons/react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { cn } from '@/shared/lib/utils'

interface InspectionTabProps {
  inspectionBacklog: BacklogItem[]
  // Every Inspection-stage plan row (not just what's currently pending) -
  // used for the "Recent Inspections" history/correction list below.
  inspectionPlans: any[]
  openOrders: any[]
  // Refetches orders/products/patterns/plans from the server - needed after
  // submitting/editing/deleting an inspection, since all three mutate both
  // the Inspection plan row AND product.stock server-side.
  onRefetch: () => void | Promise<void>
}

// Every product with fettled stock waiting on QC: inspect the whole
// available amount in one batch, entering only how many were rejected (and
// why) - the rest is accepted automatically and becomes Finished Stock.
export function InspectionTab({ inspectionBacklog, inspectionPlans, openOrders, onRefetch }: InspectionTabProps) {
  const [rejectedByKey, setRejectedByKey] = useState<Record<string, string>>({})
  const [reasonByKey, setReasonByKey] = useState<Record<string, string>>({})
  const [processingKey, setProcessingKey] = useState<string | null>(null)
  const [errorByKey, setErrorByKey] = useState<Record<string, string>>({})

  // Editing an existing batch: the batch's total (accepted + rejected) is
  // fixed - editing only re-splits that fixed total between the two and
  // corrects the reason, it doesn't change how many pieces were inspected.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRejected, setEditRejected] = useState('')
  const [editReason, setEditReason] = useState('')
  const [editError, setEditError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const readyItems = inspectionBacklog.filter(b => b.totalRequired - b.totalScheduled > 0)

  const resolveOrderAndProduct = (planOrderId: string, itemId: string) => {
    const order = openOrders.find(o => (o.id || o._id) === planOrderId)
    const parts = String(itemId).split('-')
    const idx = parseInt(parts[parts.length - 1], 10)
    const cartItem = order?.cart?.[idx]
    return { orderNo: order?.customerOrderNo || '-', productName: cartItem?.productName || 'Unknown' }
  }

  const recentInspections = [...inspectionPlans]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(p => ({ ...p, ...resolveOrderAndProduct(p.orderId, p.itemId) }))

  const startEdit = (p: any) => {
    setEditingId(p.id || p._id)
    setEditRejected(String(p.rejectedQuantity || 0))
    setEditReason(p.rejectionReason || '')
    setEditError('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditRejected('')
    setEditReason('')
    setEditError('')
  }

  const saveEdit = async (p: any) => {
    const id = p.id || p._id
    const batchTotal = (p.quantityScheduled || 0) + (p.rejectedQuantity || 0)
    const newRejected = Math.max(0, parseInt(editRejected || '0', 10) || 0)
    if (newRejected > batchTotal) {
      setEditError(`This batch only covers ${batchTotal} pieces total.`)
      return
    }
    if (newRejected > 0 && !editReason.trim()) {
      setEditError('A reason is required when rejecting pieces.')
      return
    }
    const newAccepted = batchTotal - newRejected

    setBusyId(id)
    try {
      const res = await fetch(`/api/production-plans/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantityScheduled: newAccepted,
          rejectedQuantity: newRejected,
          rejectionReason: newRejected > 0 ? editReason.trim() : null,
        }),
      })
      if (res.ok) {
        cancelEdit()
        await onRefetch()
      } else {
        setEditError('Failed to save correction')
      }
    } catch (err) {
      console.error('Error editing inspection:', err)
      setEditError('Error saving correction')
    } finally {
      setBusyId(null)
    }
  }

  const deleteInspection = async (p: any) => {
    const id = p.id || p._id
    if (!confirm('Undo this inspection batch entirely? Its pieces become available to inspect again, and the stock it added will be reversed.')) return
    setBusyId(id)
    try {
      const res = await fetch(`/api/production-plans/${id}`, { method: 'DELETE' })
      if (res.ok) await onRefetch()
    } catch (err) {
      console.error('Error deleting inspection:', err)
    } finally {
      setBusyId(null)
    }
  }

  const handleSubmit = async (b: BacklogItem) => {
    const key = b.itemId
    const available = b.totalRequired - b.totalScheduled
    const rejected = Math.max(0, parseInt(rejectedByKey[key] || '0', 10) || 0)
    const reason = (reasonByKey[key] || '').trim()

    if (rejected > available) {
      setErrorByKey(prev => ({ ...prev, [key]: `Only ${available} available - can't reject more than that.` }))
      return
    }
    if (rejected > 0 && !reason) {
      setErrorByKey(prev => ({ ...prev, [key]: 'A reason is required when rejecting pieces.' }))
      return
    }

    const order = openOrders.find(o => o.customerOrderNo === b.orderNo)
    if (!order) return
    const orderId = order.id || order._id

    setProcessingKey(key)
    setErrorByKey(prev => ({ ...prev, [key]: '' }))
    try {
      const res = await fetch('/api/inspection-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: b.itemId, orderId, patternRef: b.patternRef, totalAvailable: available, rejectedQty: rejected, reason }),
      })
      if (res.ok) {
        setRejectedByKey(prev => ({ ...prev, [key]: '' }))
        setReasonByKey(prev => ({ ...prev, [key]: '' }))
        await onRefetch()
      } else {
        const data = await res.json().catch(() => ({}))
        setErrorByKey(prev => ({ ...prev, [key]: data.error || 'Failed to submit inspection' }))
      }
    } catch (err) {
      console.error('Error submitting inspection:', err)
      setErrorByKey(prev => ({ ...prev, [key]: 'Error submitting inspection' }))
    } finally {
      setProcessingKey(null)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-[#172554] font-heading">Inspection</h2>
        <p className="text-sm text-[#64748B] mt-1">Fettled products waiting on QC - accepted pieces move straight into Finished Stock.</p>
      </div>

      {readyItems.length === 0 ? (
        <div className="text-center text-[#94A3B8] py-16 bg-[#F4F6FB] border border-[#E0E7FF] rounded-xl">
          Nothing fettled and waiting on inspection right now.
        </div>
      ) : (
        <div className="space-y-3">
          {readyItems.map(b => {
            const key = b.itemId
            const available = b.totalRequired - b.totalScheduled
            const rejectedInput = rejectedByKey[key] || ''
            const rejected = Math.max(0, parseInt(rejectedInput || '0', 10) || 0)
            const accepted = Math.max(0, available - rejected)
            const isProcessing = processingKey === key
            const error = errorByKey[key]

            return (
              <div
                key={key}
                className="bg-[#FFFFFF] border border-[#E0E7FF] rounded-xl p-4 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-[#EEF2FF] flex items-center justify-center shrink-0">
                      <MagnifyingGlass weight="duotone" className="w-5 h-5 text-[#4F46E5]" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[#172554] truncate">{b.productName}</p>
                      <p className="text-xs text-[#64748B] font-mono mt-0.5">{b.orderNo} &bull; {b.patternRef}</p>
                    </div>
                  </div>
                  <p className="font-mono text-sm text-[#172554] shrink-0">
                    <span className="font-bold">{available}</span> available
                  </p>
                </div>

                <div className="flex items-end gap-3 flex-wrap">
                  <div className="w-32">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-red-600 block mb-1">Rejected Qty</label>
                    <Input
                      type="number"
                      min="0"
                      max={available}
                      value={rejectedInput}
                      onChange={e => setRejectedByKey(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder="0"
                      className="h-9 font-mono border-red-200 focus-visible:ring-red-400"
                    />
                  </div>
                  <div className="flex-1 min-w-[220px]">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] block mb-1">Reason {rejected > 0 && <span className="text-red-500">*</span>}</label>
                    <Input
                      value={reasonByKey[key] || ''}
                      onChange={e => setReasonByKey(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder={rejected > 0 ? 'Required - e.g. casting defect' : 'Only needed if rejecting'}
                      className="h-9"
                    />
                  </div>
                  <div className="w-28">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#10B981] block mb-1">Accepted</label>
                    <div className="h-9 flex items-center justify-center rounded-md border border-[#D1FAE5] bg-[#ECFDF5] font-mono font-bold text-[#10B981]">
                      {accepted}
                    </div>
                  </div>
                  <Button
                    onClick={() => handleSubmit(b)}
                    disabled={isProcessing}
                    className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white font-bold tracking-wide disabled:opacity-50 h-9"
                  >
                    <CheckCircle weight="bold" className="w-4 h-4 mr-2" />
                    {isProcessing ? 'Submitting...' : 'Submit'}
                  </Button>
                </div>

                {error && (
                  <p className={cn("text-xs font-medium", "text-red-600")}>{error}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="pt-4">
        <h3 className="text-sm font-bold text-[#172554] font-heading">Recent Inspections</h3>
        <p className="text-xs text-[#64748B] mt-0.5">Edit to correct a mistyped rejection, or delete to undo a batch entirely - its pieces become available to inspect again.</p>

        {recentInspections.length === 0 ? (
          <div className="text-center text-[#94A3B8] text-sm py-8 bg-[#F4F6FB] border border-[#E0E7FF] rounded-xl mt-3">
            No inspections logged yet.
          </div>
        ) : (
          <div className="border border-[#E0E7FF] rounded-xl overflow-hidden mt-3">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#F4F6FB] border-b border-[#E0E7FF] text-[#64748B] text-[11px] uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3 text-center">Accepted</th>
                  <th className="px-4 py-3 text-center">Rejected</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E7FF] bg-white">
                {recentInspections.map(p => {
                  const id = p.id || p._id
                  const isEditing = editingId === id
                  const isBusy = busyId === id

                  if (isEditing) {
                    const batchTotal = (p.quantityScheduled || 0) + (p.rejectedQuantity || 0)
                    const newRejected = Math.max(0, parseInt(editRejected || '0', 10) || 0)
                    const newAccepted = Math.max(0, batchTotal - newRejected)
                    return (
                      <tr key={id} className="bg-[#EEF2FF]/40">
                        <td className="px-4 py-3 font-mono text-[#172554]">{p.date}</td>
                        <td className="px-4 py-3 font-mono text-[#4285F4]">{p.orderNo}</td>
                        <td className="px-4 py-3 font-semibold text-[#172554]">{p.productName}</td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-[#10B981]">{newAccepted}</td>
                        <td className="px-4 py-3 text-center">
                          <Input
                            type="number"
                            min="0"
                            max={batchTotal}
                            value={editRejected}
                            onChange={e => setEditRejected(e.target.value)}
                            className="h-8 w-20 mx-auto font-mono text-center border-red-200 focus-visible:ring-red-400"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            value={editReason}
                            onChange={e => setEditReason(e.target.value)}
                            placeholder={newRejected > 0 ? 'Required' : 'Only needed if rejecting'}
                            className="h-8"
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button size="icon" variant="ghost" onClick={() => saveEdit(p)} disabled={isBusy} className="h-7 w-7 text-[#10B981] hover:bg-[#ECFDF5]">
                              <CheckCircle weight="bold" className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={cancelEdit} disabled={isBusy} className="h-7 w-7 text-[#64748B] hover:bg-[#F4F6FB]">
                              <X weight="bold" className="w-4 h-4" />
                            </Button>
                          </div>
                          {editError && <p className="text-[10px] text-red-600 mt-1 text-right">{editError}</p>}
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={id} className="hover:bg-[#F8FAFC] transition-colors group">
                      <td className="px-4 py-3 font-mono text-[#172554]">{p.date}</td>
                      <td className="px-4 py-3 font-mono text-[#4285F4]">{p.orderNo}</td>
                      <td className="px-4 py-3 font-semibold text-[#172554]">{p.productName}</td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-[#10B981]">{p.quantityScheduled}</td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-red-500">{p.rejectedQuantity || 0}</td>
                      <td className="px-4 py-3 text-[#64748B] text-xs">{p.rejectionReason || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" onClick={() => startEdit(p)} disabled={isBusy} className="h-7 w-7 text-[#64748B] hover:text-[#4F46E5] hover:bg-[#EEF2FF]">
                            <PencilSimple weight="bold" className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteInspection(p)} disabled={isBusy} className="h-7 w-7 text-[#64748B] hover:text-red-600 hover:bg-red-50">
                            <Trash weight="bold" className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
