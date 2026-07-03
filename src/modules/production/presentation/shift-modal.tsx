import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import type { Shift } from './shift-master-page'

export function ShiftModal({
  isOpen,
  onClose,
  onSave,
  shift,
}: {
  isOpen: boolean
  onClose: () => void
  onSave: (shift: Partial<Shift>) => void
  shift: Shift | null
}) {
  const [name, setName] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [breakStartTime, setBreakStartTime] = useState('')
  const [breakEndTime, setBreakEndTime] = useState('')

  useEffect(() => {
    if (shift) {
      setName(shift.name)
      setStartTime(shift.startTime)
      setEndTime(shift.endTime)
      setBreakStartTime(shift.breakStartTime || '')
      setBreakEndTime(shift.breakEndTime || '')
    } else {
      setName('')
      setStartTime('')
      setEndTime('')
      setBreakStartTime('')
      setBreakEndTime('')
    }
  }, [shift, isOpen])

  const handleSave = () => {
    onSave({
      ...(shift?.id ? { id: shift.id } : {}),
      name,
      startTime,
      endTime,
      breakStartTime,
      breakEndTime,
      isActive: shift ? shift.isActive : true
    })
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] bg-[#FFFFFF] border-[#E0E7FF] text-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading text-[#172554]">
            {shift ? 'Edit Shift' : 'New Shift'}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="shift-name" className="text-[#64748B]">Shift Name</Label>
            <Input
              id="shift-name"
              placeholder="e.g. Morning Shift"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-[#F4F6FB] border-[#E0E7FF] text-[#172554]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-time" className="text-[#64748B]">Start Time</Label>
              <Input
                id="start-time"
                placeholder="e.g. 08:00 AM"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="bg-[#F4F6FB] border-[#E0E7FF] text-[#172554] font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-time" className="text-[#64748B]">End Time</Label>
              <Input
                id="end-time"
                placeholder="e.g. 08:30 PM"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="bg-[#F4F6FB] border-[#E0E7FF] text-[#172554] font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="break-start" className="text-[#64748B]">Break Start (Optional)</Label>
              <Input
                id="break-start"
                placeholder="e.g. 01:00 PM"
                value={breakStartTime}
                onChange={(e) => setBreakStartTime(e.target.value)}
                className="bg-[#F4F6FB] border-[#E0E7FF] text-[#172554] font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="break-end" className="text-[#64748B]">Break End (Optional)</Label>
              <Input
                id="break-end"
                placeholder="e.g. 01:30 PM"
                value={breakEndTime}
                onChange={(e) => setBreakEndTime(e.target.value)}
                className="bg-[#F4F6FB] border-[#E0E7FF] text-[#172554] font-mono"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-[#E0E7FF] text-[#64748B] hover:text-[#172554]">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name || !startTime || !endTime} className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white">
            Save Shift
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
