'use client'

import { useState } from 'react'
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
import { Check, CaretUpDown, Plus, Trash } from '@phosphor-icons/react'
import { ConfirmDeleteDialog } from '@/shared/ui/confirm-delete-dialog'
import { cn, handleEnterToTab } from '@/shared/lib/utils'

// Mock products
const products = [
  { id: '1', code: 'PRD-0512', name: 'Pump Housing', weight: '12.4 kg' },
  { id: '2', code: 'PRD-0513', name: 'Valve Body', weight: '8.2 kg' },
  { id: '3', code: 'PRD-0514', name: 'Bearing Housing', weight: '5.6 kg' },
]

export function ProductMappingModal({
  isOpen,
  onClose,
  patternId,
}: {
  isOpen: boolean
  onClose: () => void
  patternId: string | null
}) {
  // State for mapping lines
  const [lines, setLines] = useState([
    { id: 1, productCode: '', selectedProductId: '', cavities: '', coreBoxesCount: '2' }
  ])
  const [itemToDelete, setItemToDelete] = useState<number | null>(null)

  // Function to handle product code typing
  const handleProductCodeChange = (lineId: number, code: string) => {
    const matchedProduct = products.find(p => p.code.toLowerCase() === code.toLowerCase())
    
    setLines(prev => prev.map(line => {
      if (line.id === lineId) {
        return {
          ...line,
          productCode: code,
          selectedProductId: matchedProduct ? matchedProduct.id : ''
        }
      }
      return line
    }))
  }

  // Function to handle dropdown selection
  const handleProductSelect = (lineId: number, productId: string) => {
    const matchedProduct = products.find(p => p.id === productId)
    
    setLines(prev => prev.map(line => {
      if (line.id === lineId) {
        return {
          ...line,
          selectedProductId: productId,
          productCode: matchedProduct ? matchedProduct.code : ''
        }
      }
      return line
    }))
  }

  const addLine = () => {
    setLines([...lines, { id: Date.now(), productCode: '', selectedProductId: '', cavities: '', coreBoxesCount: '2' }])
  }

  const removeLine = (id: number) => {
    if (lines.length > 1) {
      setLines(lines.filter(l => l.id !== id))
    }
  }

  const updateCavities = (id: number, val: string) => {
    setLines(lines.map(l => l.id === id ? { ...l, cavities: val } : l))
  }

  const updateCoreBoxes = (id: number, val: string) => {
    setLines(lines.map(l => l.id === id ? { ...l, coreBoxesCount: val } : l))
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
              <div key={line.id} className="grid grid-cols-12 gap-4 items-end bg-[#0C1221] p-4 rounded-lg border border-[#243050]">
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
                <div className="col-span-4 space-y-2">
                  <Label className="text-[#8B9FC4]">Product</Label>
                  <ProductCombobox 
                    selectedId={line.selectedProductId}
                    onSelect={(id) => handleProductSelect(line.id, id)}
                    searchFilter={line.productCode}
                  />
                </div>

                {/* Cavities */}
                <div className="col-span-2 space-y-2">
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

                {/* Core Boxes */}
                <div className="col-span-2 space-y-2">
                  <Label className="text-[#8B9FC4]">Core Boxes</Label>
                  <Input 
                    type="number" 
                    min="0"
                    placeholder="Count" 
                    value={line.coreBoxesCount}
                    onChange={(e) => updateCoreBoxes(line.id, e.target.value)}
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
          <Button className="bg-[#D4521A] hover:bg-[#D4521A] text-white">
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

function ProductCombobox({ 
  selectedId, 
  onSelect,
  searchFilter
}: { 
  selectedId: string, 
  onSelect: (id: string) => void,
  searchFilter: string
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
          <CommandInput placeholder="Search products..." className="text-[#EEF3FF]" value={searchFilter} />
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
