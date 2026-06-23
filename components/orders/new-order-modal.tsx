'use client'

import { useState, useMemo } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn, handleEnterToTab } from '@/lib/utils'

// Mock Data
const customers = [
  { value: 'alpha', label: 'Alpha Heavy Industries' },
  { value: 'beta', label: 'Beta Metalworks' },
  { value: 'gamma', label: 'Gamma Components' },
]

const patterns = [
  { value: 'PTRN-101', label: 'PTRN-101 (Housing Base)' },
  { value: 'PTRN-102', label: 'PTRN-102 (Valve Body)' },
]

const products: Record<string, { value: string; label: string; weight: number; ratePerKg: number }[]> = {
  'PTRN-101': [
    { value: 'PRD-001', label: 'Housing Assembly A', weight: 12.4, ratePerKg: 15.50 },
    { value: 'PRD-002', label: 'Housing Assembly B', weight: 15.0, ratePerKg: 15.50 },
  ],
  'PTRN-102': [
    { value: 'PRD-003', label: 'Valve Body Core', weight: 8.2, ratePerKg: 18.25 },
  ],
}

interface CartItem {
  id: string
  pattern: string
  product: string
  productName: string
  quantity: number
  weight: number
  ratePerKg: number
}

export function NewOrderModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const [customerOpen, setCustomerOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState('')
  
  // Add item state
  const [selectedPattern, setSelectedPattern] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [quantity, setQuantity] = useState<number | ''>('')
  
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([])

  const handleAddItem = () => {
    if (!selectedPattern || !selectedProduct || !quantity || quantity <= 0) return

    const productDetails = products[selectedPattern]?.find(p => p.value === selectedProduct)
    if (!productDetails) return

    const newItem: CartItem = {
      id: Math.random().toString(36).substr(2, 9),
      pattern: selectedPattern,
      product: selectedProduct,
      productName: productDetails.label,
      quantity: Number(quantity),
      weight: productDetails.weight,
      ratePerKg: productDetails.ratePerKg,
    }

    setCart([...cart, newItem])
    
    // Reset inputs
    setSelectedPattern('')
    setSelectedProduct('')
    setQuantity('')
  }

  const handleRemoveItem = (id: string) => {
    setCart(cart.filter(item => item.id !== id))
  }

  const grandTotal = useMemo(() => {
    return cart.reduce((total, item) => total + (item.weight * item.ratePerKg * item.quantity), 0)
  }, [cart])

  // Extreme speed entry: Enter on Quantity immediately adds the item and refocuses Pattern
  const handleQuantityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation(); // Stop the global handler
      handleAddItem();
      setTimeout(() => {
        document.getElementById('pattern-trigger')?.focus();
      }, 50);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="w-full sm:max-w-[1300px] bg-[#0B101A] border-[#243050] text-foreground max-h-[95vh] overflow-hidden flex flex-col p-0"
        onKeyDown={handleEnterToTab}
      >
        <div className="p-6 pb-4 border-b border-[#243050] shrink-0">
          <DialogTitle className="text-2xl font-bold font-heading text-[#EEF3FF]">
            New Order
          </DialogTitle>
          <p className="text-sm text-[#5A6E90] mt-1">Create a new production order and add line items</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
            
            {/* LEFT SIDE: Order Details (Global) */}
            <div className="lg:col-span-3 space-y-6">
              <div className="space-y-4">
                <h3 className="text-[#8B9FC4] font-semibold uppercase tracking-wider text-sm border-b border-[#243050] pb-2">Order Details</h3>
                
                <div className="space-y-2">
                  <Label className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Customer Order No.</Label>
                  <Input placeholder="e.g. PO-98214" className="h-10 px-3 rounded-md bg-[#121A2B] border-[#243050] text-[#EEF3FF] text-sm" />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Internal Order No.</Label>
                  <Input placeholder="e.g. INT-4412" className="h-10 px-3 rounded-md bg-[#121A2B] border-[#243050] text-[#EEF3FF] text-sm" />
                </div>

                <div className="space-y-2">
                  <Label className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Customer</Label>
                  <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                    <PopoverTrigger
                      className="flex h-10 w-full items-center justify-between rounded-md border border-[#243050] bg-[#121A2B] px-3 py-2 text-sm text-[#EEF3FF] hover:bg-[#1A263D]"
                    >
                    {selectedCustomer
                      ? customers.find((c) => c.value === selectedCustomer)?.label
                      : 'Select customer...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0 bg-[#121A2B] border-[#243050]">
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
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    selectedCustomer === customer.value ? 'opacity-100 text-[#F5712E]' : 'opacity-0'
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
                  <Label className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Order Date</Label>
                  <Input type="date" className="h-10 px-3 rounded-md bg-[#121A2B] border-[#243050] text-[#EEF3FF] text-sm [color-scheme:dark]" />
                </div>

                <div className="space-y-2">
                  <Label className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Delivery Date</Label>
                  <Input type="date" className="h-10 px-3 rounded-md bg-[#121A2B] border-[#243050] text-[#EEF3FF] text-sm [color-scheme:dark]" />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Remarks</Label>
                  <Textarea placeholder="Notes..." className="min-h-[80px] px-3 py-2 rounded-md bg-[#121A2B] border-[#243050] text-[#EEF3FF] text-sm resize-y" />
                </div>
              </div>
            </div>

            {/* RIGHT SIDE: Cart / Line Items */}
            <div className="lg:col-span-9 space-y-6 flex flex-col min-h-[500px]">
              <h3 className="text-[#8B9FC4] font-semibold uppercase tracking-wider text-sm border-b border-[#243050] pb-2">Line Items</h3>
              
              {/* Add Item Form */}
              <div className="flex items-end gap-3 bg-[#121A2B]/50 p-4 rounded-xl border border-[#243050]">
                <div className="flex-[1.5] space-y-2">
                  <Label className="text-[#8B9FC4] text-xs font-semibold uppercase">Pattern</Label>
                  <Select value={selectedPattern} onValueChange={setSelectedPattern}>
                    <SelectTrigger id="pattern-trigger" className="h-10 px-3 rounded-md bg-[#121A2B] border-[#243050] text-[#EEF3FF] text-sm">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#121A2B] border-[#243050] text-[#EEF3FF]">
                      {patterns.map(p => (
                        <SelectItem key={p.value} value={p.value} className="hover:bg-[#1A263D] cursor-pointer">{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-[2] space-y-2">
                  <Label className="text-[#8B9FC4] text-xs font-semibold uppercase">Product</Label>
                  <Select value={selectedProduct} onValueChange={setSelectedProduct} disabled={!selectedPattern}>
                    <SelectTrigger className="h-10 px-3 rounded-md bg-[#121A2B] border-[#243050] text-[#EEF3FF] text-sm disabled:opacity-50">
                      <SelectValue placeholder={selectedPattern ? "Select..." : "Pattern first"} />
                    </SelectTrigger>
                    <SelectContent className="bg-[#121A2B] border-[#243050] text-[#EEF3FF]">
                      {selectedPattern && products[selectedPattern]?.map(p => (
                        <SelectItem key={p.value} value={p.value} className="hover:bg-[#1A263D] cursor-pointer">{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[100px] space-y-2">
                  <Label className="text-[#8B9FC4] text-xs font-semibold uppercase">Quantity</Label>
                  <Input 
                    type="number" 
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                    onKeyDown={handleQuantityKeyDown}
                    placeholder="0" 
                    className="h-10 px-3 rounded-md bg-[#121A2B] border-[#243050] text-[#EEF3FF] text-sm" 
                  />
                </div>
                <Button 
                  onClick={handleAddItem}
                  disabled={!selectedPattern || !selectedProduct || !quantity}
                  className="bg-[#E8581A] hover:bg-[#F5712E] text-white h-10 px-6 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="mr-2 h-4 w-4" /> Add
                </Button>
              </div>

              {/* Cart Table */}
              <div className="flex-1 border border-[#243050] rounded-xl overflow-hidden bg-[#0B101A] flex flex-col">
                <table className="w-full text-sm text-left">
                  <thead className="bg-[#121A2B] border-b border-[#243050] text-[#8B9FC4] text-xs uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-4 py-3 w-[250px]">Product</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3 text-center">Weight</th>
                      <th className="px-4 py-3 text-center">Rate/kg</th>
                      <th className="px-4 py-3 text-right">Unit Cost</th>
                      <th className="px-4 py-3 text-right">Line Total</th>
                      <th className="px-4 py-3 w-[50px]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#243050]">
                    {cart.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-16 text-center">
                          <p className="text-[#5A6E90] text-[15px]">No items added to this order yet.</p>
                          <p className="text-[#5A6E90]/60 text-sm mt-1">Select a pattern and product above to add.</p>
                        </td>
                      </tr>
                    ) : (
                      cart.map((item) => {
                        const unitCost = item.weight * item.ratePerKg
                        const lineTotal = unitCost * item.quantity
                        return (
                          <tr key={item.id} className="hover:bg-[#1A263D]/50 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-medium text-[#EEF3FF] truncate max-w-[220px]">{item.productName}</p>
                              <p className="text-xs font-mono text-[#5A6E90] mt-0.5 truncate max-w-[220px]">{item.pattern}</p>
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-[#EEF3FF]">{item.quantity.toLocaleString()}</td>
                            <td className="px-4 py-3 text-center text-[#8B9FC4]">{item.weight} kg</td>
                            <td className="px-4 py-3 text-center text-[#8B9FC4]">₹{item.ratePerKg.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right text-[#C4D2EE]">₹{unitCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                            <td className="px-4 py-3 text-right font-mono font-medium text-[#F5712E]">₹{lineTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                            <td className="px-4 py-3 text-right">
                              <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} className="h-8 w-8 text-[#5A6E90] hover:text-red-400 hover:bg-red-400/10">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
                
                {/* Grand Total Area */}
                <div className="mt-auto bg-[#121A2B] border-t border-[#243050] p-5 flex justify-end items-center gap-6">
                  <p className="text-[#8B9FC4] font-semibold uppercase tracking-widest text-sm">Order Total</p>
                  <p className="text-3xl font-bold font-mono text-[#EEF3FF]">
                    ₹{grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>

        <div className="p-5 border-t border-[#243050] shrink-0 flex justify-end gap-3 bg-[#0B101A]">
          <Button variant="ghost" onClick={onClose} className="text-[#8B9FC4] hover:text-[#EEF3FF] hover:bg-[#1C2840] h-12 px-6">
            Cancel
          </Button>
          <Button className="bg-[#E8581A] hover:bg-[#F5712E] text-white h-12 px-8 font-semibold text-[15px]">
            Create Order
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
