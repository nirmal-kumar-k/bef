'use client'

import { useState, useMemo, useEffect } from 'react'
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
import { Textarea } from '@/shared/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/ui/popover'
import { ImageCarousel } from '@/shared/ui/image-carousel'
import { Check, CaretUpDown, Plus, Trash, Lock } from '@phosphor-icons/react'
import { ConfirmDeleteDialog } from '@/shared/ui/confirm-delete-dialog'
import { cn, handleEnterToTab } from '@/shared/lib/utils'

interface CoreBox {
  id: string
  code: string
  owner: 'Foundry' | 'Customer'
  images: string[]
  typeOfCore?: string
  coreWeight?: number
  avgCoreProduction?: string
}

export function ViewPatternModal({
  pattern,
  isOpen,
  onClose,
  onSave,
  onDelete,
}: {
  pattern: any | null
  isOpen: boolean
  onClose: () => void
  onSave?: (updated: any) => void
  onDelete?: (id: string) => void
}) {
  const [customerOpen, setCustomerOpen] = useState(false)
  const [coreBoxToDelete, setCoreBoxToDelete] = useState<string | null>(null)
  const [showDeletePattern, setShowDeletePattern] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [customers, setCustomers] = useState<{ value: string; label: string }[]>([])

  const [patternCode, setPatternCode] = useState('')
  const [patternName, setPatternName] = useState('')
  const [category, setCategory] = useState('Machine Moulding')
  const [remarks, setRemarks] = useState('')

  // Top Matchplate/Cope
  const [topPresent, setTopPresent] = useState<'Yes' | 'No'>('Yes')
  const [topOwner, setTopOwner] = useState<'Foundry' | 'Customer'>('Foundry')
  const [topImages, setTopImages] = useState<string[]>([])

  // Bottom Matchplate/Drag
  const [bottomPresent, setBottomPresent] = useState<'Yes' | 'No'>('Yes')
  const [bottomOwner, setBottomOwner] = useState<'Foundry' | 'Customer'>('Foundry')
  const [bottomImages, setBottomImages] = useState<string[]>([])

  // Shared Core Box
  const [coreBoxPresent, setCoreBoxPresent] = useState<'Yes' | 'No'>('Yes')
  const [sharedCoreBoxes, setSharedCoreBoxes] = useState<CoreBox[]>([{ id: 'init-shared', code: '', owner: 'Foundry', images: [] }])

  const [typeOfCoreInput, setTypeOfCoreInput] = useState('')

  // Moulding metrics
  const [avgMouldsPerHour, setAvgMouldsPerHour] = useState<number | ''>('')

  // Weights & Images
  const [goodCastingWeight, setGoodCastingWeight] = useState<number | ''>('')
  const [totalBoxWeight, setTotalBoxWeight] = useState<number | ''>('')
  const [patternImages, setPatternImages] = useState<string[]>([])

  const yieldPercentage = useMemo(() => {
    if (typeof goodCastingWeight === 'number' && typeof totalBoxWeight === 'number' && totalBoxWeight > 0) {
      return ((goodCastingWeight / totalBoxWeight) * 100).toFixed(1) + '%'
    }
    return '-'
  }, [goodCastingWeight, totalBoxWeight])

  useEffect(() => {
    if (!isOpen) return
    fetch('/api/customers').then(r => r.json()).then(data => setCustomers(data)).catch(() => {})
  }, [isOpen])

  // Populate fields from pattern when opened
  useEffect(() => {
    if (pattern && isOpen) {
      setPatternCode(pattern.code || '')
      setPatternName(pattern.name || '')
      setCategory(pattern.category || 'Machine Moulding')
      setRemarks(pattern.remarks || '')
      setGoodCastingWeight(pattern.goodWeight ?? '')
      setTotalBoxWeight(pattern.totalWeight ?? '')
      setPatternImages(pattern.patternImages || [])
      setTopPresent(pattern.topMatchplate ? 'Yes' : 'No')
      setTopOwner(pattern.topOwner || 'Foundry')
      setTopImages(pattern.topImages || [])
      setBottomPresent(pattern.bottomMatchplate ? 'Yes' : 'No')
      setBottomOwner(pattern.bottomOwner || 'Foundry')
      setBottomImages(pattern.bottomImages || [])

      const savedBoxes = pattern.sharedCoreBoxes
      if (savedBoxes && savedBoxes.length > 0) {
        setCoreBoxPresent('Yes')
        setSharedCoreBoxes(savedBoxes)
      } else {
        setCoreBoxPresent('Yes')
        setSharedCoreBoxes([{ id: 'init-shared', code: '', owner: 'Foundry', images: [] }])
      }

      setAvgMouldsPerHour(pattern.avgMouldsPerHour ?? '')
    }
  }, [pattern, isOpen])

  // Resolve customer value from label after customers load
  useEffect(() => {
    if (pattern && customers.length > 0) {
      const c = customers.find(x => x.label === pattern.customer)
      setSelectedCustomer(c?.value || '')
    }
  }, [pattern, customers])

  const handleSaveClick = () => {
    if (!pattern || !patternCode.trim() || !patternName.trim() || !onSave) return
    const customerLabel = customers.find(c => c.value === selectedCustomer)?.label || ''
    onSave({
      ...pattern,
      code: patternCode.trim(),
      name: patternName.trim(),
      customer: customerLabel,
      category,
      goodWeight: typeof goodCastingWeight === 'number' ? goodCastingWeight : 0,
      totalWeight: typeof totalBoxWeight === 'number' ? totalBoxWeight : 0,
      topMatchplate: topPresent === 'Yes',
      topOwner,
      topImages,
      bottomMatchplate: bottomPresent === 'Yes',
      bottomOwner,
      bottomImages,
      coreBoxes: coreBoxPresent === 'Yes' ? sharedCoreBoxes.length : 0,
      sharedCoreBoxes: coreBoxPresent === 'Yes' ? sharedCoreBoxes : [],
      avgMouldsPerHour: typeof avgMouldsPerHour === 'number' ? avgMouldsPerHour : null,
      patternImages,
      remarks,
    })
  }

  if (!pattern) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="w-full sm:max-w-3xl md:max-w-4xl lg:max-w-5xl bg-[#050810] border-[#243050] text-foreground overflow-y-auto max-h-[90vh]"
        onKeyDown={handleEnterToTab}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold font-heading text-[#EEF3FF]">
            Edit Pattern
          </DialogTitle>
          <p className="text-sm text-[#5A6E90] mt-1">Manage details for {pattern.code}</p>
        </DialogHeader>

        <div className="grid gap-6 py-4">

          {/* Row 1: Pattern Code | Pattern Name */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Pattern Code</Label>
              <Input value={patternCode} onChange={e => setPatternCode(e.target.value)} placeholder="e.g. PAT-001" className="h-12 bg-[#0C1221] border-[#243050] text-[#EEF3FF] text-[15px]" />
            </div>
            <div className="space-y-2">
              <Label className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Pattern Name</Label>
              <Input value={patternName} onChange={e => setPatternName(e.target.value)} placeholder="e.g. Pump Housing" className="h-12 bg-[#0C1221] border-[#243050] text-[#EEF3FF] text-[15px]" />
            </div>
          </div>

          {/* Row 2: Customer | Category */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Customer</Label>
              <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                <PopoverTrigger className="flex h-12 w-full items-center justify-between rounded-lg border border-[#243050] bg-[#0C1221] px-4 text-sm hover:bg-[#1A263D] hover:text-white">
                  {selectedCustomer ? customers.find(c => c.value === selectedCustomer)?.label : <span className="text-[#5A6E90]">Select customer...</span>}
                  <CaretUpDown weight="duotone" className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0 bg-[#0C1221] border-[#243050]">
                  <Command className="bg-transparent">
                    <CommandInput placeholder="Search customers..." className="text-[#EEF3FF]" />
                    <CommandList>
                      <CommandEmpty className="p-4 text-center text-sm text-[#8B9FC4]">No customer found.</CommandEmpty>
                      <CommandGroup>
                        {customers.map(customer => (
                          <CommandItem
                            key={customer.value}
                            value={customer.value}
                            keywords={[customer.label]}
                            onSelect={() => { setSelectedCustomer(customer.value); setCustomerOpen(false) }}
                            className="text-[#EEF3FF] hover:bg-[#1A263D] cursor-pointer"
                          >
                            <Check weight="duotone" className={cn('mr-2 h-4 w-4', selectedCustomer === customer.value ? 'opacity-100 text-[#D4521A]' : 'opacity-0')} />
                            {customer.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category" className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Pattern Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-12 bg-[#0C1221] border-[#243050] text-[#EEF3FF]">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0C1221] border-[#243050]">
                    <SelectItem value="Machine Moulding">Machine Moulding</SelectItem>
                    <SelectItem value="Hand Moulding">Hand Moulding</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Avg Moulds per Hour</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g. 12"
                  value={avgMouldsPerHour}
                  onChange={(e) => setAvgMouldsPerHour(e.target.value === '' ? '' : Number(e.target.value))}
                  className="h-12 bg-[#0C1221] border-[#243050] text-[#EEF3FF]"
                />
              </div>
            </div>
          </div>

          {/* Pattern Images */}
          <div className="space-y-2 pt-2 border-t border-[#243050]">
            <Label className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider mb-2 block">Pattern Images</Label>
            <ImageCarousel images={patternImages} onImagesChange={setPatternImages} size="small" previewPosition="right" />
          </div>

          {/* Section: Matchplates */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#8B9FC4] uppercase tracking-wider border-b border-[#243050] pb-2">Top Matchplate / Cope</h3>
              <div className="grid grid-cols-12 gap-4 items-start bg-[#0C1221] p-4 rounded-xl border border-[#243050]">
                <div className="col-span-4 space-y-2">
                  <Label className="text-[#EEF3FF]">Top Matchplate / Cope</Label>
                  <Select value={topPresent} onValueChange={setTopPresent as any}>
                    <SelectTrigger className="bg-[#050810] border-[#243050]"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#050810] border-[#243050]">
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className={cn("col-span-4 space-y-2 transition-opacity duration-300", topPresent === 'No' && "opacity-50 pointer-events-none")}>
                  <Label className="text-[#8B9FC4]">Owner</Label>
                  <Select value={topOwner} onValueChange={setTopOwner as any} disabled={topPresent === 'No'}>
                    <SelectTrigger className="bg-[#050810] border-[#243050] disabled:opacity-100"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#050810] border-[#243050]">
                      <SelectItem value="Foundry">Foundry</SelectItem>
                      <SelectItem value="Customer">Customer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className={cn("col-span-4 space-y-2 transition-opacity duration-300", topPresent === 'No' && "opacity-50 pointer-events-none")}>
                  <Label className="text-[#8B9FC4]">Image</Label>
                  <ImageCarousel images={topImages} onImagesChange={setTopImages} disabled={topPresent === 'No'} size="large" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#8B9FC4] uppercase tracking-wider border-b border-[#243050] pb-2">Bottom Matchplate / Drag</h3>
              <div className="grid grid-cols-12 gap-4 items-start bg-[#0C1221] p-4 rounded-xl border border-[#243050]">
                <div className="col-span-4 space-y-2">
                  <Label className="text-[#EEF3FF]">Bottom Matchplate / Drag</Label>
                  <Select value={bottomPresent} onValueChange={setBottomPresent as any}>
                    <SelectTrigger className="bg-[#050810] border-[#243050]"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#050810] border-[#243050]">
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className={cn("col-span-4 space-y-2 transition-opacity duration-300", bottomPresent === 'No' && "opacity-50 pointer-events-none")}>
                  <Label className="text-[#8B9FC4]">Owner</Label>
                  <Select value={bottomOwner} onValueChange={setBottomOwner as any} disabled={bottomPresent === 'No'}>
                    <SelectTrigger className="bg-[#050810] border-[#243050] disabled:opacity-100"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#050810] border-[#243050]">
                      <SelectItem value="Foundry">Foundry</SelectItem>
                      <SelectItem value="Customer">Customer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className={cn("col-span-4 space-y-2 transition-opacity duration-300", bottomPresent === 'No' && "opacity-50 pointer-events-none")}>
                  <Label className="text-[#8B9FC4]">Image</Label>
                  <ImageCarousel images={bottomImages} onImagesChange={setBottomImages} disabled={bottomPresent === 'No'} size="large" />
                </div>
              </div>
            </div>

            {/* Shared Core Box */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#243050] pb-2">
                <div className="flex items-center gap-4">
                  <h3 className="text-sm font-semibold text-[#8B9FC4] uppercase tracking-wider">Core Box Details</h3>
                  <Select value={coreBoxPresent} onValueChange={(val: 'Yes' | 'No') => setCoreBoxPresent(val)}>
                    <SelectTrigger className="h-7 text-xs bg-[#0C1221] border-[#243050] w-[80px]"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#050810] border-[#243050]">
                      <SelectItem value="Yes" className="text-xs">Yes</SelectItem>
                      <SelectItem value="No" className="text-xs">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSharedCoreBoxes([...sharedCoreBoxes, { id: Date.now().toString(), code: '', owner: 'Foundry', images: [] }])} disabled={coreBoxPresent === 'No'} className="text-[#D4521A] hover:bg-[#D4521A]/10 hover:text-[#D4521A]">
                  <Plus className="w-4 h-4 mr-1" /> Add Core Box
                </Button>
              </div>

              <div className={cn("transition-opacity duration-300", coreBoxPresent === 'No' && "opacity-50 pointer-events-none")}>
                <div className="space-y-3">
                  {sharedCoreBoxes.map((cb, index) => (
                    <div key={cb.id} className="flex flex-col gap-4 bg-[#0C1221] p-4 rounded-lg border border-[#243050]">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 space-y-1.5">
                          <Label className="text-xs text-[#8B9FC4]">Code</Label>
                          <Input
                            value={cb.code}
                            onChange={(e) => setSharedCoreBoxes(sharedCoreBoxes.map(b => b.id === cb.id ? { ...b, code: e.target.value } : b))}
                            placeholder={patternCode ? `${patternCode}-CB${index + 1}` : `CB-${index + 1}`}
                            className="bg-[#050810]/50 border-[#243050] text-[#EEF3FF] h-9 focus-visible:ring-1 focus-visible:ring-[#D4521A]"
                          />
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <Label className="text-xs text-[#8B9FC4]">Owner</Label>
                          <Select value={cb.owner} onValueChange={(val: any) => setSharedCoreBoxes(sharedCoreBoxes.map(b => b.id === cb.id ? { ...b, owner: val } : b))}>
                            <SelectTrigger className="bg-[#050810] border-[#243050] h-9"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-[#050810] border-[#243050]">
                              <SelectItem value="Foundry">Foundry</SelectItem>
                              <SelectItem value="Customer">Customer</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex-1 space-y-1.5 min-w-[140px]">
                          <Label className="text-xs text-[#8B9FC4]">Images</Label>
                          <ImageCarousel images={cb.images} onImagesChange={(imgs) => setSharedCoreBoxes(sharedCoreBoxes.map(b => b.id === cb.id ? { ...b, images: imgs } : b))} disabled={coreBoxPresent === 'No'} size="small" />
                        </div>
                        <Button
                          variant="ghost"
                          onClick={() => setCoreBoxToDelete(cb.id)}
                          className="h-9 mt-6 px-3 shrink-0 text-[#5A6E90] hover:text-red-400 hover:bg-red-400/10"
                          disabled={sharedCoreBoxes.length <= 1}
                        >
                          <Trash className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Core Box Attributes */}
                      <div className="grid grid-cols-3 gap-4 pt-2 border-t border-[#243050]">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-[#8B9FC4]">Type of Core</Label>
                          <Input
                            value={cb.typeOfCore || ''}
                            onChange={(e) => setSharedCoreBoxes(sharedCoreBoxes.map(b => b.id === cb.id ? { ...b, typeOfCore: e.target.value } : b))}
                            placeholder="e.g. Shell"
                            className="bg-[#050810]/50 border-[#243050] text-[#EEF3FF] h-9 focus-visible:ring-1 focus-visible:ring-[#D4521A]"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-[#8B9FC4]">Core Wt (kg)</Label>
                          <Input
                            type="number"
                            min="0"
                            value={cb.coreWeight || ''}
                            onChange={(e) => setSharedCoreBoxes(sharedCoreBoxes.map(b => b.id === cb.id ? { ...b, coreWeight: e.target.value === '' ? undefined : Number(e.target.value) } : b))}
                            placeholder="0.0"
                            className="bg-[#050810]/50 border-[#243050] text-[#EEF3FF] h-9 focus-visible:ring-1 focus-visible:ring-[#D4521A]"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-[#8B9FC4]">Avg Core/hr</Label>
                          <Input
                            value={cb.avgCoreProduction || ''}
                            onChange={(e) => setSharedCoreBoxes(sharedCoreBoxes.map(b => b.id === cb.id ? { ...b, avgCoreProduction: e.target.value } : b))}
                            placeholder="e.g. 10"
                            className="bg-[#050810]/50 border-[#243050] text-[#EEF3FF] h-9 focus-visible:ring-1 focus-visible:ring-[#D4521A]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Weights & Remarks */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[#8B9FC4] uppercase tracking-wider border-b border-[#243050] pb-2">Weights & Additional Info</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1 text-[#EEF3FF]">Good Cast Wt (kg)</Label>
                <Input type="number" min="0" value={goodCastingWeight} onChange={(e) => setGoodCastingWeight(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0.0" className="bg-[#0C1221] border-[#243050] text-[#EEF3FF]" />
              </div>
              <div className="space-y-2">
                <Label className="text-amber-500">Yield %</Label>
                <div className="h-10 px-3 flex items-center bg-[#1A263D]/30 border border-[#243050] rounded-md text-amber-400 font-mono text-sm">{yieldPercentage}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#EEF3FF]">Total Box Wt (kg)</Label>
                <Input type="number" min={0} value={totalBoxWeight} onChange={(e) => setTotalBoxWeight(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0.0" className="bg-[#0C1221] border-[#243050] text-[#EEF3FF]" />
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <Label className="text-[#EEF3FF]">Remarks</Label>
              <Textarea placeholder="Any additional notes..." value={remarks} onChange={e => setRemarks(e.target.value)} className="bg-[#0C1221] border-[#243050] resize-none h-24 text-[#EEF3FF]" />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4 border-t border-[#243050] pt-4">
          {onDelete && (
            <Button
              variant="ghost"
              onClick={() => setShowDeletePattern(true)}
              className="text-red-400 hover:text-red-300 hover:bg-red-400/10 mr-auto"
            >
              Delete Pattern
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} className="text-[#8B9FC4] hover:bg-[#1A263D] hover:text-[#EEF3FF]">Cancel</Button>
          <Button onClick={handleSaveClick} disabled={!patternCode.trim() || !patternName.trim()} className="bg-[#D4521A] hover:bg-[#D4521A]/90 text-white shadow-lg shadow-[#D4521A]/20 disabled:opacity-50 font-semibold px-6">
            Save Pattern
          </Button>
        </DialogFooter>
      </DialogContent>

      <ConfirmDeleteDialog
        open={!!coreBoxToDelete}
        onOpenChange={(open) => !open && setCoreBoxToDelete(null)}
        onConfirm={() => {
          if (coreBoxToDelete) setSharedCoreBoxes(sharedCoreBoxes.filter(b => b.id !== coreBoxToDelete))
          setCoreBoxToDelete(null)
        }}
        title="Remove Core Box?"
        description="Are you sure you want to remove this core box?"
      />
      <ConfirmDeleteDialog
        open={showDeletePattern}
        onOpenChange={setShowDeletePattern}
        onConfirm={() => {
          if (pattern?.id && onDelete) {
            onDelete(pattern.id)
            onClose()
          }
        }}
        title="Delete Pattern?"
        description="This will permanently delete the pattern and cannot be undone."
        itemName={pattern?.code || pattern?.name}
      />
    </Dialog>
  )
}
