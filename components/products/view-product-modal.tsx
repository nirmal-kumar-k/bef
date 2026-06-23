'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Product {
  id: number
  code: string
  name: string
  customer: string
  weight: string
  cavities: number
}

export function ViewProductModal({
  product,
  isOpen,
  onClose,
}: {
  product: Product | null
  isOpen: boolean
  onClose: () => void
}) {
  if (!product) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full sm:max-w-2xl bg-[#050810] border-[#243050] text-foreground">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold font-heading text-[#EEF3FF]">
            Product Details
          </DialogTitle>
          <p className="text-sm text-[#5A6E90] mt-1">Overview of the selected product</p>
        </DialogHeader>

        <div className="py-6 space-y-8">
          {/* Header Info */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-3xl font-bold text-[#EEF3FF] tracking-tight">{product.name}</h2>
              <p className="text-lg text-[#EB6824] font-mono mt-1">{product.code}</p>
            </div>
            <div className="bg-[#0C1221] border border-[#243050] rounded-lg px-4 py-2 text-center">
              <span className="block text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider mb-1">Weight</span>
              <span className="text-xl font-medium text-[#EEF3FF]">{product.weight}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#0C1221]/50 border border-[#243050] rounded-lg p-4">
              <h3 className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider mb-2">Customer</h3>
              <p className="text-[#EEF3FF]">{product.customer}</p>
            </div>
            <div className="bg-[#0C1221]/50 border border-[#243050] rounded-lg p-4">
              <h3 className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider mb-2">Default Cavities</h3>
              <p className="text-[#EEF3FF]">{product.cavities}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#0C1221]/50 border border-[#243050] rounded-lg p-4 flex flex-col items-center justify-center min-h-[120px] text-[#5A6E90]">
              <span className="text-sm mb-2">No product image uploaded</span>
            </div>
            <div className="bg-[#0C1221]/50 border border-[#243050] rounded-lg p-4 flex flex-col items-center justify-center min-h-[120px] text-[#5A6E90]">
              <span className="text-sm mb-2">No attachments found</span>
            </div>
          </div>

        </div>

        <div className="flex justify-end border-t border-[#243050] pt-4">
          <Button variant="ghost" onClick={onClose} className="text-[#8B9FC4] hover:text-[#EEF3FF] hover:bg-[#1C2840]">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
