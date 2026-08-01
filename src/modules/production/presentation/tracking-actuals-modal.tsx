'use client'

import { useState, useEffect } from 'react'
import { X } from '@phosphor-icons/react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { generateTimeSlots, type TimeSlot } from '@/shared/lib/utils'
import type { TrackingPlanRow } from './tracking-stage-list'

interface TrackingActualsModalProps {
  plan: TrackingPlanRow | null
  shifts: any[]
  onClose: () => void
  onSaved: () => Promise<void>
}

export function TrackingActualsModal({ plan, shifts, onClose, onSaved }: TrackingActualsModalProps) {
  const [actuals, setActuals] = useState<Record<string, number>>({})
  const [meltActual, setMeltActual] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (plan) {
      setActuals((plan.hourlyActuals as Record<string, number>) || {})
      setMeltActual(plan.actualQuantity != null ? String(plan.actualQuantity) : '')
    }
  }, [plan])

  if (!plan) return null

  const shift = shifts.find((s: any) => s.id === plan.shiftId)
  const timeSlots: TimeSlot[] = shift ? generateTimeSlots(shift.startTime, shift.endTime, shift.breaks || []) : []

  const handleSave = async () => {
    setIsSaving(true)
    setError('')
    try {
      const body = plan.stage === 'Melt'
        ? { actualQuantity: meltActual === '' ? null : Number(meltActual) }
        : { hourlyActuals: actuals }
      const res = await fetch(`/api/production-plans/${plan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        setError('Failed to save actuals. Please try again.')
        return
      }
      await onSaved()
      onClose()
    } catch {
      setError('An error occurred while saving. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#F4F6FB] border border-sidebar-border rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-sidebar-border bg-white rounded-t-xl">
          <h2 className="text-xl font-bold text-[#172554]">Enter Actuals - {plan.stage}</h2>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <p className="text-[#64748B] text-sm">Planned: <span className="font-mono font-semibold text-[#172554]">{plan.quantityScheduled}</span></p>

          {plan.stage === 'Melt' ? (
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">Actual Quantity</Label>
              <Input type="number" min="0" value={meltActual} onChange={e => setMeltActual(e.target.value)} className="bg-white border-sidebar-border" />
            </div>
          ) : timeSlots.length === 0 ? (
            <p className="text-red-500 text-sm">This plan has no shift assigned, so hourly slots can't be shown.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {timeSlots.map(slot => (
                <div key={slot.time} className="space-y-1">
                  <Label className="text-[10px] text-[#64748B]">{slot.time}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={actuals[slot.time] ?? ''}
                    onChange={e => setActuals(prev => ({ ...prev, [slot.time]: Number(e.target.value) || 0 }))}
                    className="bg-white border-sidebar-border h-8 text-sm"
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-sidebar-border bg-white rounded-b-xl">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white">
              {isSaving ? 'Saving...' : 'Save Actuals'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
