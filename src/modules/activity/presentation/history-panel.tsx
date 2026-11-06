'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { ClockCounterClockwise, X } from '@phosphor-icons/react'
import { Switch } from '@/shared/ui/switch'
import { cn } from '@/shared/lib/utils'
import { useLiveRefresh } from '@/shared/realtime/live-updates'
import { Highlights, Timeline, type ActivityEvent } from './timeline'

export type HistoryScope = { orderId?: string; entityId?: string; productId?: string }

type Props = {
  title: string
  subtitle?: string
  scope: HistoryScope
  // Extra controls pinned under the timeline (e.g. the stock adjustment form).
  footer?: ReactNode
  // Icon-only, for very tight spots.
  compact?: boolean
  // A small bordered button sized for table rows (icon + "History").
  row?: boolean
  // Extra hover text, e.g. "Last edited by Ravi · 10:42".
  hint?: string
  className?: string
}

// History stays out of the way until asked for. The button owns its panel, so
// a panel opened from inside another window (View Order, a planning modal) is
// a nested dialog of that window: the window stays open underneath, focus
// moves into the panel, and Escape closes just the panel.
export function HistoryButton({ title, subtitle, scope, footer, compact, row, hint, className }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <DialogPrimitive.Root open={open} onOpenChange={o => setOpen(o)}>
      <DialogPrimitive.Trigger
        onClick={e => e.stopPropagation()}
        title={hint ? `${hint} - click for the full history` : `History of ${title}`}
        className={cn(
          'inline-flex items-center gap-1 rounded-md text-[#64748B] hover:text-[#4F46E5] hover:bg-[#EEF2FF] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/40',
          compact ? 'p-1' : row ? 'h-[26px] w-fit px-2.5 text-[11px] font-medium border border-[#E0E7FF] bg-white hover:border-[#C7D2FE]' : 'px-2 py-1 text-xs font-medium',
          className,
        )}
      >
        <ClockCounterClockwise weight="duotone" className={compact ? 'w-3.5 h-3.5' : row ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        {compact ? <span className="sr-only">History</span> : 'History'}
      </DialogPrimitive.Trigger>
      {open && <Panel title={title} subtitle={subtitle} scope={scope} footer={footer} />}
    </DialogPrimitive.Root>
  )
}

function Panel({ title, subtitle, scope, footer }: Omit<Props, 'compact' | 'className'>) {
  const [events, setEvents] = useState<ActivityEvent[] | null>(null)
  const [importantOnly, setImportantOnly] = useState(false)
  const [error, setError] = useState('')
  const scopeKey = JSON.stringify(scope)

  const load = useCallback(async () => {
    const params = new URLSearchParams({ ...JSON.parse(scopeKey), limit: '300' })
    const res = await fetch(`/api/activity?${params}`)
    const body = await res.json().catch(() => ({}))
    if (res.ok) { setEvents(body.events); setError('') } else setError(body.error || 'Could not load history')
  }, [scopeKey])

  useEffect(() => { load() }, [load])
  // Reading history can't wipe anything, so it refreshes immediately.
  useLiveRefresh(['order', 'production_plan', 'product'], load, { immediate: true })

  const shown = events ? (importantOnly ? events.filter(e => e.important) : events) : null
  const withOrder = !scope.orderId
  const importantCount = events?.filter(e => e.important).length ?? 0

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-[90] bg-[#172554]/10 supports-backdrop-filter:backdrop-blur-[1px] duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:animate-none" />
      <DialogPrimitive.Popup
        className={cn(
          'fixed inset-y-0 right-0 z-[91] flex w-full sm:w-[440px] flex-col bg-white border-l border-[#E0E7FF] shadow-[-24px_0_48px_-24px_rgba(23,37,84,0.25)] outline-none',
          'duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right motion-reduce:animate-none',
        )}
      >
        <header className="px-5 pt-5 pb-4 border-b border-[#E0E7FF]">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-heading text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#94A3B8]">History</div>
              <DialogPrimitive.Title className="font-heading text-lg font-bold text-[#172554] truncate">{title}</DialogPrimitive.Title>
              {subtitle && <DialogPrimitive.Description className="text-xs text-[#64748B] truncate">{subtitle}</DialogPrimitive.Description>}
            </div>
            <DialogPrimitive.Close className="rounded-md p-1.5 text-[#94A3B8] hover:text-[#172554] hover:bg-[#F4F6FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/40" aria-label="Close history">
              <X weight="bold" className="w-4 h-4" />
            </DialogPrimitive.Close>
          </div>
          <label className="mt-3 inline-flex items-center gap-2 text-xs text-[#64748B] cursor-pointer select-none">
            <Switch checked={importantOnly} onCheckedChange={checked => setImportantOnly(checked)} />
            Important only{importantCount > 0 && <span className="text-[#B45309] font-semibold">({importantCount})</span>}
          </label>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {error ? <p className="text-sm text-red-600">{error}</p>
            : !shown ? <p className="text-sm text-[#94A3B8]">Loading...</p>
            : shown.length === 0 ? (
              <p className="text-sm text-[#94A3B8] text-center pt-10">
                {importantOnly ? 'Nothing important here - turn off "Important only" to see every change.' : 'No changes yet - edits will appear here as they happen.'}
              </p>
            ) : (
              <>
                {!importantOnly && <Highlights events={shown} withOrder={withOrder} />}
                <Timeline events={shown} withOrder={withOrder} />
              </>
            )}
        </div>

        {footer && <footer className="border-t border-[#E0E7FF] bg-[#F8FAFF] px-5 py-4">{footer}</footer>}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}
