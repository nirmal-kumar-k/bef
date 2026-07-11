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
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/ui/command'
import { Check, Plus } from '@phosphor-icons/react'
import { cn } from '@/shared/lib/utils'
import { Equipment } from './equipment-master-page'

interface CoreBoxOption {
  code: string
  patternCode: string
}

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
    restrictedCoreBoxes: [],
    isActive: true
  })
  
  const [isSaving, setIsSaving] = useState(false)
  const [coreBoxOptions, setCoreBoxOptions] = useState<CoreBoxOption[]>([])
  const [coreBoxPickerOpen, setCoreBoxPickerOpen] = useState(false)

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
          restrictedCoreBoxes: [],
          isActive: true
        })
      }
    }
  }, [isOpen, initialData])

  useEffect(() => {
    if (!isOpen) return
    fetch('/api/patterns')
      .then(r => r.json())
      .then((patterns: any[]) => {
        const options: CoreBoxOption[] = []
        patterns.forEach(p => {
          p.sharedCoreBoxes?.forEach((cb: any) => {
            if (cb.code) options.push({ code: cb.code, patternCode: p.code })
          })
        })
        setCoreBoxOptions(options)
      })
      .catch(() => {})
  }, [isOpen])

  const toggleCoreBox = (code: string) => {
    setFormData(prev => {
      const current = prev.restrictedCoreBoxes || []
      const next = current.includes(code) ? current.filter(c => c !== code) : [...current, code]
      return { ...prev, restrictedCoreBoxes: next }
    })
  }

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
      if (!['Knockout', 'Core Machine', 'Moulding Machine'].includes(payload.type || '')) {
        payload.avgPiecesPerHour = undefined
      }
      if (payload.type !== 'Core Machine') {
        payload.restrictedCoreBoxes = undefined
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
      <DialogContent className="bg-[#FFFFFF] border-[#E0E7FF] text-[#172554] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading font-bold text-[#172554]">
            {initialData ? 'Edit Equipment' : 'Add New Equipment'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label htmlFor="type" className="text-[#64748B] text-xs font-semibold uppercase tracking-wider">Equipment Type</Label>
            <Select 
              value={formData.type} 
              onValueChange={(val: any) => setFormData(prev => ({ ...prev, type: val }))}
              disabled={!!initialData} // Usually type shouldn't change after creation
            >
              <SelectTrigger id="type" className="bg-[#F4F6FB] border-[#E0E7FF] focus:border-[#4F46E5] focus:ring-[#4F46E5]">
                <SelectValue placeholder="Select Type" />
              </SelectTrigger>
              <SelectContent className="bg-[#FFFFFF] border-[#E0E7FF]">
                <SelectItem value="Core Machine" className="text-[#172554] focus:bg-[#EEF2FF]">Core Machine</SelectItem>
                <SelectItem value="Moulding Machine" className="text-[#172554] focus:bg-[#EEF2FF]">Moulding Machine</SelectItem>
                <SelectItem value="Furnace" className="text-[#172554] focus:bg-[#EEF2FF]">Furnace</SelectItem>
                <SelectItem value="Knockout" className="text-[#172554] focus:bg-[#EEF2FF]">Knockout</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="name" className="text-[#64748B] text-xs font-semibold uppercase tracking-wider">Equipment Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Induction Furnace A"
              className="bg-[#F4F6FB] border-[#E0E7FF] focus:border-[#4F46E5] text-[#172554]"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="weight" className="text-[#64748B] text-xs font-semibold uppercase tracking-wider">Weight Capacity (kg)</Label>
            <Input
              id="weight"
              type="number"
              value={formData.weightCapacity || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, weightCapacity: e.target.value ? Number(e.target.value) : undefined }))}
              placeholder="e.g. 500"
              className="bg-[#F4F6FB] border-[#E0E7FF] focus:border-[#4F46E5] text-[#172554] font-mono"
            />
          </div>

          {isFurnace && (
            <div className="grid grid-cols-2 gap-4 bg-[#EEF2FF]/30 p-4 rounded-lg border border-[#E0E7FF]/50">
              <div className="grid gap-2">
                <Label htmlFor="firstHeat" className="text-[#4F46E5] text-[10px] font-bold uppercase tracking-wider">First Heat (Mins)</Label>
                <Input
                  id="firstHeat"
                  type="number"
                  value={formData.firstHeatDurationMins || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstHeatDurationMins: e.target.value ? Number(e.target.value) : undefined }))}
                  className="bg-[#F4F6FB] border-[#4F46E5]/30 focus:border-[#4F46E5] text-[#172554] font-mono"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="regHeat" className="text-[#4F46E5] text-[10px] font-bold uppercase tracking-wider">Regular Heat (Mins)</Label>
                <Input
                  id="regHeat"
                  type="number"
                  value={formData.regularHeatDurationMins || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, regularHeatDurationMins: e.target.value ? Number(e.target.value) : undefined }))}
                  className="bg-[#F4F6FB] border-[#4F46E5]/30 focus:border-[#4F46E5] text-[#172554] font-mono"
                />
              </div>
            </div>
          )}

          {formData.type === 'Knockout' && (
            <div className="grid gap-2">
              <Label htmlFor="avgPieces" className="text-[#64748B] text-xs font-semibold uppercase tracking-wider">
                Avg Pieces Per Hour
              </Label>
              <Input
                id="avgPieces"
                type="number"
                value={formData.avgPiecesPerHour || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, avgPiecesPerHour: e.target.value ? Number(e.target.value) : undefined }))}
                placeholder="e.g. 100"
                className="bg-[#F4F6FB] border-[#E0E7FF] focus:border-[#4F46E5] text-[#172554] font-mono"
              />
            </div>
          )}

          {formData.type === 'Core Machine' && (
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-[#64748B] text-xs font-semibold uppercase tracking-wider">
                  Mapped Core Boxes
                </Label>
                <Popover open={coreBoxPickerOpen} onOpenChange={setCoreBoxPickerOpen}>
                  <PopoverTrigger className="flex items-center gap-1 text-xs font-semibold text-[#4F46E5] hover:text-[#4F46E5]/80 transition-colors">
                    <Plus weight="bold" className="h-3.5 w-3.5" />
                    Add Core Box
                  </PopoverTrigger>
                  <PopoverContent className="w-[480px] p-0 bg-[#FFFFFF] border-[#E0E7FF]" align="end">
                    <Command className="bg-transparent">
                      <CommandInput placeholder="Search core boxes..." className="text-[#172554]" />
                      <CommandList className="max-h-[360px]">
                        <CommandEmpty className="p-4 text-center text-sm text-[#64748B]">No core boxes found.</CommandEmpty>
                        <CommandGroup>
                          {coreBoxOptions.map(opt => {
                            const selected = formData.restrictedCoreBoxes?.includes(opt.code) || false
                            return (
                              <CommandItem
                                key={opt.code}
                                value={opt.code}
                                keywords={[opt.patternCode]}
                                onSelect={() => toggleCoreBox(opt.code)}
                                className="text-[#172554] hover:bg-[#EEF2FF] cursor-pointer py-2.5"
                              >
                                <Check weight="duotone" className={cn('mr-2 h-4 w-4 shrink-0', selected ? 'opacity-100 text-[#4F46E5]' : 'opacity-0')} />
                                <span className="flex-1 truncate">{opt.code}</span>
                                <span className="text-[10px] text-[#94A3B8] font-mono ml-2">{opt.patternCode}</span>
                              </CommandItem>
                            )
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="border border-[#E0E7FF] rounded-md bg-[#F4F6FB] max-h-[220px] overflow-y-auto divide-y divide-[#E0E7FF]">
                {!formData.restrictedCoreBoxes?.length ? (
                  <p className="text-sm text-[#94A3B8] px-3 py-3">No core boxes mapped yet.</p>
                ) : (
                  formData.restrictedCoreBoxes.map(code => {
                    const opt = coreBoxOptions.find(o => o.code === code)
                    return (
                      <div key={code} className="flex items-center justify-between px-3 py-2 hover:bg-[#EEF2FF]/50">
                        <div>
                          <span className="text-sm font-mono font-medium text-[#172554]">{code}</span>
                          {opt && <span className="text-[10px] text-[#94A3B8] font-mono ml-2">{opt.patternCode}</span>}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleCoreBox(code)}
                          className="text-[#94A3B8] hover:text-red-400 text-lg leading-none px-1"
                        >
                          ×
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="border-[#E0E7FF] text-[#64748B] hover:text-[#172554] hover:bg-[#EEF2FF]"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!formData.name || !formData.type || isSaving}
            className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white font-medium min-w-[100px]"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
