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
import { Switch } from '@/shared/ui/switch'
import { Textarea } from '@/shared/ui/textarea'
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
import { Check, CaretUpDown, Lock } from '@phosphor-icons/react'
import { cn, handleEnterToTab } from '@/shared/lib/utils'
import { type Product } from '@/modules/products/domain/product.types'
import { ImageCarousel } from '@/shared/ui/image-carousel'
import { useRole } from '@/shared/context/role-context'

export function ViewProductModal({
  product,
  isOpen,
  onClose,
  onSave,
}: {
  product: Product | null
  isOpen: boolean
  onClose: () => void
  onSave?: (product: Product) => void
}) {
  const { role } = useRole()
  
  const [customerOpen, setCustomerOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState('')

  // Fetched data from API
  const [customers, setCustomers] = useState<{ value: string; label: string }[]>([])
  const [grades, setGrades] = useState<{ id: string; code: string; name: string }[]>([])

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [weight, setWeight] = useState<string>('')
  
  const [gradeOpen, setGradeOpen] = useState(false)
  const [selectedGrade, setSelectedGrade] = useState('')
  
  const [ratePerKgToggle, setRatePerKgToggle] = useState(true)
  const [ratePerKg, setRatePerKg] = useState<string>('')
  const [manualUnitPrice, setManualUnitPrice] = useState<string>('')
  
  const [remarks, setRemarks] = useState('')
  const [images, setImages] = useState<string[]>([])

  const [linkedPattern, setLinkedPattern] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    fetch('/api/customers').then(r => r.json()).then(data => setCustomers(data)).catch(() => {})
    fetch('/api/grades').then(r => r.json()).then(data => setGrades(data)).catch(() => {})
  }, [isOpen])

  useEffect(() => {
    if (product && isOpen) {
      setCode(product.code || '')
      setName(product.name || '')
      setWeight(product.weight?.replace(' kg', '') || '')
      
      const c = customers.find(x => x.label === product.customer)
      setSelectedCustomer(c?.value || '')

      setSelectedGrade(product.grade || '')
      setRemarks(product.remarks || '')
      setImages(product.images || [])

      if (product.ratePerKg !== undefined) {
        setRatePerKgToggle(true)
        setRatePerKg(product.ratePerKg.toString())
        setManualUnitPrice('')
      } else {
        setRatePerKgToggle(false)
        setRatePerKg('')
        setManualUnitPrice(product.unitPrice?.toString() || '')
      }

      // Fetch linked pattern from DB
      fetch('/api/patterns')
        .then(res => res.json())
        .then(patterns => {
          const matched = patterns.find((p: any) => 
            p.mappedProducts?.some((mp: any) => mp.name === product.name)
          )
          setLinkedPattern(matched ? `${matched.code} - ${matched.name}` : null)
        })
        .catch(err => console.error("Failed to load linked patterns", err))
    }
  }, [product, isOpen])

  // Auto-calculated Unit Price when toggle is ON
  const calculatedUnitPrice = useMemo(() => {
    const w = Number(weight)
    const r = Number(ratePerKg)
    if (w > 0 && r > 0) {
      return (w * r).toFixed(2)
    }
    return '0.00'
  }, [weight, ratePerKg])

  const handleSaveClick = () => {
    if (!product || !code.trim() || !name.trim() || !onSave) return

    const customerLabel = customers.find(c => c.value === selectedCustomer)?.label || ''
    const w = Number(weight) || 0

    onSave({
      ...product,
      code: code.trim(),
      name: name.trim(),
      customer: customerLabel,
      grade: selectedGrade || undefined,
      weight: w > 0 ? `${w} kg` : '-',
      ratePerKg: ratePerKgToggle ? (Number(ratePerKg) || undefined) : undefined,
      unitPrice: ratePerKgToggle ? Number(calculatedUnitPrice) : (Number(manualUnitPrice) || undefined),
      remarks: remarks.trim() || undefined,
      images: images.length > 0 ? images : undefined,
    })
  }

  if (!product) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="w-full sm:max-w-4xl bg-[#F4F6FB] border-[#E0E7FF] text-foreground max-h-[90vh] overflow-hidden flex flex-col"
        onKeyDown={handleEnterToTab}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-2xl font-bold font-heading text-[#172554]">
            Edit Product
          </DialogTitle>
          <p className="text-sm text-[#94A3B8] mt-1">Manage details for {product.code}</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          <div className="grid gap-6 py-2">
            {/* Row 1: Product Code | Product Name */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="product-code" className="text-[#64748B] text-xs font-semibold uppercase tracking-wider">Product Code</Label>
                <Input id="product-code" placeholder="e.g. PRD-0512" value={code} onChange={e => setCode(e.target.value)} className="h-12 px-4 rounded-lg bg-[#FFFFFF] border-[#E0E7FF] text-[#172554] text-[15px]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-name" className="text-[#64748B] text-xs font-semibold uppercase tracking-wider">Product Name</Label>
                <Input id="product-name" placeholder="e.g. Pump Housing" value={name} onChange={e => setName(e.target.value)} className="h-12 px-4 rounded-lg bg-[#FFFFFF] border-[#E0E7FF] text-[#172554] text-[15px]" />
              </div>
            </div>

            {/* Row 2: Customer | Grade */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[#64748B] text-xs font-semibold uppercase tracking-wider">Customer</Label>
                <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                  <PopoverTrigger
                    className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-[#172554] bg-[#EEF2FF] hover:bg-[#EEF2FF] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4F46E5] transition-colors"
                    aria-expanded={customerOpen}
                  >
                  {selectedCustomer
                    ? customers.find((c) => c.value === selectedCustomer)?.label
                    : 'Select customer...'}
                  <CaretUpDown weight="duotone" className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0 bg-[#FFFFFF] border-[#E0E7FF]">
                  <Command className="bg-transparent">
                    <CommandInput placeholder="Search customer..." className="text-[#172554]" />
                    <CommandList>
                      <CommandEmpty className="text-[#64748B] p-4 text-center text-sm">No customer found.</CommandEmpty>
                      <CommandGroup>
                        {customers.map((customer) => (
                          <CommandItem
                            key={customer.value}
                            value={customer.value}
                            keywords={[customer.label]}
                            onSelect={(currentValue) => {
                              setSelectedCustomer(currentValue === selectedCustomer ? '' : currentValue)
                              setCustomerOpen(false)
                            }}
                            className="text-[#172554] hover:bg-[#EEF2FF] cursor-pointer"
                          >
                            <Check weight="duotone"
                              className={cn(
                                'mr-2 h-4 w-4',
                                selectedCustomer === customer.value ? 'opacity-100 text-[#4F46E5]' : 'opacity-0'
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
              <div className="space-y-2">
                <Label className="text-[#64748B] text-xs font-semibold uppercase tracking-wider">Grade</Label>
                <Popover open={gradeOpen} onOpenChange={setGradeOpen}>
                  <PopoverTrigger
                    className={cn(
                      "flex h-12 w-full items-center justify-between rounded-lg border border-[#E0E7FF] bg-[#FFFFFF] px-4 py-2 text-[15px] text-[#172554] hover:bg-[#EEF2FF]"
                    )}
                    aria-expanded={gradeOpen}
                  >
                  {selectedGrade
                    ? grades.find((g) => g.code === selectedGrade)?.code
                    : 'Select grade...'}
                  <CaretUpDown weight="duotone" className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0 bg-[#FFFFFF] border-[#E0E7FF]">
                  <Command className="bg-transparent">
                    <CommandInput placeholder="Search grade..." className="text-[#172554]" />
                    <CommandList>
                      <CommandEmpty className="text-[#64748B] p-4 text-center text-sm">No grade found.</CommandEmpty>
                      <CommandGroup>
                        {grades.map((grade) => (
                          <CommandItem
                            key={grade.code}
                            value={grade.code}
                            keywords={[grade.name]}
                            onSelect={(currentValue) => {
                              setSelectedGrade(currentValue === selectedGrade ? '' : currentValue)
                              setGradeOpen(false)
                            }}
                            className="text-[#172554] hover:bg-[#EEF2FF] cursor-pointer"
                          >
                            <Check weight="duotone"
                              className={cn(
                                'mr-2 h-4 w-4',
                                selectedGrade === grade.code ? 'opacity-100 text-[#4F46E5]' : 'opacity-0'
                              )}
                            />
                            {grade.code} - {grade.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              </div>
            </div>

            {/* Row 3: Weight (kg) | Remarks */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="product-weight" className="text-[#64748B] text-xs font-semibold uppercase tracking-wider">Weight (kg)</Label>
                <Input
                  id="product-weight"
                  type="number"
                  min="0"
                  placeholder="0.0"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="h-12 px-4 rounded-lg bg-[#FFFFFF] border-[#E0E7FF] text-[#172554] text-[15px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-remarks" className="text-[#64748B] text-xs font-semibold uppercase tracking-wider">Remarks</Label>
                <Textarea
                  id="product-remarks"
                  placeholder="Add any additional notes..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="min-h-[48px] h-12 py-3 px-4 rounded-lg bg-[#FFFFFF] border-[#E0E7FF] text-[#172554] text-[15px] resize-none"
                />
              </div>
            </div>

            {/* Row 4: Rate per kg Toggle & Pricing logic */}
            <div className="grid grid-cols-2 gap-6 items-end bg-[#FFFFFF]/40 p-5 rounded-xl border border-[#E0E7FF]">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-[#64748B] text-xs font-semibold uppercase tracking-wider">Rate per kg</Label>
                <Switch
                  checked={ratePerKgToggle}
                  onCheckedChange={setRatePerKgToggle}
                  className="data-[state=checked]:bg-[#4F46E5]"
                />
              </div>
              
              <div className="space-y-2">
                <Input
                    type="number"
                    min="0"
                    placeholder="Rate e.g. 150"
                    value={ratePerKg}
                    onChange={(e) => setRatePerKg(e.target.value)}
                    disabled={!ratePerKgToggle}
                    className="h-12 px-4 rounded-lg bg-[#FFFFFF] border-[#E0E7FF] text-[#172554] text-[15px] disabled:opacity-50 disabled:cursor-not-allowed"
                  />
              </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[#64748B] text-xs font-semibold uppercase tracking-wider">Unit Price</Label>
                {ratePerKgToggle ? (
                  <div className="h-12 px-4 flex items-center bg-[#EEF2FF]/50 border border-[#E0E7FF] rounded-lg text-[#0F172A] font-mono text-[15px]">
                    {calculatedUnitPrice}
                  </div>
                ) : (
                  <Input
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={manualUnitPrice}
                    onChange={(e) => setManualUnitPrice(e.target.value)}
                    className="h-12 px-4 rounded-lg bg-[#FFFFFF] border-[#E0E7FF] text-[#172554] text-[15px]"
                  />
                )}
              </div>
            </div>

            {/* Row 5: Linked Pattern (Read-only) */}
            <div className="space-y-2">
              <Label className="text-[#64748B] text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                Linked Pattern <Lock className="w-3 h-3" />
              </Label>
              <div className="h-12 px-4 flex items-center bg-[#EEF2FF]/30 border border-[#E0E7FF] rounded-lg text-[#64748B] text-[15px] cursor-not-allowed">
                {linkedPattern ? linkedPattern : 'No pattern linked yet'}
              </div>
            </div>

            {/* Row 6: Product Image */}
            <div className="space-y-2 pb-2 mt-4">
              <Label className="text-[#64748B] text-xs font-semibold uppercase tracking-wider mb-2 block">Product Images</Label>
              <ImageCarousel 
                images={images} 
                onImagesChange={setImages}
                size="small"
                disabled={false}
                previewPosition="right"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-2 shrink-0 border-t border-[#E0E7FF] pt-4">
          <Button variant="ghost" onClick={onClose} className="text-[#64748B] hover:text-[#172554] hover:bg-[#EEF2FF]">
            Close
          </Button>
          {onSave && (
            <Button onClick={handleSaveClick} disabled={!code.trim() || !name.trim()} className="bg-[#4F46E5] hover:bg-[#4F46E5] text-white disabled:opacity-50">
              Save Changes
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
