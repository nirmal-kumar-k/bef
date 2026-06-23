'use client'

import { useState, useMemo } from 'react'
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
import { Switch } from '@/components/ui/switch'
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
import { Check, CaretUpDown } from '@phosphor-icons/react'
import { cn, handleEnterToTab } from '@/lib/utils'

// Mock Customers
const customers = [
  { value: 'alpha', label: 'Alpha Heavy Industries' },
  { value: 'beta', label: 'Beta Metalworks' },
  { value: 'gamma', label: 'Gamma Components' },
  { value: 'delta', label: 'Delta Forge' },
]

export function NewProductModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const [customerOpen, setCustomerOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState('')

  const [weight, setWeight] = useState<number | ''>('')
  const [ratePerKgToggle, setRatePerKgToggle] = useState(false)
  const [ratePerKg, setRatePerKg] = useState<number | ''>('')
  const [manualUnitPrice, setManualUnitPrice] = useState<number | ''>('')

  // Auto-calculated Unit Price when toggle is ON
  const calculatedUnitPrice = useMemo(() => {
    if (typeof weight === 'number' && typeof ratePerKg === 'number') {
      return (weight * ratePerKg).toFixed(2)
    }
    return '0.00'
  }, [weight, ratePerKg])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="w-full sm:max-w-4xl bg-[#050810] border-[#243050] text-foreground max-h-[90vh] overflow-hidden flex flex-col"
        onKeyDown={handleEnterToTab}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-2xl font-bold font-heading text-[#EEF3FF]">
            Add Product
          </DialogTitle>
          <p className="text-sm text-[#5A6E90] mt-1">Link product to a customer with weight details</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          <div className="grid gap-6 py-2">
            {/* Row 1: Product Code | Product Name */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="product-code" className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Product Code</Label>
                <Input id="product-code" placeholder="e.g. PRD-0512" className="h-12 px-4 rounded-lg bg-[#0C1221] border-[#243050] text-[#EEF3FF] text-[15px]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-name" className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Product Name</Label>
                <Input id="product-name" placeholder="e.g. Pump Housing" className="h-12 px-4 rounded-lg bg-[#0C1221] border-[#243050] text-[#EEF3FF] text-[15px]" />
              </div>
            </div>

            {/* Row 2: Customer | Weight (kg) */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Customer</Label>
                <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                  <PopoverTrigger
                    className="flex h-12 w-full items-center justify-between rounded-lg border border-[#243050] bg-[#0C1221] px-4 py-2 text-[15px] text-[#EEF3FF] hover:bg-[#1A263D]"
                    aria-expanded={customerOpen}
                  >
                  {selectedCustomer
                    ? customers.find((c) => c.value === selectedCustomer)?.label
                    : 'Select customer...'}
                  <CaretUpDown weight="duotone" className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0 bg-[#0C1221] border-[#243050]">
                  <Command className="bg-transparent">
                    <CommandInput placeholder="Search customer..." className="text-[#EEF3FF]" />
                    <CommandList>
                      <CommandEmpty className="text-[#8B9FC4] p-4 text-center text-sm">No customer found.</CommandEmpty>
                      <CommandGroup>
                        {customers.map((customer) => (
                          <CommandItem
                            key={customer.value}
                            value={customer.value}
                            onSelect={(currentValue) => {
                              setSelectedCustomer(currentValue === selectedCustomer ? '' : currentValue)
                              setCustomerOpen(false)
                            }}
                            className="text-[#EEF3FF] hover:bg-[#1A263D] cursor-pointer"
                          >
                            <Check weight="duotone"
                              className={cn(
                                'mr-2 h-4 w-4',
                                selectedCustomer === customer.value ? 'opacity-100 text-[#EB6824]' : 'opacity-0'
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
                <Label htmlFor="product-weight" className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Weight (kg)</Label>
                <Input
                  id="product-weight"
                  type="number"
                  placeholder="0.0"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value === '' ? '' : Number(e.target.value))}
                  className="h-12 px-4 rounded-lg bg-[#0C1221] border-[#243050] text-[#EEF3FF] text-[15px]"
                />
              </div>
            </div>

            {/* Row 3: Rate per kg Toggle & Pricing logic */}
            <div className="grid grid-cols-2 gap-6 items-end bg-[#0C1221]/40 p-5 rounded-xl border border-[#243050]">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Rate per kg</Label>
                <Switch
                  checked={ratePerKgToggle}
                  onCheckedChange={setRatePerKgToggle}
                  className="data-[state=checked]:bg-[#D4521A]"
                />
              </div>
              
              {ratePerKgToggle && (
                <div className="space-y-2">
                  <Input
                      type="number"
                      placeholder="Rate e.g. 150"
                      value={ratePerKg}
                      onChange={(e) => setRatePerKg(e.target.value === '' ? '' : Number(e.target.value))}
                      className="h-12 px-4 rounded-lg bg-[#0C1221] border-[#243050] text-[#EEF3FF] text-[15px]"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Unit Price</Label>
                {ratePerKgToggle ? (
                  <div className="h-12 px-4 flex items-center bg-[#1A263D]/50 border border-[#243050] rounded-lg text-[#C4D2EE] font-mono text-[15px]">
                    {calculatedUnitPrice}
                  </div>
                ) : (
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={manualUnitPrice}
                    onChange={(e) => setManualUnitPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="h-12 px-4 rounded-lg bg-[#0C1221] border-[#243050] text-[#EEF3FF] text-[15px]"
                  />
                )}
              </div>
            </div>

            {/* Row 4: Product Image */}
            <div className="space-y-2 pb-2">
              <Label className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Product Image</Label>
              <div className="relative flex items-center h-12 px-2 rounded-lg bg-[#0C1221] border border-[#243050] group focus-within:ring-1 focus-within:ring-[#D4521A]">
                <input
                  type="file"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="bg-[#D4521A] text-white text-sm font-semibold px-4 py-1.5 rounded-md mr-4 group-hover:bg-[#EB6824] transition-colors relative z-0 pointer-events-none">
                  Choose File
                </div>
                <span className="text-[#EEF3FF] text-[15px] relative z-0 pointer-events-none">No file chosen</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-2 shrink-0 border-t border-[#243050] pt-4">
          <Button variant="ghost" onClick={onClose} className="text-[#8B9FC4] hover:text-[#EEF3FF] hover:bg-[#1C2840]">
            Cancel
          </Button>
          <Button className="bg-[#D4521A] hover:bg-[#EB6824] text-white">
            Save Product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
