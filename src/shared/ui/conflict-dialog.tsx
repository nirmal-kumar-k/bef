'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { UsersThree } from '@phosphor-icons/react'

// Mirrors the server's Conflict (src/infrastructure/audit) - what happened to
// a record between the moment this user loaded it and the moment they saved.
export interface SaveConflict {
  entityId: string
  currentVersion: number
  changedBy: string | null
  changedAt: string | null
  changes: { field: string; from: unknown; to: unknown }[]
}

export interface ConflictItem {
  label: string
  conflict: SaveConflict
  // The values this user tried to save, to show alongside theirs.
  mine?: Record<string, unknown>
}

const FIELD_LABELS: Record<string, string> = {
  quantityScheduled: 'Quantity',
  hourlyTargets: 'Hourly targets',
  hourlyWorkers: 'Hourly workers',
  hourlyEquipments: 'Machines by hour',
  hourlyActuals: 'Hourly actuals',
  equipmentId: 'Machine',
  shiftId: 'Shift',
  mouldsScheduled: 'Moulds',
  heatNumber: 'Heat number',
  heatNo: 'Heat',
  startTime: 'Start time',
  endTime: 'End time',
  actualQuantity: 'Actual',
  varianceReason: 'Shortfall reason',
  isConfirmed: 'Confirmed',
  possibleQuantity: 'Possible quantity',
  rejectedQuantity: 'Rejected',
  rejectionReason: 'Rejection reason',
  laborersAssigned: 'Workers',
  workersAssigned: 'Workers',
  coreBoxCode: 'Core box',
  customerOrderNo: 'Order no.',
  deliveryDate: 'Delivery date',
  cart: 'Products',
}

export function fieldLabel(field: string) {
  return FIELD_LABELS[field] || field.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())
}

export function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (Array.isArray(v)) return `${v.length} item(s)`
  if (typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== 0 && x !== '' && x != null)
    if (entries.length === 0) return '—'
    const shown = entries.slice(0, 4).map(([k, x]) => `${k}: ${x}`).join(', ')
    return entries.length > 4 ? `${shown}, +${entries.length - 4} more` : shown
  }
  const s = String(v)
  return s.length > 40 ? `${s.slice(0, 40)}…` : s
}

export function formatWhen(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// Shown when a save was refused because someone else saved the same record
// first. Nothing has been lost at this point: their change is stored, this
// user's attempt is not, and they choose which wins.
export function ConflictDialog({ items, onReload, onOverwrite, busy }: {
  items: ConflictItem[] | null
  onReload: () => void
  onOverwrite: () => void
  busy?: boolean
}) {
  return (
    <Dialog open={!!items && items.length > 0} onOpenChange={(open) => !open && !busy && onReload()}>
      <DialogContent className="max-w-lg bg-white border-[#E0E7FF]">
        {items && items.length > 0 && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-amber-50">
                  <UsersThree weight="fill" className="w-6 h-6 text-amber-500" />
                </div>
                <DialogTitle className="text-lg font-heading text-[#172554]">Someone else changed this while you were editing</DialogTitle>
              </div>
            </DialogHeader>
            <p className="text-sm text-[#64748B]">
              {items.length === 1 ? 'This row was' : `${items.length} rows were`} saved by someone else after you opened it. Your other rows were saved normally.
            </p>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto py-1">
              {items.map(({ label, conflict, mine }) => (
                <div key={conflict.entityId} className="rounded-lg border border-[#E0E7FF] bg-[#F8FAFF] p-3">
                  <div className="text-sm font-semibold text-[#172554]">{label}</div>
                  <div className="text-xs text-[#64748B] mt-0.5">
                    Changed by <span className="font-semibold text-[#172554]">{conflict.changedBy || 'another user'}</span>
                    {conflict.changedAt && <> at {formatWhen(conflict.changedAt)}</>}
                  </div>
                  {conflict.changes.length > 0 ? (
                    <table className="w-full mt-2 text-xs">
                      <thead>
                        <tr className="text-[#94A3B8] text-left">
                          <th className="font-medium pb-1">Field</th>
                          <th className="font-medium pb-1">Was</th>
                          <th className="font-medium pb-1">Now (theirs)</th>
                          {mine && <th className="font-medium pb-1">Yours</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {conflict.changes.map(c => (
                          <tr key={c.field} className="align-top">
                            <td className="pr-2 py-0.5 text-[#172554]">{fieldLabel(c.field)}</td>
                            <td className="pr-2 py-0.5 text-[#64748B] line-through">{formatValue(c.from)}</td>
                            <td className="pr-2 py-0.5 font-semibold text-[#172554]">{formatValue(c.to)}</td>
                            {mine && <td className="py-0.5 text-[#4F46E5]">{formatValue(mine[c.field])}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-xs text-[#64748B] mt-2">Details of their change aren&apos;t available.</p>
                  )}
                </div>
              ))}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onOverwrite} disabled={busy}>
                Keep mine and overwrite
              </Button>
              <Button onClick={onReload} disabled={busy} className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white">
                Reload with their changes
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
