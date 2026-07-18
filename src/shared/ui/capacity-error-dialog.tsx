'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { WarningCircle } from '@phosphor-icons/react'

// Centered, app-styled replacement for the native browser alert() used to
// block invalid saves in Core/Mould/Melt planning (over machine capacity,
// or over the product's total required quantity) - a native alert anchors
// wherever the browser puts it (and shows the raw domain/IP), not centered
// on screen like the rest of the app's dialogs.
export function CapacityErrorDialog({ lines, onClose }: { lines: string[] | null; onClose: () => void }) {
  return (
    <Dialog open={!!lines} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-white border-[#E0E7FF]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
              <WarningCircle weight="fill" className="w-6 h-6 text-red-500" />
            </div>
            <DialogTitle className="text-lg font-heading text-[#172554]">Cannot Save</DialogTitle>
          </div>
        </DialogHeader>
        <div className="py-2 space-y-3">
          <p className="text-sm text-[#64748B]">The following can&apos;t be saved as scheduled:</p>
          <div className="space-y-1.5">
            {lines?.map((line, i) => (
              <div key={i} className="text-sm font-mono font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {line}
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose} className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white min-w-[80px]">OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
