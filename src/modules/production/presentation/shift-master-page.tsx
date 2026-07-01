'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, PencilSimple } from '@phosphor-icons/react'
import { Button } from '@/shared/ui/button'
import { ShiftModal } from './shift-modal'
import { Switch } from '@/shared/ui/switch'

export interface Shift {
  id?: string
  name: string
  startTime: string
  endTime: string
  breakDurationMins: number
  isActive: boolean
}

export default function ShiftMasterPage() {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)

  const fetchShifts = useCallback(async () => {
    try {
      const res = await fetch('/api/shifts')
      if (res.ok) {
        const data = await res.json()
        setShifts(data)
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
          <h1 className="text-3xl font-bold font-heading text-white">Shift Master</h1>
          <p className="text-[#8B9FC4] mt-1">Manage production shifts and timings.</p>
        </div>
        <Button onClick={openAddModal} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold">
          <Plus className="w-4 h-4 mr-2" />
          Add Shift
        </Button>
      </div>

      <div className="rounded-[14px] border border-white/[0.06] bg-[#0C1221] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[15px] text-left">
            <thead className="bg-[#0C1221] border-b border-[#243050] text-[#8B9FC4] text-[13px] uppercase tracking-wider font-heading">
              <tr>
                <th className="px-6 py-4 font-medium">Shift Name</th>
                <th className="px-6 py-4 font-medium">Start Time</th>
                <th className="px-6 py-4 font-medium">End Time</th>
                <th className="px-6 py-4 font-medium">Break (Mins)</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#243050]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[#8B9FC4]">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-6 h-6 border-2 border-[#243050] border-t-[#D4521A] rounded-full animate-spin" />
                      Loading shifts...
                    </div>
                  </td>
                </tr>
              ) : shifts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[#5A6E90]">
                    No shifts found. Create one to get started.
                  </td>
                </tr>
              ) : (
                shifts.map((shift) => (
                  <tr key={shift.id} className="hover:bg-[#1A263D]/50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-white">{shift.name}</td>
                    <td className="px-6 py-4 text-[#EEF3FF] font-mono">{shift.startTime}</td>
                    <td className="px-6 py-4 text-[#EEF3FF] font-mono">{shift.endTime}</td>
                    <td className="px-6 py-4 text-[#EEF3FF]">{shift.breakDurationMins}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                         <Switch 
                           checked={shift.isActive} 
                           onCheckedChange={() => toggleActive(shift)}
                         />
                         <span className="text-xs text-[#8B9FC4]">
                           {shift.isActive ? 'Active' : 'Inactive'}
                         </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditModal(shift)}
                        className="text-[#8B9FC4] hover:text-[#EEF3FF] hover:bg-[#243050]"
                      >
                        <PencilSimple className="w-4 h-4" />
                      </Button>
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
    </div>
  )
}
