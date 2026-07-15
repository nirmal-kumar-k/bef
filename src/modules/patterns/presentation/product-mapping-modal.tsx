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
  coreBoxId: string
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
  isSaving,
  initialMappedProducts,
  coreBoxes = [],
}: {
  isOpen: boolean
  onClose: () => void
  patternId: string | null
  onSave?: (mappedProducts: any[]) => void
  isSaving?: boolean
  initialMappedProducts?: any[]
  coreBoxes?: { id: string; code: string; owner: string; typeOfCore?: string; coreWeight?: number }[]
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
          selectedCoreBoxes: (mp.selectedCoreBoxes || []).map((cb: any) => {
            if (cb.coreBoxId) return cb
            // Fallback for old data: find matching core box from the pattern
            const match = coreBoxes.find(c => c.code === cb.coreBoxCode)
            return { ...cb, coreBoxId: match ? match.id : cb.coreBoxCode }
          })
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
  const toggleCoreBox = (lineId: number, coreBoxId: string, coreBoxCode: string) => {
    setLines(lines.map(l => {
      if (l.id !== lineId) return l
      const exists = l.selectedCoreBoxes.some(cb => cb.coreBoxId === coreBoxId)
      if (exists) {
        return { ...l, selectedCoreBoxes: l.selectedCoreBoxes.filter(cb => cb.coreBoxId !== coreBoxId) }
      } else {
        return { ...l, selectedCoreBoxes: [...l.selectedCoreBoxes, { coreBoxId, coreBoxCode, quantity: 1 }] }
      }
    }))
  }

  // Update quantity for a specific core box within a line
  const updateCoreBoxQty = (lineId: number, coreBoxId: string, coreBoxCode: string, qty: number | string) => {
    setLines(lines.map(l => {
      if (l.id !== lineId) return l
      return {
        ...l,
        selectedCoreBoxes: l.selectedCoreBoxes.map(cb =>
          (cb.coreBoxId === coreBoxId) ? { ...cb, quantity: qty } : cb
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
            coreBoxId: cb.coreBoxId,
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
        className="w-full sm:max-w-4xl bg-[#F4F6FB] border-[#E0E7FF] text-foreground max-h-[90vh] overflow-y-auto"
        onKeyDown={handleEnterToTab}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-heading text-[#172554]">
            Pattern Product Mapping
          </DialogTitle>
          <p className="text-sm text-[#64748B] mt-1">
            Map products to this pattern and set cavity count per product.
          </p>
        </DialogHeader>

        <div className="py-4 space-y-6">
          <div className="bg-[#FFFFFF]/50 border border-[#E0E7FF] rounded-lg p-4">
            <h3 className="text-[#64748B] text-xs font-semibold uppercase tracking-wider mb-2">Pattern Info</h3>
            <div className="flex gap-8">
              <div>
                <span className="text-[#94A3B8] text-sm">Code:</span>
                <span className="ml-2 text-[#4F46E5] font-mono font-medium">P-{patternId || 'XXXX'}</span>
              </div>
              <div>
                <span className="text-[#94A3B8] text-sm">Name:</span>
                <span className="ml-2 text-[#172554]">Pump Housing B</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#94A3B8] text-sm">Core Boxes:</span>
                <div className="flex flex-wrap gap-1">
                  {coreBoxes && coreBoxes.length > 0 ? coreBoxes.map(cb => (
                    <span key={cb.id || cb.code} className="px-2 py-0.5 bg-[#EEF2FF] text-[#4F46E5] text-xs font-semibold rounded-md border border-[#C7D2FE]">
                      {cb.code || 'Unnamed'}
                    </span>
                  )) : (
                    <span className="text-[#172554] text-sm font-medium">None</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-[#64748B] text-xs font-semibold uppercase tracking-wider border-b border-[#E0E7FF] pb-2">Mapped Products</h3>
            
            {lines.map((line, index) => (
              <div key={line.id} className="space-y-3 bg-[#FFFFFF] p-4 rounded-lg border border-[#E0E7FF]">
                {/* Row 1: Product Code | Product | Cavities | Delete */}
                <div className="grid grid-cols-12 gap-4 items-end">
                  {/* Product Code Input */}
                  <div className="col-span-3 space-y-2">
                    <Label className="text-[#64748B]">Product Code</Label>
                    <Input 
                      placeholder="e.g. PRD-0512" 
                      value={line.productCode}
                      onChange={(e) => handleProductCodeChange(line.id, e.target.value)}
                      className="h-10 w-full bg-[#F4F6FB] border-[#E0E7FF] text-[#172554]"
                    />
                  </div>

                  {/* Product Combobox */}
                  <div className="col-span-6 space-y-2">
                    <Label className="text-[#64748B]">Product</Label>
                    <ProductCombobox 
                      products={products}
                      selectedId={line.selectedProductId}
                      onSelect={(id) => handleProductSelect(line.id, id)}
                    />
                  </div>

                  {/* Cavities */}
                  <div className="col-span-2 space-y-2">
                    <Label className="text-[#64748B]">Cavities</Label>
                    <Input 
                      type="number" 
                      min="0"
                      placeholder="Count" 
                      value={line.cavities}
                      onChange={(e) => updateCavities(line.id, e.target.value)}
                      className="h-10 w-full bg-[#F4F6FB] border-[#E0E7FF] text-[#172554]"
                    />
                  </div>

                  {/* Remove Line */}
                  <div className="col-span-1 pb-1 flex justify-end">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setItemToDelete(line.id)}
                      disabled={lines.length === 1}
                      className="text-[#94A3B8] hover:text-red-400 hover:bg-red-400/10"
                    >
                      <Trash weight="duotone" className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Row 2: Core Box multi-select + per-box quantity */}
                {line.selectedProductId && (
                  <div className="space-y-2 pt-3 mt-4 border-t border-[#E0E7FF]">
                    <div className="flex items-center justify-between">
                      <Label className="text-[#172554] text-xs font-bold uppercase tracking-wider">Required Core Boxes</Label>
                      {coreBoxes.length === 0 ? (
                        <span className="text-[11px] text-[#94A3B8] italic">No core boxes defined on this pattern</span>
                      ) : (
                        <span className="text-[11px] text-[#64748B]">Select core boxes needed for this product</span>
                      )}
                    </div>

                    {coreBoxes.length > 0 && (
                      <CoreBoxMultiSelect
                        coreBoxes={coreBoxes}
                        selected={line.selectedCoreBoxes}
                        onToggle={(id, code) => toggleCoreBox(line.id, id, code)}
                        onQtyChange={(id, code, qty) => updateCoreBoxQty(line.id, id, code, qty)}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}

            <Button 
              variant="outline" 
              onClick={addLine}
              className="mt-4 bg-transparent border-[#E0E7FF] text-[#64748B] hover:text-[#172554] hover:bg-[#EEF2FF] hover:border-[#C7D2FE] transition-colors"
            >
              <Plus weight="bold" className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          </div>
        </div>

        <DialogFooter className="mt-4 pt-4 border-t border-[#E0E7FF]">
          <Button variant="ghost" onClick={onClose} className="text-[#64748B] hover:text-[#172554] hover:bg-[#EEF2FF]">
            Cancel
          </Button>
          <Button className="bg-[#4F46E5] hover:bg-[#4F46E5] text-white disabled:opacity-50" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Mapping'}
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
  coreBoxes: { id: string; code: string; owner: string; typeOfCore?: string; coreWeight?: number }[]
  selected: CoreBoxEntry[]
  onToggle: (id: string, code: string) => void
  onQtyChange: (id: string, code: string, qty: number | string) => void
}) {
  return (
    <div className="space-y-2 mt-2">
      {coreBoxes.map((cb, idx) => {
        // Fallback for visual display if code is empty
        const displayCode = cb.code || `CB-${idx + 1}`
        
        const isSelected = selected.some((s) => s.coreBoxId === cb.id)
        const selectedEntry = selected.find((s) => s.coreBoxId === cb.id)

        return (
          <div
            key={cb.id}
            className={cn(
              'flex items-center gap-4 border rounded-lg p-3 transition-colors',
              isSelected
                ? 'bg-[#F4F6FB]/80 border-[#4F46E5]/50'
                : 'bg-[#FFFFFF] border-[#E0E7FF] hover:border-[#C7D2FE]'
            )}
          >
            {/* Custom Checkbox */}
            <button
              type="button"
              onClick={() => onToggle(cb.id, cb.code)}
              className={cn(
                'flex items-center justify-center w-5 h-5 rounded border transition-colors',
                isSelected
                  ? 'bg-[#4F46E5] border-[#4F46E5] text-white'
                  : 'bg-[#F4F6FB] border-[#94A3B8] text-transparent hover:border-[#64748B]'
              )}
            >
              <Check weight="bold" className="w-3.5 h-3.5" />
            </button>

            {/* Core Box Info */}
            <div className="flex-1 cursor-pointer" onClick={() => onToggle(cb.id, cb.code)}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="text-[#64748B] text-[11px] font-semibold uppercase tracking-wider block mb-0.5">
                    Core Box Code
                  </span>
                  <span
                    className={cn(
                      'font-mono text-sm font-medium',
                      isSelected ? 'text-[#4F46E5]' : 'text-[#172554]',
                      !cb.code && 'italic opacity-60'
                    )}
                  >
                    {displayCode}
                  </span>
                </div>
                {/* Core Box Details summary badges */}
                <div className="flex gap-2 text-xs">
                  {cb.owner && (
                    <span className="bg-[#EEF2FF] text-[#64748B] px-2 py-0.5 rounded border border-[#E0E7FF]">
                      {cb.owner}
                    </span>
                  )}
                  {cb.typeOfCore && (
                    <span className="bg-[#EEF2FF] text-[#64748B] px-2 py-0.5 rounded border border-[#E0E7FF]">
                      {cb.typeOfCore}
                    </span>
                  )}
                  {cb.coreWeight != null && (
                    <span className="bg-[#EEF2FF] text-[#64748B] px-2 py-0.5 rounded border border-[#E0E7FF]">
                      {cb.coreWeight} kg
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quantity Input */}
            {isSelected && (
              <div className="w-20">
                <Label className="text-[#64748B] text-[11px] font-semibold uppercase tracking-wider block mb-1 text-center">
                  Quantity
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={selectedEntry?.quantity || ''}
                  onChange={(e) =>
                    onQtyChange(cb.id, cb.code, e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="h-9 w-full bg-[#FFFFFF] border-[#E0E7FF] text-[#172554] focus-visible:ring-1 focus-visible:ring-[#4F46E5] text-center"
                />
              </div>
            )}
          </div>
        )
      })}
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
        className="flex h-10 w-full items-center justify-between rounded-md border border-[#E0E7FF] bg-[#F4F6FB] px-3 py-2 text-sm text-[#172554] hover:bg-[#EEF2FF]"
        aria-expanded={open}
      >
        <span className="truncate">
          {selectedProduct ? `${selectedProduct.code} — ${selectedProduct.name}` : 'Select product...'}
        </span>
        <CaretUpDown weight="duotone" className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0 bg-[#FFFFFF] border-[#E0E7FF]">
        <Command className="bg-transparent">
          <CommandInput placeholder="Search products..." className="text-[#172554]" />
          <CommandList>
            <CommandEmpty className="text-[#64748B] p-4 text-center text-sm">No product found.</CommandEmpty>
            <CommandGroup>
              {products.map((product) => (
                <CommandItem
                  key={product.id}
                  value={`${product.code} ${product.name}`}
                  onSelect={() => {
                    onSelect(product.id)
                    setOpen(false)
                  }}
                  className="text-[#172554] hover:bg-[#EEF2FF] cursor-pointer"
                >
                  <Check weight="duotone"
                    className={cn(
                      'mr-2 h-4 w-4 flex-shrink-0',
                      selectedId === product.id ? 'opacity-100 text-[#4F46E5]' : 'opacity-0'
                    )}
                  />
                  <span className="font-mono text-[#4F46E5] mr-2">{product.code}</span>
                  {product.name}
                  <span className="ml-auto text-[#94A3B8] text-xs">{product.weight}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
