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
import { Plus, X } from '@phosphor-icons/react'
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
  const [breaks, setBreaks] = useState<{startTime: string, endTime: string}[]>([])

  useEffect(() => {
    if (shift) {
      setName(shift.name)
      setStartTime(shift.startTime)
      setEndTime(shift.endTime)
      setBreaks(shift.breaks || [])
    } else {
      setName('')
      setStartTime('')
      setEndTime('')
      setBreaks([])
    }
  }, [shift, isOpen])

  const handleAddBreak = () => {
    setBreaks([...breaks, { startTime: '', endTime: '' }])
  }

  const handleRemoveBreak = (index: number) => {
    setBreaks(breaks.filter((_, i) => i !== index))
  }

  const handleBreakChange = (index: number, field: 'startTime' | 'endTime', value: string) => {
    const newBreaks = [...breaks]
    newBreaks[index][field] = value
    setBreaks(newBreaks)
  }

  const handleSave = () => {
    // Filter out empty breaks before saving
    const validBreaks = breaks.filter(b => b.startTime && b.endTime)
    onSave({
      ...(shift?.id ? { id: shift.id } : {}),
      name,
      startTime,
      endTime,
      breaks: validBreaks,
      isActive: shift ? shift.isActive : true
    })
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] bg-[#FFFFFF] border-[#E0E7FF] text-foreground max-h-[85vh] overflow-y-auto">
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

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-[#64748B]">Breaks</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddBreak} className="h-8 text-xs border-[#E0E7FF] text-[#4F46E5] hover:bg-[#EEF2FF]">
                <Plus className="w-3 h-3 mr-1" /> Add Break
              </Button>
            </div>
            {breaks.length === 0 ? (
              <p className="text-xs text-[#94A3B8] italic">No breaks configured.</p>
            ) : (
              <div className="space-y-3">
                {breaks.map((b, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-[#F4F6FB] p-3 rounded-lg border border-[#E0E7FF]/50">
                    <div className="flex-1 space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-[#94A3B8]">Start Time</Label>
                      <Input
                        placeholder="e.g. 01:00 PM"
                        value={b.startTime}
                        onChange={(e) => handleBreakChange(idx, 'startTime', e.target.value)}
                        className="bg-[#FFFFFF] border-[#E0E7FF] text-[#172554] font-mono h-8 text-xs"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-[#94A3B8]">End Time</Label>
                      <Input
                        placeholder="e.g. 01:30 PM"
                        value={b.endTime}
                        onChange={(e) => handleBreakChange(idx, 'endTime', e.target.value)}
                        className="bg-[#FFFFFF] border-[#E0E7FF] text-[#172554] font-mono h-8 text-xs"
                      />
                    </div>
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleRemoveBreak(idx)}
                      className="mt-5 h-8 w-8 text-[#94A3B8] hover:text-red-500 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
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
