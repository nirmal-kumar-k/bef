'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, PencilSimple, Trash } from '@phosphor-icons/react'
import { Button } from '@/shared/ui/button'
import { ShiftModal } from './shift-modal'
import { Switch } from '@/shared/ui/switch'
import { ConfirmDeleteDialog } from '@/shared/ui/confirm-delete-dialog'

export interface Shift {
  id?: string
  name: string
  startTime: string
  endTime: string
  breaks: { startTime: string, endTime: string }[]
  isActive: boolean
}

export default function ShiftMasterPage() {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [shiftToDelete, setShiftToDelete] = useState<Shift | null>(null)

  const handleDeleteShift = async (id: string) => {
    try {
      const res = await fetch(`/api/shifts/${id}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchShifts()
      }
    } catch (err) {
      console.error('Failed to delete shift:', err)
    }
  }

  const fetchShifts = useCallback(async () => {
    try {
      const res = await fetch('/api/shifts')
      if (res.ok) {
        const data = await res.json()
        
        if (data.length === 0) {
          // Auto-seed default shifts requested by user
          await fetch('/api/shifts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Shift 1', startTime: '08:00 AM', endTime: '08:30 PM', breaks: [{ startTime: '01:00 PM', endTime: '01:30 PM' }] })
          })
          await fetch('/api/shifts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Shift 2', startTime: '08:00 PM', endTime: '07:30 AM', breaks: [] })
          })
          const res2 = await fetch('/api/shifts')
          if (res2.ok) {
            const data2 = await res2.json()
            setShifts(data2)
          }
        } else {
          setShifts(data)
        }
      }
    } catch (err) {
      console.error('Failed to fetch shifts:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchShifts()
  }, [fetchShifts])

  const handleSaveShift = async (shift: Partial<Shift>) => {
    try {
      if (shift.id) {
        const res = await fetch(`/api/shifts/${shift.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(shift),
        })
        if (res.ok) await fetchShifts()
      } else {
        const res = await fetch('/api/shifts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(shift),
        })
        if (res.ok) await fetchShifts()
      }
    } catch (err) {
      console.error('Failed to save shift:', err)
    }
  }

  const openAddModal = () => {
    setEditingShift(null)
    setIsModalOpen(true)
  }

  const openEditModal = (shift: Shift) => {
    setEditingShift(shift)
    setIsModalOpen(true)
  }

  const toggleActive = async (shift: Shift) => {
    await handleSaveShift({ ...shift, isActive: !shift.isActive })
  }

  return (
    <div className="p-8 max-w-[1200px] mx-auto w-full flex flex-col gap-8 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-heading text-[#172554]">Shift Master</h1>
          <p className="text-[#64748B] mt-1">Manage production shifts and timings.</p>
        </div>
        <Button onClick={openAddModal} className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white font-semibold">
          <Plus className="w-4 h-4 mr-2" />
          Add Shift
        </Button>
      </div>

      <div className="rounded-[14px] border border-black/[0.04] bg-[#FFFFFF] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[15px] text-left">
            <thead className="bg-[#FFFFFF] border-b border-[#E0E7FF] text-[#64748B] text-[13px] uppercase tracking-wider font-heading">
              <tr>
                <th className="px-6 py-4 font-medium">Shift Name</th>
                <th className="px-6 py-4 font-medium">Start Time</th>
                <th className="px-6 py-4 font-medium">End Time</th>
                <th className="px-6 py-4 font-medium">Breaks</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0E7FF]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[#64748B]">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-6 h-6 border-2 border-[#E0E7FF] border-t-[#4F46E5] rounded-full animate-spin" />
                      Loading shifts...
                    </div>
                  </td>
                </tr>
              ) : shifts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[#94A3B8]">
                    No shifts found. Create one to get started.
                  </td>
                </tr>
              ) : (
                shifts.map((shift) => (
                  <tr key={shift.id} className="hover:bg-[#EEF2FF]/50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-[#172554]">{shift.name}</td>
                    <td className="px-6 py-4 text-[#172554] font-mono">{shift.startTime}</td>
                    <td className="px-6 py-4 text-[#172554] font-mono">{shift.endTime}</td>
                    <td className="px-6 py-4 text-[#172554] font-mono">
                      {shift.breaks && shift.breaks.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {shift.breaks.map((b, i) => (
                            <span key={i}>{b.startTime} - {b.endTime}</span>
                          ))}
                        </div>
                      ) : 'No Breaks'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                         <Switch 
                           checked={shift.isActive} 
                           onCheckedChange={() => toggleActive(shift)}
                         />
                         <span className="text-xs text-[#64748B]">
                           {shift.isActive ? 'Active' : 'Inactive'}
                         </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(shift)}
                          className="text-[#64748B] hover:text-[#172554] hover:bg-[#E0E7FF]"
                        >
                          <PencilSimple className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setShiftToDelete(shift)}
                          className="text-[#64748B] hover:text-red-500 hover:bg-red-50"
                        >
                          <Trash className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ShiftModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveShift}
        shift={editingShift}
      />
      <ConfirmDeleteDialog
        open={!!shiftToDelete}
        onOpenChange={(open) => !open && setShiftToDelete(null)}
        onConfirm={() => shiftToDelete && shiftToDelete.id && handleDeleteShift(shiftToDelete.id)}
        title="Delete Shift?"
        description="Are you sure you want to delete this shift? Timings and shifts mapped to production schedules may be affected."
        itemName={shiftToDelete?.name}
      />
    </div>
  )
}
