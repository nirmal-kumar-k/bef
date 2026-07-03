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
import { Badge } from '@/shared/ui/badge'
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
import { Check, CaretUpDown, CaretLeft, CaretRight, Image as ImageIcon, Lock, Plus, Trash, X, PencilSimple } from '@phosphor-icons/react'
import { ConfirmDeleteDialog } from '@/shared/ui/confirm-delete-dialog'
import { cn, handleEnterToTab } from '@/shared/lib/utils'
import { type Pattern } from '@/modules/patterns/domain/pattern.types'

interface CoreBox {
  id: string
  code: string
  owner: 'Foundry' | 'Customer'
  images: string[]
  typeOfCore?: string
  coreWeight?: number
  avgCoreProduction?: string
}


export function NewPatternModal({
  isOpen,
  onClose,
  onSave,
}: {
  isOpen: boolean
  onClose: () => void
  onSave: (pattern: Omit<Pattern, 'id'>) => void
}) {
  const [customerOpen, setCustomerOpen] = useState(false)
  const [coreBoxToDelete, setCoreBoxToDelete] = useState<{id: string, type: 'top'|'bottom'} | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState('')

  // Fetched data from API
  const [customers, setCustomers] = useState<{ value: string; label: string }[]>([])

  useEffect(() => {
    if (!isOpen) return
    fetch('/api/customers').then(r => r.json()).then(data => setCustomers(data)).catch(() => {})
  }, [isOpen])

  const [patternCode, setPatternCode] = useState('')
  const [patternName, setPatternName] = useState('')
  const [category, setCategory] = useState('Machine Moulding')
  const [remarks, setRemarks] = useState('')

  // Top Matchplate/Cope
  const [topPresent, setTopPresent] = useState<'Yes' | 'No'>('Yes')
  const [topOwner, setTopOwner] = useState<'Foundry' | 'Customer'>('Customer')
  const [topImages, setTopImages] = useState<string[]>([])

  // Top Core Boxes
  const [topCoreBoxPresent, setTopCoreBoxPresent] = useState<'Yes' | 'No'>('Yes')
  const [topCoreBoxes, setTopCoreBoxes] = useState<CoreBox[]>([{ id: 'init-top', code: '', owner: 'Foundry', images: [] }])

  // Bottom Matchplate/Drag
  const [bottomPresent, setBottomPresent] = useState<'Yes' | 'No'>('Yes')
  const [bottomOwner, setBottomOwner] = useState<'Foundry' | 'Customer'>('Customer')
  const [bottomImages, setBottomImages] = useState<string[]>([])

  // Bottom Core Boxes
  const [bottomCoreBoxPresent, setBottomCoreBoxPresent] = useState<'Yes' | 'No'>('Yes')
  const [bottomCoreBoxes, setBottomCoreBoxes] = useState<CoreBox[]>([{ id: 'init-bottom', code: '', owner: 'Foundry', images: [] }])

  // Shared Core Box (common for Top & Bottom)
  const [coreBoxPresent, setCoreBoxPresent] = useState<'Yes' | 'No'>('Yes')
  const [sharedCoreBoxes, setSharedCoreBoxes] = useState<CoreBox[]>([{ id: 'init-shared', code: '', owner: 'Foundry', images: [] }])

  // Core Box Details
  const [typeOfCoreOptions, setTypeOfCoreOptions] = useState<string[]>(['Oil Core', 'CO2 Core', 'Amine Core'])
  const [typeOfCoreInput, setTypeOfCoreInput] = useState('')

  // Moulding metrics
  const [avgMouldsPerHour, setAvgMouldsPerHour] = useState<number | ''>('')

  // Weights
  const [goodCastingWeight, setGoodCastingWeight] = useState<number | ''>('')
  const [runnerRiserWeight, setRunnerRiserWeight] = useState<number | ''>('')

  const totalBoxWeight = useMemo(() => {
    const gw = typeof goodCastingWeight === 'number' ? goodCastingWeight : 0
    const rw = typeof runnerRiserWeight === 'number' ? runnerRiserWeight : 0
    return gw + rw > 0 ? gw + rw : ''
  }, [goodCastingWeight, runnerRiserWeight])

  // Photos Preview
  const [patternImages, setPatternImages] = useState<string[]>([])

  // Derived Values
  const yieldPercentage = useMemo(() => {
    if (
      typeof goodCastingWeight === 'number' &&
      typeof totalBoxWeight === 'number' &&
      totalBoxWeight > 0
    ) {
      return ((goodCastingWeight / totalBoxWeight) * 100).toFixed(1) + '%'
    }
    return '-'
  }, [goodCastingWeight, totalBoxWeight])

  const showMatchplateBadge = topPresent === 'Yes' || bottomPresent === 'Yes'

  const resetForm = () => {
    setPatternCode('')
    setPatternName('')
    setSelectedCustomer('')
    setCategory('Machine Moulding')
    setRemarks('')
    setTopPresent('Yes')
    setTopOwner('Customer')
    setTopImages([])
    setTopCoreBoxPresent('Yes')
    setTopCoreBoxes([{ id: Date.now().toString(), code: '', owner: 'Foundry', images: [] }])
    setBottomPresent('Yes')
    setBottomOwner('Customer')
    setBottomImages([])
    setBottomCoreBoxPresent('Yes')
    setBottomCoreBoxes([{ id: (Date.now() + 1).toString(), code: '', owner: 'Foundry', images: [] }])
    setCoreBoxPresent('Yes')
    setSharedCoreBoxes([])
    setAvgMouldsPerHour('')
    setGoodCastingWeight('')
    setRunnerRiserWeight('')
    setPatternImages([])
  }

  const handleSave = () => {
    if (!patternCode.trim() || !patternName.trim()) return
    const customerLabel = customers.find(c => c.value === selectedCustomer)?.label || ''
    onSave({
      code: patternCode.trim(),
      name: patternName.trim(),
      customer: customerLabel,
      category,
      goodWeight: typeof goodCastingWeight === 'number' ? goodCastingWeight : 0,
      runnerRiserWeight: typeof runnerRiserWeight === 'number' ? runnerRiserWeight : 0,
      totalWeight: typeof totalBoxWeight === 'number' ? totalBoxWeight : 0,
      topMatchplate: topPresent === 'Yes',
      topOwner: topPresent === 'Yes' ? topOwner : 'Foundry',
      topImages: topPresent === 'Yes' ? topImages : [],
      bottomMatchplate: bottomPresent === 'Yes',
      bottomOwner: bottomPresent === 'Yes' ? bottomOwner : 'Foundry',
      bottomImages: bottomPresent === 'Yes' ? bottomImages : [],
      coreBoxes: coreBoxPresent === 'Yes' ? sharedCoreBoxes.length : 0,
      sharedCoreBoxes: coreBoxPresent === 'Yes' ? sharedCoreBoxes : [],
      avgMouldsPerHour: typeof avgMouldsPerHour === 'number' ? avgMouldsPerHour : null,
      patternImages,
      remarks,
      mappedProducts: [],
    })
    resetForm()
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent 
        className="w-full sm:max-w-3xl md:max-w-4xl lg:max-w-5xl bg-[#F4F6FB] border-[#E0E7FF] text-foreground overflow-y-auto max-h-[90vh]"
        onKeyDown={handleEnterToTab}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle className="text-xl font-heading text-[#172554]">
              New Pattern
            </DialogTitle>
            {showMatchplateBadge && (
              <Badge className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border-amber-500/50">
                Matchplate Present
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="grid gap-8 py-4">
          
          {/* Section: Basic Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[#64748B] uppercase tracking-wider border-b border-[#E0E7FF] pb-2">Basic Details</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#64748B] text-xs font-semibold uppercase tracking-wider">Avg Moulds per Hour</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g. 12"
                  value={avgMouldsPerHour}
                  onChange={(e) => setAvgMouldsPerHour(e.target.value === '' ? '' : Number(e.target.value))}
                  className="bg-[#FFFFFF] border-[#E0E7FF] text-[#172554]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pattern-code">Pattern Code</Label>
                <Input id="pattern-code" placeholder="Enter pattern code" value={patternCode} onChange={e => setPatternCode(e.target.value)} className="bg-[#FFFFFF] border-[#E0E7FF]" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer</Label>
                <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                  <PopoverTrigger
                    className="flex h-10 w-full items-center justify-between rounded-md border border-[#E0E7FF] bg-[#FFFFFF] px-3 py-2 text-sm hover:bg-[#EEF2FF] hover:text-white"
                    aria-expanded={customerOpen}
                  >
                    {selectedCustomer
                      ? customers.find((c) => c.value === selectedCustomer)?.label
                      : 'Select customer...'}
                    <CaretUpDown weight="duotone" className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0 bg-[#FFFFFF] border-[#E0E7FF]">
                    <Command className="bg-transparent">
                      <CommandInput placeholder="Search customer..." />
                      <CommandList>
                        <CommandEmpty>No customer found.</CommandEmpty>
                        <CommandGroup>
                          {customers.map((customer) => (
                            <CommandItem
                              key={customer.value}
                              value={customer.value}
                              keywords={[customer.label]}
                              onSelect={(currentValue) => {
                                setSelectedCustomer(
                                  currentValue === selectedCustomer ? '' : currentValue
                                )
                                setCustomerOpen(false)
                              }}
                              className="text-white hover:bg-[#EEF2FF]"
                            >
                              <Check weight="duotone"
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  selectedCustomer === customer.value ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              {customer.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pattern-name">Pattern Name</Label>
                <Input id="pattern-name" placeholder="Enter pattern name" value={patternName} onChange={e => setPatternName(e.target.value)} className="bg-[#FFFFFF] border-[#E0E7FF]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="bg-[#FFFFFF] border-[#E0E7FF]">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#F4F6FB] border-[#E0E7FF]">
                    <SelectItem value="Machine Moulding">Machine Moulding</SelectItem>
                    <SelectItem value="Hand Moulding">Hand Moulding</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Pattern Images */}
            <div className="space-y-2 pt-4 border-t border-[#E0E7FF]">
              <Label className="text-[#64748B] text-xs font-semibold uppercase tracking-wider mb-2 block">Pattern Images</Label>
              <ImageCarousel 
                images={patternImages} 
                onImagesChange={setPatternImages}
                size="small"
                previewPosition="right"
              />
            </div>
          </div>

          {/* Section: Matchplates */}
          <div className="space-y-8">
            {/* Top Matchplate Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#64748B] uppercase tracking-wider border-b border-[#E0E7FF] pb-2">Top Matchplate / Cope</h3>
              
              {/* Top Matchplate / Cope */}
              <div className="grid grid-cols-12 gap-4 items-start bg-[#FFFFFF] p-4 rounded-xl border border-[#E0E7FF]">
                <div className="col-span-4 space-y-2">
                  <Label className="text-[#172554]">Top Matchplate / Cope</Label>
                  <Select value={topPresent} onValueChange={setTopPresent as any}>
                    <SelectTrigger className="bg-[#F4F6FB] border-[#E0E7FF]">
                      <SelectValue placeholder="Present?" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#F4F6FB] border-[#E0E7FF]">
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className={cn("col-span-4 space-y-2 transition-opacity duration-300", topPresent === 'No' && "opacity-50 pointer-events-none")}>
                  <Label className="text-[#64748B]">Owner</Label>
                  <Select value={topOwner} onValueChange={setTopOwner as any} disabled={topPresent === 'No'}>
                    <SelectTrigger className="bg-[#F4F6FB] border-[#E0E7FF] disabled:opacity-100">
                      <SelectValue placeholder="Select owner" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#F4F6FB] border-[#E0E7FF]">
                      <SelectItem value="Foundry">Foundry</SelectItem>
                      <SelectItem value="Customer">Customer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className={cn("col-span-4 space-y-2 transition-opacity duration-300", topPresent === 'No' && "opacity-50 pointer-events-none")}>
                  <Label className="text-[#64748B]">Image</Label>
                  <ImageCarousel images={topImages} onImagesChange={setTopImages} disabled={topPresent === 'No'} size="large" />
                </div>
              </div>

            </div>

            {/* Bottom Matchplate Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#64748B] uppercase tracking-wider border-b border-[#E0E7FF] pb-2">Bottom Matchplate / Drag</h3>
              
              {/* Bottom Matchplate Toggle Row */}
              <div className="grid grid-cols-12 gap-4 items-start bg-[#FFFFFF] p-4 rounded-xl border border-[#E0E7FF]">
                <div className="col-span-4 space-y-2">
                  <Label className="text-[#172554]">Bottom Matchplate / Drag</Label>
                  <Select value={bottomPresent} onValueChange={setBottomPresent as any}>
                    <SelectTrigger className="bg-[#F4F6FB] border-[#E0E7FF]">
                      <SelectValue placeholder="Present?" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#F4F6FB] border-[#E0E7FF]">
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className={cn("col-span-4 space-y-2 transition-opacity duration-300", bottomPresent === 'No' && "opacity-50 pointer-events-none")}>
                  <Label className="text-[#64748B]">Owner</Label>
                  <Select value={bottomOwner} onValueChange={setBottomOwner as any} disabled={bottomPresent === 'No'}>
                    <SelectTrigger className="bg-[#F4F6FB] border-[#E0E7FF] disabled:opacity-100">
                      <SelectValue placeholder="Select owner" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#F4F6FB] border-[#E0E7FF]">
                      <SelectItem value="Foundry">Foundry</SelectItem>
                      <SelectItem value="Customer">Customer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className={cn("col-span-4 space-y-2 transition-opacity duration-300", bottomPresent === 'No' && "opacity-50 pointer-events-none")}>
                  <Label className="text-[#64748B]">Image</Label>
                  <ImageCarousel images={bottomImages} onImagesChange={setBottomImages} disabled={bottomPresent === 'No'} size="large" />
                </div>
              </div>
            </div>

            {/* Shared Core Box Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#E0E7FF] pb-2">
                <div className="flex items-center gap-4">
                  <h3 className="text-sm font-semibold text-[#64748B] uppercase tracking-wider">Core Box Details</h3>

                  <Select
                    value={coreBoxPresent}
                    onValueChange={(val: 'Yes' | 'No') => setCoreBoxPresent(val)}
                  >
                    <SelectTrigger className="h-7 text-xs bg-[#FFFFFF] border-[#E0E7FF] w-[80px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#F4F6FB] border-[#E0E7FF]">
                      <SelectItem value="Yes" className="text-xs">Yes</SelectItem>
                      <SelectItem value="No" className="text-xs">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSharedCoreBoxes([...sharedCoreBoxes, { id: Date.now().toString(), code: '', owner: 'Foundry', images: [] }])} disabled={coreBoxPresent === 'No'} className="text-[#4F46E5] hover:bg-[#4F46E5]/10 hover:text-[#4F46E5]">
                  <Plus className="w-4 h-4 mr-1" /> Add Core Box
                </Button>
              </div>

              <div className={cn("transition-opacity duration-300", coreBoxPresent === 'No' && "opacity-50 pointer-events-none")}>
                {sharedCoreBoxes.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-[#E0E7FF] rounded-xl bg-[#FFFFFF]/50">
                    <p className="text-[#94A3B8] text-sm">No core boxes added.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sharedCoreBoxes.map((cb, index) => (
                      <div key={cb.id} className="flex flex-col gap-4 bg-[#FFFFFF] p-4 rounded-lg border border-[#E0E7FF]">
                        <div className="flex items-start gap-4">
                          <div className="flex-1 space-y-1.5">
                          <Label className="text-xs text-[#64748B]">Code</Label>
                          <Input
                            value={cb.code}
                            onChange={(e) => setSharedCoreBoxes(sharedCoreBoxes.map(b => b.id === cb.id ? { ...b, code: e.target.value } : b))}
                            placeholder={patternCode ? `${patternCode}-CB${index + 1}` : `CB-${index + 1}`}
                            className="bg-[#F4F6FB]/50 border-[#E0E7FF] text-[#172554] h-9 focus-visible:ring-1 focus-visible:ring-[#4F46E5]"
                          />
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <Label className="text-xs text-[#64748B]">Owner</Label>
                          <Select value={cb.owner} onValueChange={(val: any) => setSharedCoreBoxes(sharedCoreBoxes.map(b => b.id === cb.id ? { ...b, owner: val } : b))}>
                            <SelectTrigger className="bg-[#F4F6FB] border-[#E0E7FF] h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#F4F6FB] border-[#E0E7FF]">
                              <SelectItem value="Foundry">Foundry</SelectItem>
                              <SelectItem value="Customer">Customer</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex-1 space-y-1.5 min-w-[140px]">
                          <Label className="text-xs text-[#64748B]">Images</Label>
                          <ImageCarousel images={cb.images} onImagesChange={(imgs) => setSharedCoreBoxes(sharedCoreBoxes.map(b => b.id === cb.id ? { ...b, images: imgs } : b))} disabled={coreBoxPresent === 'No'} size="small" />
                        </div>
                        <Button
                          variant="ghost"
                          onClick={() => setSharedCoreBoxes(sharedCoreBoxes.filter(b => b.id !== cb.id))}
                          className="h-9 mt-6 px-3 shrink-0 text-[#94A3B8] hover:text-red-400 hover:bg-red-400/10"
                          disabled={sharedCoreBoxes.length <= 1}
                        >
                          <Trash className="w-4 h-4" />
                        </Button>
                        </div>
                        
                        {/* Core Box Attributes */}
                        <div className="grid grid-cols-3 gap-4 pt-2 border-t border-[#E0E7FF]">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-[#64748B]">Type of Core</Label>
                            <Input
                              value={cb.typeOfCore || ''}
                              onChange={(e) => setSharedCoreBoxes(sharedCoreBoxes.map(b => b.id === cb.id ? { ...b, typeOfCore: e.target.value } : b))}
                              placeholder="e.g. Shell"
                              className="bg-[#F4F6FB]/50 border-[#E0E7FF] text-[#172554] h-9 focus-visible:ring-1 focus-visible:ring-[#4F46E5]"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-[#64748B]">Core Wt (kg)</Label>
                            <Input
                              type="number"
                              min="0"
                              value={cb.coreWeight || ''}
                              onChange={(e) => setSharedCoreBoxes(sharedCoreBoxes.map(b => b.id === cb.id ? { ...b, coreWeight: e.target.value === '' ? undefined : Number(e.target.value) } : b))}
                              placeholder="0.0"
                              className="bg-[#F4F6FB]/50 border-[#E0E7FF] text-[#172554] h-9 focus-visible:ring-1 focus-visible:ring-[#4F46E5]"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-[#64748B]">Avg Core/hr</Label>
                            <Input
                              value={cb.avgCoreProduction || ''}
                              onChange={(e) => setSharedCoreBoxes(sharedCoreBoxes.map(b => b.id === cb.id ? { ...b, avgCoreProduction: e.target.value } : b))}
                              placeholder="e.g. 10"
                              className="bg-[#F4F6FB]/50 border-[#E0E7FF] text-[#172554] h-9 focus-visible:ring-1 focus-visible:ring-[#4F46E5]"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section: Weights & Remarks */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[#64748B] uppercase tracking-wider border-b border-[#E0E7FF] pb-2">Weights & Additional Info</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1 text-[#172554]">Good Cast Wt (kg)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={goodCastingWeight}
                    onChange={(e) => setGoodCastingWeight(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0.0"
                    className="bg-[#FFFFFF] border-[#E0E7FF] text-[#172554]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-amber-500">Yield %</Label>
                  <div className="h-10 px-3 flex items-center bg-[#EEF2FF]/30 border border-[#E0E7FF] rounded-md text-amber-400 font-mono text-sm">
                    {yieldPercentage}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[#172554]">Runner/Riser Wt (kg)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={runnerRiserWeight}
                    onChange={(e) => setRunnerRiserWeight(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0.0"
                    className="bg-[#FFFFFF] border-[#E0E7FF] text-[#172554]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#172554]">Total Box Wt (kg)</Label>
                  <Input
                    type="number"
                    readOnly
                    value={totalBoxWeight}
                    placeholder="0.0"
                    className="bg-[#EEF2FF]/50 border-[#E0E7FF] text-[#172554] cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Label className="text-[#172554]">Remarks</Label>
              <Textarea
                placeholder="Any additional notes..."
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                className="bg-[#FFFFFF] border-[#E0E7FF] resize-none h-24 text-[#172554]"
              />
            </div>
          </div>

        </div>

        <DialogFooter className="mt-4 border-t border-[#E0E7FF] pt-4">
          <Button variant="ghost" onClick={handleClose} className="text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#172554]">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!patternCode.trim() || !patternName.trim()} className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white shadow-lg shadow-[#4F46E5]/20 disabled:opacity-50 font-semibold px-6">
            Save Pattern
          </Button>
        </DialogFooter>
      </DialogContent>
      <ConfirmDeleteDialog 
        open={!!coreBoxToDelete} 
        onOpenChange={(open) => !open && setCoreBoxToDelete(null)}
        onConfirm={() => {
          if (coreBoxToDelete) {
            setSharedCoreBoxes(sharedCoreBoxes.filter(b => b.id !== coreBoxToDelete.id))
          }
          setCoreBoxToDelete(null)
        }}
        title="Remove Core Box?"
        description="Are you sure you want to remove this core box?"
      />
    </Dialog>
  )
}
