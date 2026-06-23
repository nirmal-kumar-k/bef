'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Check, ChevronsUpDown, Plus, Trash2 } from 'lucide-react'
import { cn, handleEnterToTab } from '@/lib/utils'

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
    { id: 1, productCode: '', selectedProductId: '', cavities: '' }
  ])

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
    setLines([...lines, { id: Date.now(), productCode: '', selectedProductId: '', cavities: '' }])
  }

  const removeLine = (id: number) => {
    if (lines.length > 1) {
      setLines(lines.filter(l => l.id !== id))
    }
  }

  const updateCavities = (id: number, val: string) => {
    setLines(lines.map(l => l.id === id ? { ...l, cavities: val } : l))
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="w-full sm:max-w-4xl bg-[#0B101A] border-[#243050] text-foreground max-h-[90vh] overflow-y-auto"
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
          <div className="bg-[#121A2B]/50 border border-[#243050] rounded-lg p-4">
            <h3 className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider mb-2">Pattern Info</h3>
            <div className="flex gap-8">
              <div>
                <span className="text-[#5A6E90] text-sm">Code:</span>
                <span className="ml-2 text-[#F5712E] font-mono font-medium">P-{patternId || 'XXXX'}</span>
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
              <div key={line.id} className="grid grid-cols-12 gap-4 items-end bg-[#121A2B] p-4 rounded-lg border border-[#243050]">
                {/* Product Code Input */}
                <div className="col-span-3 space-y-2">
                  <Label className="text-[#8B9FC4]">Product Code</Label>
                  <Input 
                    placeholder="e.g. PRD-0512" 
                    value={line.productCode}
                    onChange={(e) => handleProductCodeChange(line.id, e.target.value)}
                    className="bg-[#0B101A] border-[#243050] text-[#EEF3FF]"
                  />
                </div>

                {/* Product Combobox */}
                <div className="col-span-5 space-y-2">
                  <Label className="text-[#8B9FC4]">Product</Label>
                  <ProductCombobox 
                    selectedId={line.selectedProductId}
                    onSelect={(id) => handleProductSelect(line.id, id)}
                    searchFilter={line.productCode}
                  />
                </div>

                {/* Cavities */}
                <div className="col-span-3 space-y-2">
                  <Label className="text-[#8B9FC4]">Cavities</Label>
                  <Input 
                    type="number" 
                    placeholder="Count" 
                    value={line.cavities}
                    onChange={(e) => updateCavities(line.id, e.target.value)}
                    className="bg-[#0B101A] border-[#243050] text-[#EEF3FF]"
                  />
                </div>

                {/* Remove Line */}
                <div className="col-span-1 pb-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => removeLine(line.id)}
                    disabled={lines.length === 1}
                    className="text-[#5A6E90] hover:text-red-400 hover:bg-red-400/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            <Button 
              variant="outline" 
              onClick={addLine}
              className="mt-4 bg-transparent border-[#243050] text-[#8B9FC4] hover:text-[#EEF3FF] hover:bg-[#1C2840] hover:border-[#2E3C5C] transition-colors"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          </div>
        </div>

        <DialogFooter className="mt-4 pt-4 border-t border-[#243050]">
          <Button variant="ghost" onClick={onClose} className="text-[#8B9FC4] hover:text-[#EEF3FF] hover:bg-[#1C2840]">
            Cancel
          </Button>
          <Button className="bg-[#E8581A] hover:bg-[#F5712E] text-white">
            Save Mapping
          </Button>
        </DialogFooter>
      </DialogContent>
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
        className="flex h-10 w-full items-center justify-between rounded-md border border-[#243050] bg-[#0B101A] px-3 py-2 text-sm text-[#EEF3FF] hover:bg-[#1A263D]"
        aria-expanded={open}
      >
        <span className="truncate">
          {selectedProduct ? `${selectedProduct.code} — ${selectedProduct.name}` : 'Select product...'}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0 bg-[#121A2B] border-[#243050]">
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
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 flex-shrink-0',
                      selectedId === product.id ? 'opacity-100 text-[#F5712E]' : 'opacity-0'
                    )}
                  />
                  <span className="font-mono text-[#F5712E] mr-2">{product.code}</span>
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
