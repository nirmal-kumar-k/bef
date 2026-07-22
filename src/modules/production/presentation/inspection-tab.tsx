import { useState } from 'react'
import { BacklogItem } from './daily-planning-modal'
import { CheckCircle, MagnifyingGlass } from '@phosphor-icons/react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { cn } from '@/shared/lib/utils'

interface InspectionTabProps {
  inspectionBacklog: BacklogItem[]
  openOrders: any[]
  // Refetches orders/products/patterns/plans from the server - needed after
  // submitting an inspection, since that mutates both the Inspection plan
  // row AND product.stock server-side.
  onRefetch: () => void | Promise<void>
}

// Every product with fettled stock waiting on QC: inspect the whole
// available amount in one batch, entering only how many were rejected (and
// why) - the rest is accepted automatically and becomes Finished Stock.
export function InspectionTab({ inspectionBacklog, openOrders, onRefetch }: InspectionTabProps) {
  const [rejectedByKey, setRejectedByKey] = useState<Record<string, string>>({})
  const [reasonByKey, setReasonByKey] = useState<Record<string, string>>({})
  const [processingKey, setProcessingKey] = useState<string | null>(null)
  const [errorByKey, setErrorByKey] = useState<Record<string, string>>({})

  const readyItems = inspectionBacklog.filter(b => b.totalRequired - b.totalScheduled > 0)

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
    </div>
  )
}
