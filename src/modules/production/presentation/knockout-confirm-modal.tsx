import { useState, useMemo } from 'react'
import { X, CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'

interface KnockoutConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  dailyPlans: any[]
  patterns: any[]
  onConfirmSuccess: () => void
}

export function KnockoutConfirmModal({ isOpen, onClose, dailyPlans, patterns, onConfirmSuccess }: KnockoutConfirmModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)

  const pendingPlans = useMemo(() => {
    return dailyPlans.filter(p => p.stage === 'Knockout' && p.actualQuantity > 0 && !p.isConfirmed)
  }, [dailyPlans])

  const handleSelectAll = () => {
    if (selectedIds.size === pendingPlans.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pendingPlans.map(p => p._id || p.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  const handleConfirm = async () => {
    if (selectedIds.size === 0) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/knockout-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planIds: Array.from(selectedIds) })
      })
      if (res.ok) {
        onConfirmSuccess()
        onClose()
      } else {
        alert('Failed to confirm knockouts')
      }
    } catch (err) {
      console.error(err)
      alert('Error confirming knockouts')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#FFFFFF] border border-[#E0E7FF] rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-6 border-b border-[#E0E7FF] bg-[#F4F6FB]">
          <div>
            <h2 className="text-2xl font-bold font-heading text-[#172554] tracking-tight">Confirm Knockout</h2>
            <p className="text-sm text-[#64748B] mt-1">Select completed knockouts to generate products into inventory.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[#E0E7FF] text-[#64748B] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto max-h-[60vh] bg-[#FFFFFF]">
          {pendingPlans.length === 0 ? (
            <div className="text-center py-10 flex flex-col items-center justify-center">
              <WarningCircle className="w-12 h-12 text-[#94A3B8] mb-4" />
              <p className="text-[#64748B] text-lg">No unconfirmed knockouts available.</p>
              <p className="text-sm text-[#94A3B8]">Add actuals in the daily plan to see them here.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase bg-[#F4F6FB] text-[#64748B] border-b border-[#E0E7FF]">
                <tr>
                  <th className="px-4 py-3">
                    <input type="checkbox" checked={selectedIds.size === pendingPlans.length && pendingPlans.length > 0} onChange={handleSelectAll} className="w-4 h-4 rounded border-[#C7D2FE] text-[#4F46E5] focus:ring-[#4F46E5]" />
                  </th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">Pattern</th>
                  <th className="px-4 py-3 text-right">Actual Moulds</th>
                  <th className="px-4 py-3 text-right">Products Gen.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E7FF]">
                {pendingPlans.map(plan => {
                  const pattern = patterns.find(p => p.code === plan.patternRef)
                  const cavities = pattern?.cavities || 1
                  const productsGenerated = plan.actualQuantity * cavities
                  const id = plan._id || plan.id

                  return (
                    <tr key={id} className={cn("hover:bg-[#F8FAFC] transition-colors cursor-pointer", selectedIds.has(id) && "bg-[#EEF2FF]")} onClick={() => toggleSelect(id)}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selectedIds.has(id)} onChange={() => toggleSelect(id)} className="w-4 h-4 rounded border-[#C7D2FE] text-[#4F46E5] focus:ring-[#4F46E5]" onClick={e => e.stopPropagation()} />
                      </td>
                      <td className="px-4 py-3 text-[#172554] font-mono">{plan.date}</td>
                      <td className="px-4 py-3 font-semibold text-[#172554]">{plan.productName || 'Unknown'}</td>
                      <td className="px-4 py-3 text-[#64748B] font-mono">{plan.patternRef}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#172554]">{plan.actualQuantity}</td>
                      <td className="px-4 py-3 text-right font-bold text-green-600">+{productsGenerated}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-6 border-t border-[#E0E7FF] bg-[#F4F6FB] flex justify-between items-center">
          <p className="text-sm text-[#64748B]">Selected: <strong className="text-[#172554]">{selectedIds.size}</strong></p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="border-[#E0E7FF] text-[#64748B] bg-transparent hover:text-[#172554]">
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={selectedIds.size === 0 || isSubmitting} className="bg-[#10B981] hover:bg-[#10B981]/90 text-white font-bold tracking-wider px-6">
              <CheckCircle className="w-5 h-5 mr-2" />
              CONFIRM TO INVENTORY
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
