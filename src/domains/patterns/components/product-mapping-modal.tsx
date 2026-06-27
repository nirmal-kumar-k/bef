'use client'

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
import { Check, CaretUpDown, Plus, Trash, X } from '@phosphor-icons/react'
import { ConfirmDeleteDialog } from '@/shared/ui/confirm-delete-dialog'
import { cn, handleEnterToTab } from '@/shared/lib/utils'


interface CoreBoxEntry {
  coreBoxCode: string
  quantity: number | string
}

interface MappingLine {
  id: number
  productCode: string
  selectedProductId: string
  cavities: string
  // Replaces old coreBoxesCount — array of {coreBoxCode, quantity}
  selectedCoreBoxes: CoreBoxEntry[]
}

export function ProductMappingModal({
  isOpen,
  onClose,
  patternId,
  onSave,
  initialMappedProducts,
  coreBoxes = [],
}: {
  isOpen: boolean
  onClose: () => void
  patternId: string | null
  onSave?: (mappedProducts: any[]) => void
  initialMappedProducts?: any[]
  coreBoxes?: { id: string; code: string; owner: string }[]
}) {
  const [lines, setLines] = useState<MappingLine[]>([
    { id: 1, productCode: '', selectedProductId: '', cavities: '', selectedCoreBoxes: [] }
  ])
  const [itemToDelete, setItemToDelete] = useState<number | null>(null)

  // Fetched data
  const [products, setProducts] = useState<any[]>([])

  useEffect(() => {
    if (!isOpen) return
    fetch('/api/products').then(r => r.json()).then(data => setProducts(data)).catch(() => {})
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    if (initialMappedProducts && initialMappedProducts.length > 0 && products.length > 0) {
      setLines(initialMappedProducts.map((mp, idx) => {
        const matchedProd = products.find(p => p.name === mp.name)
        return {
          id: Date.now() + idx,
          productCode: matchedProd ? matchedProd.code : '',
          selectedProductId: matchedProd ? matchedProd.id : '',
          cavities: String(mp.cavities || ''),
          selectedCoreBoxes: mp.selectedCoreBoxes || []
        }
      }))
    } else if (products.length > 0) {
      setLines([{ id: Date.now(), productCode: '', selectedProductId: '', cavities: '', selectedCoreBoxes: [] }])
    }
  }, [isOpen, initialMappedProducts, products])

  const handleProductCodeChange = (lineId: number, code: string) => {
    const matchedProduct = products.find(p => p.code.toLowerCase() === code.toLowerCase())
    setLines(prev => prev.map(line => {
      if (line.id === lineId) {
        return { ...line, productCode: code, selectedProductId: matchedProduct ? matchedProduct.id : '' }
      }
      return line
    }))
  }

  const handleProductSelect = (lineId: number, productId: string) => {
    const matchedProduct = products.find(p => p.id === productId)
    setLines(prev => prev.map(line => {
      if (line.id === lineId) {
        return { ...line, selectedProductId: productId, productCode: matchedProduct ? matchedProduct.code : '' }
      }
      return line
    }))
  }

  const addLine = () => {
    setLines([...lines, { id: Date.now(), productCode: '', selectedProductId: '', cavities: '', selectedCoreBoxes: [] }])
  }

  const removeLine = (id: number) => {
    if (lines.length > 1) {
      setLines(lines.filter(l => l.id !== id))
    }
  }

  const updateCavities = (id: number, val: string) => {
    setLines(lines.map(l => l.id === id ? { ...l, cavities: val } : l))
  }

  // Toggle a core box on/off for a line; adds with qty=1 or removes it
  const toggleCoreBox = (lineId: number, coreBoxCode: string) => {
    setLines(lines.map(l => {
      if (l.id !== lineId) return l
      const exists = l.selectedCoreBoxes.find(cb => cb.coreBoxCode === coreBoxCode)
      if (exists) {
        return { ...l, selectedCoreBoxes: l.selectedCoreBoxes.filter(cb => cb.coreBoxCode !== coreBoxCode) }
      } else {
        return { ...l, selectedCoreBoxes: [...l.selectedCoreBoxes, { coreBoxCode, quantity: 1 }] }
      }
    }))
  }

  // Update quantity for a specific core box within a line
  const updateCoreBoxQty = (lineId: number, coreBoxCode: string, qty: number | string) => {
    setLines(lines.map(l => {
      if (l.id !== lineId) return l
      return {
        ...l,
        selectedCoreBoxes: l.selectedCoreBoxes.map(cb =>
          cb.coreBoxCode === coreBoxCode ? { ...cb, quantity: qty } : cb
        )
      }
    }))
  }

  const handleSave = () => {
    if (!onSave) return
    const mappedProducts = lines
      .filter(l => l.selectedProductId)
      .map(l => {
        const prod = products.find(p => p.id === l.selectedProductId)
        return {
          name: prod ? prod.name : l.productCode,
          cavities: Number(l.cavities) || 1,
          selectedCoreBoxes: l.selectedCoreBoxes.map(cb => ({
            coreBoxCode: cb.coreBoxCode,
            quantity: typeof cb.quantity === 'number' ? cb.quantity : (Number(cb.quantity) || 1)
          }))
        }
      })
    onSave(mappedProducts)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="w-full sm:max-w-4xl bg-[#050810] border-[#243050] text-foreground max-h-[90vh] overflow-y-auto"
        onKeyDown={handleEnterToTab}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-heading text-[#EEF3FF]">
            Pattern Product Mapping
          </DialogTitle>
          <p className="text-sm text-[#8B9FC4] mt-1">
            Map products to this pattern and set cavity count per product.
          </p>
        </DialogHeader>

        <div className="py-4 space-y-6">
          <div className="bg-[#0C1221]/50 border border-[#243050] rounded-lg p-4">
            <h3 className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider mb-2">Pattern Info</h3>
            <div className="flex gap-8">
              <div>
                <span className="text-[#5A6E90] text-sm">Code:</span>
                <span className="ml-2 text-[#D4521A] font-mono font-medium">P-{patternId || 'XXXX'}</span>
              </div>
              <div>
                <span className="text-[#5A6E90] text-sm">Name:</span>
                <span className="ml-2 text-[#EEF3FF]">Pump Housing B</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider border-b border-[#243050] pb-2">Mapped Products</h3>
            
            {lines.map((line, index) => (
              <div key={line.id} className="space-y-3 bg-[#0C1221] p-4 rounded-lg border border-[#243050]">
                {/* Row 1: Product Code | Product | Cavities | Delete */}
                <div className="grid grid-cols-12 gap-4 items-end">
                  {/* Product Code Input */}
                  <div className="col-span-3 space-y-2">
                    <Label className="text-[#8B9FC4]">Product Code</Label>
                    <Input 
                      placeholder="e.g. PRD-0512" 
                      value={line.productCode}
                      onChange={(e) => handleProductCodeChange(line.id, e.target.value)}
                      className="h-10 w-full bg-[#050810] border-[#243050] text-[#EEF3FF]"
                    />
                  </div>

                  {/* Product Combobox */}
                  <div className="col-span-5 space-y-2">
                    <Label className="text-[#8B9FC4]">Product</Label>
                    <ProductCombobox 
                      products={products}
                      selectedId={line.selectedProductId}
                      onSelect={(id) => handleProductSelect(line.id, id)}
                    />
                  </div>

                  {/* Cavities */}
                  <div className="col-span-3 space-y-2">
                    <Label className="text-[#8B9FC4]">Cavities</Label>
                    <Input 
                      type="number" 
                      min="0"
                      placeholder="Count" 
                      value={line.cavities}
                      onChange={(e) => updateCavities(line.id, e.target.value)}
                      className="h-10 w-full bg-[#050810] border-[#243050] text-[#EEF3FF]"
                    />
                  </div>

                  {/* Remove Line */}
                  <div className="col-span-1 pb-1 flex justify-end">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setItemToDelete(line.id)}
                      disabled={lines.length === 1}
                      className="text-[#5A6E90] hover:text-red-400 hover:bg-red-400/10"
                    >
                      <Trash weight="duotone" className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Row 2: Core Box multi-select + per-box quantity */}
                <div className="space-y-2 pt-1 border-t border-[#243050]">
                  <div className="flex items-center justify-between">
                    <Label className="text-[#8B9FC4] text-xs">Core Boxes</Label>
                    {coreBoxes.length === 0 && (
                      <span className="text-[11px] text-[#5A6E90] italic">No core boxes defined on this pattern</span>
                    )}
                  </div>

                  {coreBoxes.length > 0 && (
                    <CoreBoxMultiSelect
                      coreBoxes={coreBoxes}
                      selected={line.selectedCoreBoxes}
                      onToggle={(code) => toggleCoreBox(line.id, code)}
                      onQtyChange={(code, qty) => updateCoreBoxQty(line.id, code, qty)}
                    />
                  )}
                </div>
              </div>
            ))}

            <Button 
              variant="outline" 
              onClick={addLine}
              className="mt-4 bg-transparent border-[#243050] text-[#8B9FC4] hover:text-[#EEF3FF] hover:bg-[#1C2840] hover:border-[#2E3C5C] transition-colors"
            >
              <Plus weight="bold" className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          </div>
        </div>

        <DialogFooter className="mt-4 pt-4 border-t border-[#243050]">
          <Button variant="ghost" onClick={onClose} className="text-[#8B9FC4] hover:text-[#EEF3FF] hover:bg-[#1C2840]">
            Cancel
          </Button>
          <Button className="bg-[#D4521A] hover:bg-[#D4521A] text-white" onClick={handleSave}>
            Save Mapping
          </Button>
        </DialogFooter>
      </DialogContent>
      <ConfirmDeleteDialog 
        open={!!itemToDelete} 
        onOpenChange={(open) => !open && setItemToDelete(null)}
        onConfirm={() => {
          if (itemToDelete) removeLine(itemToDelete)
        }}
        title="Remove Mapping?"
        description="Are you sure you want to remove this product mapping?"
      />
    </Dialog>
  )
}

// ─── Core Box Multi-Select + Per-box Qty ─────────────────────────────────────

function CoreBoxMultiSelect({
  coreBoxes,
  selected,
  onToggle,
  onQtyChange,
}: {
  coreBoxes: { id: string; code: string; owner: string }[]
  selected: CoreBoxEntry[]
  onToggle: (code: string) => void
  onQtyChange: (code: string, qty: number | string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-2">
      {/* Dropdown trigger */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="flex h-10 w-full items-center justify-between rounded-md border border-[#243050] bg-[#050810] px-3 py-2 text-sm text-[#EEF3FF] hover:bg-[#1A263D]">
          <span className="text-[#8B9FC4]">
            {selected.length === 0
              ? 'Select core boxes...'
              : `${selected.length} core box${selected.length > 1 ? 'es' : ''} selected`}
          </span>
          <CaretUpDown weight="duotone" className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0 bg-[#0C1221] border-[#243050]">
          <Command className="bg-transparent">
            <CommandInput placeholder="Search core boxes..." className="text-[#EEF3FF]" />
            <CommandList>
              <CommandEmpty className="text-[#8B9FC4] p-4 text-center text-sm">No core boxes found.</CommandEmpty>
              <CommandGroup>
                {coreBoxes.map((cb) => {
                  const isSelected = selected.some(s => s.coreBoxCode === cb.code)
                  return (
                    <CommandItem
                      key={cb.id}
                      value={cb.code}
                      onSelect={() => onToggle(cb.code)}
                      className="text-[#EEF3FF] hover:bg-[#1A263D] cursor-pointer"
                    >
                      <Check
                        weight="duotone"
                        className={cn('mr-2 h-4 w-4 flex-shrink-0', isSelected ? 'opacity-100 text-[#D4521A]' : 'opacity-0')}
                      />
                      <span className="font-mono text-[#D4521A] mr-2">{cb.code}</span>
                      <span className="text-[#8B9FC4] text-xs ml-auto">{cb.owner}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Per-box quantity inputs */}
      {selected.length > 0 && (
        <div className="space-y-2 mt-3">
          {selected.map((s) => (
            <div key={s.coreBoxCode} className="flex items-center gap-4 bg-[#050810]/50 border border-[#243050]/50 rounded-lg p-3">
              <div className="flex-1">
                <span className="text-[#8B9FC4] text-[11px] font-semibold uppercase tracking-wider block mb-1">Core Box</span>
                <span className="font-mono text-[#D4521A] text-sm font-medium">{s.coreBoxCode}</span>
              </div>
              <div className="w-32">
                <Label className="text-[#8B9FC4] text-[11px] font-semibold uppercase tracking-wider block mb-1">Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  value={s.quantity}
                  onChange={(e) => onQtyChange(s.coreBoxCode, e.target.value === '' ? '' : Number(e.target.value))}
                  className="h-9 w-full bg-[#0C1221] border-[#243050] text-[#EEF3FF]"
                />
              </div>
              <div className="pt-5">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onToggle(s.coreBoxCode)}
                  className="h-9 w-9 text-[#5A6E90] hover:text-red-400 hover:bg-red-400/10"
                >
                  <Trash weight="duotone" className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Product Combobox ─────────────────────────────────────────────────────────

function ProductCombobox({ 
  products,
  selectedId, 
  onSelect
}: { 
  products: any[],
  selectedId: string, 
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)

  const selectedProduct = products.find(p => p.id === selectedId)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="flex h-10 w-full items-center justify-between rounded-md border border-[#243050] bg-[#050810] px-3 py-2 text-sm text-[#EEF3FF] hover:bg-[#1A263D]"
        aria-expanded={open}
      >
        <span className="truncate">
          {selectedProduct ? `${selectedProduct.code} — ${selectedProduct.name}` : 'Select product...'}
        </span>
        <CaretUpDown weight="duotone" className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0 bg-[#0C1221] border-[#243050]">
        <Command className="bg-transparent">
          <CommandInput placeholder="Search products..." className="text-[#EEF3FF]" />
          <CommandList>
            <CommandEmpty className="text-[#8B9FC4] p-4 text-center text-sm">No product found.</CommandEmpty>
            <CommandGroup>
              {products.map((product) => (
                <CommandItem
                  key={product.id}
                  value={`${product.code} ${product.name}`}
                  onSelect={() => {
                    onSelect(product.id)
                    setOpen(false)
                  }}
                  className="text-[#EEF3FF] hover:bg-[#1A263D] cursor-pointer"
                >
                  <Check weight="duotone"
                    className={cn(
                      'mr-2 h-4 w-4 flex-shrink-0',
                      selectedId === product.id ? 'opacity-100 text-[#D4521A]' : 'opacity-0'
                    )}
                  />
                  <span className="font-mono text-[#D4521A] mr-2">{product.code}</span>
                  {product.name}
                  <span className="ml-auto text-[#5A6E90] text-xs">{product.weight}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
