import { Dialog, DialogContent } from '@/shared/ui/dialog'
import { WarningCircle } from '@phosphor-icons/react'

interface ConfirmDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  title?: string
  description?: string
  itemName?: string
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  itemName
}: ConfirmDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] bg-[#FFFFFF] border-[#E0E7FF] text-foreground p-0 overflow-hidden shadow-2xl rounded-2xl [&>button]:hidden">
        <div className="p-6 pb-0 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
            <WarningCircle weight="duotone" className="w-6 h-6 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-[#172554] mb-2">{title}</h2>
          <p className="text-[#64748B] text-sm mb-6">
            {description}
            {itemName && (
              <>
                <br />
                <span className="text-[#172554] font-medium mt-1 inline-block">"{itemName}"</span>
              </>
            )}
          </p>
        </div>
        
        <div className="flex border-t border-[#E0E7FF] bg-[#F4F6FB]/50 mt-2">
          <button 
            onClick={() => onOpenChange(false)}
            className="flex-1 py-4 text-sm font-medium text-[#64748B] hover:text-[#172554] hover:bg-[#EEF2FF]/50 transition-colors"
          >
            Cancel
          </button>
          <div className="w-[1px] bg-[#E0E7FF]"></div>
          <button 
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
            className="flex-1 py-4 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-400/10 transition-colors"
          >
            Yes, delete it
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
