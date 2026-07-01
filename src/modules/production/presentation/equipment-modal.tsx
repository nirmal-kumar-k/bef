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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Equipment } from './equipment-master-page'

interface EquipmentModalProps {
  isOpen: boolean
  onClose: () => void
  initialData: Equipment | null
}

export function EquipmentModal({ isOpen, onClose, initialData }: EquipmentModalProps) {
  const [formData, setFormData] = useState<Partial<Equipment>>({
    name: '',
    type: 'Furnace',
    weightCapacity: undefined,
    firstHeatDurationMins: 150,
    regularHeatDurationMins: 150,
    avgPiecesPerHour: undefined,
    isActive: true
  })
  
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData(initialData)
      } else {
        setFormData({
          name: '',
          type: 'Furnace',
          weightCapacity: undefined,
          firstHeatDurationMins: 150,
          regularHeatDurationMins: 150,
          avgPiecesPerHour: undefined,
          isActive: true
        })
      }
    }
  }, [isOpen, initialData])

  const handleSave = async () => {
    if (!formData.name || !formData.type) return
    
    setIsSaving(true)
    try {
      const url = formData.id ? `/api/equipment/${formData.id}` : '/api/equipment'
      const method = formData.id ? 'PUT' : 'POST'
      
      const payload = { ...formData }
      // Clean up irrelevant fields based on type before saving
      if (payload.type !== 'Furnace') {
        payload.firstHeatDurationMins = undefined
        payload.regularHeatDurationMins = undefined
      }
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      if (res.ok) {
        onClose()
      } else {
        console.error('Failed to save equipment')
      }
    } catch (error) {
      console.error('Error saving equipment:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const isFurnace = formData.type === 'Furnace'

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-[#0C1221] border-[#243050] text-[#EEF3FF] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading font-bold text-[#EEF3FF]">
            {initialData ? 'Edit Equipment' : 'Add New Equipment'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label htmlFor="type" className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Equipment Type</Label>
            <Select 
              value={formData.type} 
              onValueChange={(val: any) => setFormData(prev => ({ ...prev, type: val }))}
              disabled={!!initialData} // Usually type shouldn't change after creation
            >
              <SelectTrigger id="type" className="bg-[#050810] border-[#243050] focus:border-[#D4521A] focus:ring-[#D4521A]">
                <SelectValue placeholder="Select Type" />
              </SelectTrigger>
              <SelectContent className="bg-[#0C1221] border-[#243050]">
                <SelectItem value="Furnace" className="text-[#EEF3FF] focus:bg-[#1A263D]">Furnace</SelectItem>
                <SelectItem value="Moulding Machine" className="text-[#EEF3FF] focus:bg-[#1A263D]">Moulding Machine</SelectItem>
                <SelectItem value="Core Machine" className="text-[#EEF3FF] focus:bg-[#1A263D]">Core Machine</SelectItem>
                <SelectItem value="Knockout" className="text-[#EEF3FF] focus:bg-[#1A263D]">Knockout</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="name" className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Equipment Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Induction Furnace A"
              className="bg-[#050810] border-[#243050] focus:border-[#D4521A] text-[#EEF3FF]"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="weight" className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Weight Capacity (kg)</Label>
            <Input
              id="weight"
              type="number"
              value={formData.weightCapacity || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, weightCapacity: e.target.value ? Number(e.target.value) : undefined }))}
              placeholder="e.g. 500"
              className="bg-[#050810] border-[#243050] focus:border-[#D4521A] text-[#EEF3FF] font-mono"
            />
          </div>

          {isFurnace && (
            <div className="grid grid-cols-2 gap-4 bg-[#1A263D]/30 p-4 rounded-lg border border-[#243050]/50">
              <div className="grid gap-2">
                <Label htmlFor="firstHeat" className="text-[#D4521A] text-[10px] font-bold uppercase tracking-wider">First Heat (Mins)</Label>
                <Input
                  id="firstHeat"
                  type="number"
                  value={formData.firstHeatDurationMins || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstHeatDurationMins: e.target.value ? Number(e.target.value) : undefined }))}
                  className="bg-[#050810] border-[#D4521A]/30 focus:border-[#D4521A] text-[#EEF3FF] font-mono"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="regHeat" className="text-[#D4521A] text-[10px] font-bold uppercase tracking-wider">Regular Heat (Mins)</Label>
                <Input
                  id="regHeat"
                  type="number"
                  value={formData.regularHeatDurationMins || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, regularHeatDurationMins: e.target.value ? Number(e.target.value) : undefined }))}
                  className="bg-[#050810] border-[#D4521A]/30 focus:border-[#D4521A] text-[#EEF3FF] font-mono"
                />
              </div>
            </div>
          )}

          {!isFurnace && (
            <div className="grid gap-2">
              <Label htmlFor="avgPieces" className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Avg Pieces Per Hour</Label>
              <Input
                id="avgPieces"
                type="number"
                value={formData.avgPiecesPerHour || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, avgPiecesPerHour: e.target.value ? Number(e.target.value) : undefined }))}
                placeholder="e.g. 100"
                className="bg-[#050810] border-[#243050] focus:border-[#D4521A] text-[#EEF3FF] font-mono"
              />
            </div>
          )}

        </div>

        <DialogFooter className="mt-2">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="border-[#243050] text-[#8B9FC4] hover:text-[#EEF3FF] hover:bg-[#1A263D]"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!formData.name || !formData.type || isSaving}
            className="bg-[#D4521A] hover:bg-[#D4521A]/90 text-white font-medium min-w-[100px]"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
