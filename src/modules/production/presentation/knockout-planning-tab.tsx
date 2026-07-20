import { useState } from 'react'
import { BacklogItem } from './daily-planning-modal'
import { CheckCircle, CubeTransparent } from '@phosphor-icons/react'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'

interface KnockoutPlanningTabProps {
  knockoutBacklog: BacklogItem[]
  openOrders: any[]
  // Refetches orders/products/patterns/plans from the server - needed after
  // marking an item done, since that mutates both the Knockout plan row AND
  // product.stock server-side.
  onRefetch: () => void | Promise<void>
}

// Poured products ready for knockout: one row per product, aggregated across
// every Melt heat that's poured it (not per-heat) - any poured amount counts,
// not just fully-poured orders. Clicking Done knocks out everything still
// remaining for that row in one shot and adds the resulting product quantity
// (moulds x cavities) straight into Fettling stock.
export function KnockoutPlanningTab({ knockoutBacklog, openOrders, onRefetch }: KnockoutPlanningTabProps) {
  const [processingKey, setProcessingKey] = useState<string | null>(null)

  const readyItems = knockoutBacklog.filter(b => b.totalRequired - b.totalScheduled > 0)

  const handleDone = async (b: BacklogItem) => {
    const order = openOrders.find(o => o.customerOrderNo === b.orderNo)
    if (!order) return
    const orderId = order.id || order._id
    const remaining = b.totalRequired - b.totalScheduled
    const key = `${b.itemId}`

    setProcessingKey(key)
    try {
      const res = await fetch('/api/knockout-done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: b.itemId, orderId, patternRef: b.patternRef, moulds: remaining }),
      })
      if (res.ok) {
        await onRefetch()
      } else {
        console.error('Failed to mark knockout done')
      }
    } catch (err) {
      console.error('Error marking knockout done:', err)
    } finally {
      setProcessingKey(null)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-[#172554] font-heading">Ready for Knockout</h2>
        <p className="text-sm text-[#64748B] mt-1">Products poured in Melt, waiting to be knocked out.</p>
      </div>

      {readyItems.length === 0 ? (
        <div className="text-center text-[#94A3B8] py-16 bg-[#F4F6FB] border border-[#E0E7FF] rounded-xl">
          Nothing poured and waiting on knockout right now.
        </div>
      ) : (
        <div className="space-y-3">
          {readyItems.map(b => {
            const poured = b.totalRequired
            const done = b.totalScheduled
            const remaining = poured - done
            const key = b.itemId
            const isProcessing = processingKey === key

            return (
              <div
                key={key}
                className="flex items-center justify-between gap-4 bg-[#FFFFFF] border border-[#E0E7FF] rounded-xl p-4 shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-[#EEF2FF] flex items-center justify-center shrink-0">
                    <CubeTransparent weight="duotone" className="w-5 h-5 text-[#4F46E5]" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[#172554] truncate">{b.productName}</p>
                    <p className="text-xs text-[#64748B] font-mono mt-0.5">{b.orderNo} &bull; {b.patternRef}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-right">
                    <p className="font-mono text-sm text-[#172554]">
                      <span className="font-bold">{poured}</span> poured, <span className="font-bold text-[#10B981]">{done}</span> done
                    </p>
                    <p className={cn("text-xs font-semibold mt-0.5", remaining > 0 ? "text-amber-600" : "text-[#94A3B8]")}>
                      {remaining} remaining
                    </p>
                  </div>
                  <Button
                    onClick={() => handleDone(b)}
                    disabled={isProcessing}
                    className="bg-[#10B981] hover:bg-[#10B981]/90 text-white font-bold tracking-wide disabled:opacity-50"
                  >
                    <CheckCircle weight="bold" className="w-4 h-4 mr-2" />
                    {isProcessing ? 'Marking Done...' : 'Done'}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
