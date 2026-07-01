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
  const [breakDurationMins, setBreakDurationMins] = useState(0)

  useEffect(() => {
    if (shift) {
      setName(shift.name)
      setStartTime(shift.startTime)
      setEndTime(shift.endTime)
      setBreakDurationMins(shift.breakDurationMins)
    } else {
      setName('')
      setStartTime('08:00 AM')
      setEndTime('05:00 PM')
      setBreakDurationMins(0)
    }
  }, [shift, isOpen])

  const handleSave = () => {
    onSave({
      ...(shift?.id ? { id: shift.id } : {}),
      name,
      startTime,
      endTime,
      breakDurationMins,
      isActive: shift ? shift.isActive : true
    })
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] bg-[#0C1221] border-[#243050] text-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading text-white">
            {shift ? 'Edit Shift' : 'New Shift'}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="shift-name" className="text-[#8B9FC4]">Shift Name</Label>
            <Input
              id="shift-name"
              placeholder="e.g. Shift 1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-[#050810] border-[#243050] text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-time" className="text-[#8B9FC4]">Start Time</Label>
              <Input
                id="start-time"
                placeholder="e.g. 08:00 AM"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="bg-[#050810] border-[#243050] text-white font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-time" className="text-[#8B9FC4]">End Time</Label>
              <Input
                id="end-time"
                placeholder="e.g. 08:30 PM"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="bg-[#050810] border-[#243050] text-white font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="break-mins" className="text-[#8B9FC4]">Break Duration (Minutes)</Label>
            <Input
              id="break-mins"
              type="number"
              min="0"
              value={breakDurationMins}
              onChange={(e) => setBreakDurationMins(parseInt(e.target.value) || 0)}
              className="bg-[#050810] border-[#243050] text-white"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-[#243050] text-[#8B9FC4] hover:text-white">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name || !startTime || !endTime} className="bg-amber-500 hover:bg-amber-600 text-black">
            Save Shift
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
