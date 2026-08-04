'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { WarningCircle, CheckCircle } from '@phosphor-icons/react'
import { cn } from '@/shared/lib/utils'

export interface ConfirmDialogState {
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
  // Omit for an info/alert-style dialog (single OK button, no cancel).
  cancelLabel?: string
  tone?: 'warning' | 'info'
}

// Centered, app-styled replacement for native browser confirm()/alert() -
// those anchor wherever the browser puts them (often top-of-viewport,
// styled like a cookie banner) instead of centered like the rest of the
// app's dialogs. Same pattern as CapacityErrorDialog, generalized for
// confirm/cancel and info-only use.
export function ConfirmDialog({ state, onClose }: { state: ConfirmDialogState | null; onClose: () => void }) {
  const isInfo = !state?.cancelLabel
  const isWarning = (state?.tone ?? 'warning') === 'warning'

  return (
    <Dialog open={!!state} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-white border-[#E0E7FF]">
        {state && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0', isWarning ? 'bg-red-50' : 'bg-emerald-50')}>
                  {isWarning ? (
                    <WarningCircle weight="fill" className="w-6 h-6 text-red-500" />
                  ) : (
                    <CheckCircle weight="fill" className="w-6 h-6 text-emerald-500" />
                  )}
                </div>
                <DialogTitle className="text-lg font-heading text-[#172554]">{state.title}</DialogTitle>
              </div>
            </DialogHeader>
            <p className="text-sm text-[#64748B] py-2 whitespace-pre-line max-h-[50vh] overflow-y-auto">{state.description}</p>
            <DialogFooter>
              {!isInfo && (
                <Button variant="outline" onClick={onClose}>{state.cancelLabel}</Button>
              )}
              <Button
                onClick={() => { state.onConfirm(); onClose() }}
                className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white min-w-[80px]"
              >
                {state.confirmLabel || 'OK'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
