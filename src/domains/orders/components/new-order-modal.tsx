'use client'

import { useState, useMemo, useEffect } from 'react'
import { Plus, Trash } from '@phosphor-icons/react'
import { ConfirmDeleteDialog } from '@/shared/ui/confirm-delete-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Check, CaretUpDown } from '@phosphor-icons/react'
import { cn, handleEnterToTab } from '@/shared/lib/utils'
import { type Order } from '@/domains/orders/data/mock'
import { useRole } from '@/shared/context/role-context'

interface CartItem {
  id: string
  product: string
  productName: string
  quantity: number
  deliveryQuantity: number
  weight: number
  ratePerKg: number
  unitCost: number
}

export function NewOrderModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: {
  isOpen: boolean
  onClose: () => void
  onSave: (order: Order | Omit<Order, 'id'>) => void
  initialData?: Order | null
}) {
  const { role } = useRole()
  const [customerOpen, setCustomerOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [customerOrderNo, setCustomerOrderNo] = useState('')
  const [internalOrderNo, setInternalOrderNo] = useState('')
  const [orderDate, setOrderDate] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [remarks, setRemarks] = useState('')
  
  // Add item state
  const [selectedProduct, setSelectedProduct] = useState('')
  const [productDropdownOpen, setProductDropdownOpen] = useState(false)
  const [quantity, setQuantity] = useState<number | ''>('')
  const [ratePerKg, setRatePerKg] = useState<number | ''>('')
  const [unitCost, setUnitCost] = useState<number | ''>('')
  
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([])
  const [itemToDelete, setItemToDelete] = useState<string | null>(null)
  const [gstPercent, setGstPercent] = useState<string>('18')

  // Fetched data from API
  const [customers, setCustomers] = useState<{ value: string; label: string }[]>([])
  const [allProductsList, setAllProductsList] = useState<{ value: string; label: string; weight: number; ratePerKg: number }[]>([])

  useEffect(() => {
    if (!isOpen) return
    // Fetch customers
    fetch('/api/customers').then(r => r.json()).then(data => setCustomers(data)).catch(() => {})
    // Fetch products and map to dropdown format
    fetch('/api/products').then(r => r.json()).then((data: any[]) => {
      setAllProductsList(data.map(p => ({
        value: p.code || p.id,
        label: `${p.code} (${p.name})`,
        weight: parseFloat(p.weight) || 0,
        ratePerKg: p.ratePerKg || 0,
      })))
    }).catch(() => {})
  }, [isOpen])

  // Initialize from existing data if editing
  useMemo(() => {
    if (isOpen && initialData) {
      const custValue = customers.find(c => c.label === initialData.customer)?.value || initialData.customer || ''
      setSelectedCustomer(custValue)
      setCustomerOrderNo(initialData.customerOrderNo || '')
      setInternalOrderNo(initialData.internalOrderNo || '')
      setOrderDate(initialData.orderDate || '')
      setDeliveryDate(initialData.deliveryDate || '')
      setCart((initialData.cart || []).map(item => ({ ...item, id: item.id || Math.random().toString(36).substr(2, 9) })))
      setGstPercent(initialData.gstPercent?.toString() || '18')
    }
  }, [isOpen, initialData, customers])

  const resetForm = () => {
    setSelectedCustomer('')
    setCustomerOrderNo('')
    setInternalOrderNo('')
    setOrderDate('')
    setDeliveryDate('')
    setRemarks('')
    setSelectedProduct('')
    setQuantity('')
    setRatePerKg('')
    setUnitCost('')
    setCart([])
    setGstPercent('18')
  }

  const handleCreateOrder = () => {
    if (!customerOrderNo.trim() || cart.length === 0) return
    const customerLabel = customers.find(c => c.value === selectedCustomer)?.label || ''
    
    const orderPayload = {
      customerOrderNo: customerOrderNo.trim(),
      internalOrderNo: internalOrderNo.trim(),
      customer: customerLabel,
      product: cart[0]?.productName || '',
      orderDate: orderDate || new Date().toISOString().split('T')[0],
      deliveryDate: deliveryDate || '',
      status: initialData ? initialData.status : 'Received',
      gstPercent: Number(gstPercent) || 0,
      subtotal,
      gstAmount,
      grandTotal,
      cart: [...cart],
    }

    if (initialData) {
      onSave({ ...orderPayload, id: initialData.id })
    } else {
      onSave(orderPayload)
    }
    
    resetForm()
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleAddItem = () => {
    if (!selectedProduct || !quantity || quantity <= 0) return

    const productDetails = allProductsList.find(p => p.value === selectedProduct)
    if (!productDetails) return

    const rKg = ratePerKg === '' ? productDetails.ratePerKg : Number(ratePerKg)
    const uCost = unitCost === '' ? (productDetails.weight * rKg) : Number(unitCost)

    const newItem: CartItem = {
      id: Math.random().toString(36).substr(2, 9),
      product: selectedProduct,
      productName: productDetails.label,
      quantity: Number(quantity),
      deliveryQuantity: 0,
      weight: productDetails.weight,
      ratePerKg: rKg,
      unitCost: uCost,
    }

    setCart([...cart, newItem])
    
    // Reset inputs
    setSelectedProduct('')
    setQuantity('')
    setRatePerKg('')
    setUnitCost('')
  }

  const handleDeliveryQtyChange = (id: string, qty: number) => {
    setCart(cart.map(item => item.id === id ? { ...item, deliveryQuantity: qty } : item))
  }

  const handleRemoveItem = (id: string) => {
    setCart(cart.filter(item => item.id !== id))
  }

  const subtotal = useMemo(() => {
    return cart.reduce((total, item) => {
      const safeUnitCost = item.unitCost ?? (item.weight * item.ratePerKg) ?? 0
      return total + (safeUnitCost * item.quantity)
    }, 0)
  }, [cart])

  const gstAmount = subtotal * ((Number(gstPercent) || 0) / 100)
  const grandTotal = subtotal + gstAmount

  // Extreme speed entry: Enter on Quantity immediately adds the item and refocuses Pattern
  const handleQuantityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation(); // Stop the global handler
      handleAddItem();
      setTimeout(() => {
        document.getElementById('product-trigger')?.focus();
      }, 50);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent 
        className="w-full sm:max-w-[1300px] bg-[#050810] border-[#243050] text-foreground max-h-[95vh] overflow-hidden flex flex-col p-0"
        onKeyDown={handleEnterToTab}
      >
        <div className="p-6 pb-4 border-b border-[#243050] shrink-0">
          <DialogTitle className="text-2xl font-bold font-heading text-[#EEF3FF]">
            {initialData ? `Edit Sales Order: ${initialData.customerOrderNo}` : 'New Sales Order'}
          </DialogTitle>
          {!initialData && <p className="text-sm text-[#5A6E90] mt-1">Create a new production order and add line items</p>}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
            
            {/* LEFT SIDE: Order Details (Global) */}
            <div className="lg:col-span-3 space-y-6">
              <div className="space-y-4">
                <h3 className="text-[#8B9FC4] font-semibold uppercase tracking-wider text-sm border-b border-[#243050] pb-2">Order Details</h3>
                
                <div className="space-y-2">
                  <Label className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Customer Order No.</Label>
                  <Input placeholder="e.g. PO-98214" value={customerOrderNo} onChange={e => setCustomerOrderNo(e.target.value)} className="h-10 px-3 rounded-md bg-[#0C1221] border-[#243050] text-[#EEF3FF] text-sm" />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Internal Order No.</Label>
                  <Input placeholder="e.g. INT-4412" value={internalOrderNo} onChange={e => setInternalOrderNo(e.target.value)} className="h-10 px-3 rounded-md bg-[#0C1221] border-[#243050] text-[#EEF3FF] text-sm" />
                </div>

                <div className="space-y-2">
                  <Label className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Customer</Label>
                  <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                    <PopoverTrigger
                      className="flex h-12 w-full items-center justify-between rounded-lg border border-[#243050] bg-[#0C1221] px-4 py-2 text-[15px] text-[#EEF3FF] hover:bg-[#1A263D]"
                    >
                    {selectedCustomer
                      ? customers.find((c) => c.value === selectedCustomer)?.label
                      : 'Select customer...'}
                    <CaretUpDown weight="duotone" className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0 bg-[#0C1221] border-[#243050]">
                      <Command className="bg-transparent">
                        <CommandInput placeholder="Search customer..." className="text-[#EEF3FF]" />
                        <CommandList>
                          <CommandEmpty className="text-[#8B9FC4] p-4 text-center text-sm">No customer found.</CommandEmpty>
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
                                className="text-[#EEF3FF] hover:bg-[#1A263D] cursor-pointer"
                              >
                                <Check weight="duotone"
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    selectedCustomer === customer.value ? 'opacity-100 text-[#D4521A]' : 'opacity-0'
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
                  <Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} className="h-10 px-3 rounded-md bg-[#0C1221] border-[#243050] text-[#EEF3FF] text-sm [color-scheme:dark]" />
                </div>

                <div className="space-y-2">
                  <Label className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Delivery Date</Label>
                  <Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="h-10 px-3 rounded-md bg-[#0C1221] border-[#243050] text-[#EEF3FF] text-sm [color-scheme:dark]" />
                </div>

                
                <div className="space-y-2">
                  <Label className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Remarks</Label>
                  <Textarea placeholder="Notes..." value={remarks} onChange={e => setRemarks(e.target.value)} className="min-h-[80px] px-3 py-2 rounded-md bg-[#0C1221] border-[#243050] text-[#EEF3FF] text-sm resize-y" />
                </div>
              </div>
            </div>

            {/* RIGHT SIDE: Cart / Line Items */}
            <div className="lg:col-span-9 space-y-6 flex flex-col min-h-[500px]">
              <h3 className="text-[#8B9FC4] font-semibold uppercase tracking-wider text-sm border-b border-[#243050] pb-2">Line Items</h3>
              
              {/* Add Item Form */}
              <div className="flex items-end gap-3 bg-[#0C1221]/50 p-4 rounded-xl border border-[#243050]">
                <div className="flex-1 space-y-2">
                  <Label className="text-[#8B9FC4] text-xs font-semibold uppercase">Product</Label>
                  <Popover open={productDropdownOpen} onOpenChange={setProductDropdownOpen}>
                    <PopoverTrigger
                      id="product-trigger"
                      className="flex h-10 w-full items-center justify-between rounded-md border border-[#243050] bg-[#0C1221] px-3 py-2 text-sm text-[#EEF3FF] hover:bg-[#1A263D]"
                      aria-expanded={productDropdownOpen}
                    >
                      <span className="truncate pr-2">
                        {selectedProduct
                          ? allProductsList.find((p) => p.value === selectedProduct)?.label
                          : 'Select Product...'}
                      </span>
                      <CaretUpDown weight="duotone" className="h-4 w-4 shrink-0 opacity-50" />
                    </PopoverTrigger>
                    <PopoverContent className="w-[420px] p-0 bg-[#0C1221] border-[#243050]">
                      <Command className="bg-transparent">
                        <CommandInput placeholder="Search product..." className="text-[#EEF3FF]" />
                        <CommandList>
                          <CommandEmpty className="text-[#8B9FC4] p-4 text-center text-sm">
                            No product found.
                          </CommandEmpty>
                          <CommandGroup>
                            {allProductsList.map((p) => (
                              <CommandItem
                                key={p.value}
                                value={p.label}
                                onSelect={() => {
                                  setSelectedProduct(p.value);
                                  setRatePerKg(p.ratePerKg);
                                  setUnitCost(p.ratePerKg * p.weight);
                                  setProductDropdownOpen(false);
                                  setTimeout(() => document.getElementById('rate-input')?.focus(), 10);
                                }}
                                className="text-[#EEF3FF] hover:bg-[#1A263D] cursor-pointer"
                              >
                                <Check
                                  weight="duotone"
                                  className={cn(
                                    'mr-2 h-4 w-4 flex-shrink-0',
                                    selectedProduct === p.value ? 'opacity-100 text-[#D4521A]' : 'opacity-0'
                                  )}
                                />
                                {p.label}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                    <div className="w-[100px] space-y-2">
                      <Label className="text-[#8B9FC4] text-xs font-semibold uppercase">Rate/kg</Label>
                      <Input 
                        id="rate-input"
                        type="number" 
                        min="0"
                        value={ratePerKg}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : Number(e.target.value);
                          setRatePerKg(val);
                          const p = allProductsList.find(x => x.value === selectedProduct);
                          if (p && val !== '') setUnitCost(val * p.weight);
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && document.getElementById('unit-input')?.focus()}
                        placeholder="Rate" 
                        className="h-10 px-3 rounded-md bg-[#0C1221] border-[#243050] text-[#EEF3FF] text-sm" 
                      />
                    </div>
                    <div className="w-[110px] space-y-2">
                      <Label className="text-[#8B9FC4] text-xs font-semibold uppercase">Unit Cost</Label>
                      <Input 
                        id="unit-input"
                        type="number" 
                        min="0"
                        value={unitCost}
                        onChange={(e) => setUnitCost(e.target.value === '' ? '' : Number(e.target.value))}
                        onKeyDown={(e) => e.key === 'Enter' && document.getElementById('quantity-input')?.focus()}
                        placeholder="Cost" 
                        className="h-10 px-3 rounded-md bg-[#0C1221] border-[#243050] text-[#EEF3FF] text-sm" 
                      />
                    </div>

                <div className="w-[100px] space-y-2">
                  <Label className="text-[#8B9FC4] text-xs font-semibold uppercase">Quantity</Label>
                  <Input 
                    id="quantity-input"
                    type="number" 
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                    onKeyDown={handleQuantityKeyDown}
                    placeholder="0" 
                    className="h-10 px-3 rounded-md bg-[#0C1221] border-[#243050] text-[#EEF3FF] text-sm" 
                  />
                </div>
                <Button 
                  onClick={handleAddItem}
                  disabled={!selectedProduct || !quantity}
                  className="bg-[#D4521A] hover:bg-[#D4521A] text-white h-10 px-6 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus weight="bold" className="mr-2 h-4 w-4" /> Add
                </Button>
              </div>

              {/* Cart Table */}
              <div className="flex-1 border border-[#243050] rounded-xl overflow-hidden bg-[#050810] flex flex-col">
                <table className="w-full text-sm text-left">
                  <thead className="bg-[#0C1221] border-b border-[#243050] text-[#8B9FC4] text-xs uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-4 py-3 w-[250px]">Product</th>
                      <th className="px-4 py-3 text-center">Qty</th>
                      {initialData && <th className="px-4 py-3 text-center">Delivery Qty</th>}
                      <th className="px-4 py-3 text-center">Weight</th>
                      <th className="px-4 py-3 text-center">Unit Cost</th>
                      <th className="px-4 py-3 text-center">Line Total</th>
                      <th className="px-4 py-3 w-[50px]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#243050]">
                    {cart.length === 0 ? (
                      <tr>
                        <td colSpan={initialData ? 8 : 7} className="px-4 py-16 text-center">
                          <p className="text-[#5A6E90] text-[15px]">No items added to this order yet.</p>
                          <p className="text-[#5A6E90]/60 text-sm mt-1">Select a product above to add.</p>
                        </td>
                      </tr>
                    ) : (
                      cart.map((item, index) => {
                        const safeUnitCost = item.unitCost ?? (item.weight * item.ratePerKg) ?? 0
                        const lineTotal = safeUnitCost * item.quantity
                        return (
                          <tr key={item.id || index} className="hover:bg-[#1A263D]/50 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-medium text-[#EEF3FF] truncate max-w-[220px]">{item.productName}</p>
                            </td>
                            <td className="px-4 py-3 text-center font-medium text-[#EEF3FF]">{item.quantity.toLocaleString()}</td>
                            {initialData && (
                              <td className="px-4 py-3 text-center">
                                <Input 
                                  type="number" 
                                  min="0"
                                  className="h-7 w-16 mx-auto text-sm font-mono font-medium text-center bg-[#EEF3FF]/10 border-transparent text-[#EEF3FF] rounded-md focus:border-[#D4521A] focus:bg-[#0C1221] transition-colors px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                  value={item.deliveryQuantity}
                                  onChange={(e) => handleDeliveryQtyChange(item.id, Number(e.target.value))}
                                />
                              </td>
                            )}
                            <td className="px-4 py-3 text-center text-[#8B9FC4]">{item.weight} kg</td>
                            <td className="px-4 py-3 text-center text-[#8B9FC4]">
                                {initialData ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <span className="text-[#8B9FC4]">₹</span>
                                    <Input 
                                      type="number" 
                                      value={item.unitCost}
                                      onChange={(e) => handleUpdateCartItemCost(index, e.target.value)}
                                      className="h-7 w-20 text-sm font-mono font-medium text-center bg-[#EEF3FF]/10 border-transparent text-[#EEF3FF] rounded-md focus:border-[#D4521A] focus:bg-[#0C1221] transition-colors px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                    />
                                  </div>
                                ) : (
                                  <span>₹{safeUnitCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                )}
                            </td>
                            <td className="px-4 py-3 text-center font-mono font-medium text-[#D4521A]">₹{lineTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                            <td className="px-4 py-3 text-right">
                              <Button variant="ghost" size="icon" onClick={() => setItemToDelete(item.id!)} className="h-8 w-8 text-[#5A6E90] hover:text-red-400 hover:bg-red-400/10">
                                <Trash weight="duotone" className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
                
                {/* Grand Total Area */}
                <div className="mt-auto bg-[#0C1221] border-t border-[#243050] p-5 flex flex-col items-end gap-3">
                  <div className="space-y-4">
                    <Label className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Additional Details</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-[#5A6E90] mb-2 block">Notes / Remarks</Label>
                        <Input 
                          placeholder="Any specific requirements..."
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          className="h-10 bg-[#0C1221] border-[#243050] text-[#EEF3FF] focus:border-[#D4521A]"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-[#5A6E90] mb-2 block">Total Amount Preview</Label>
                        <div className="h-10 flex items-center px-4 rounded-md bg-[#050810] border border-[#243050] font-mono text-[#D4521A] font-medium">
                          ₹{cart.reduce((sum, item) => sum + ((item.quantity * (item.unitCost ?? 0))), 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center w-[280px]">
                    <p className="text-[#8B9FC4] font-medium text-sm">Subtotal</p>
                    <p className="text-[16px] font-mono text-[#EEF3FF]">
                      ₹{subtotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </p>
                  </div>
                  <div className="flex justify-between items-center w-[280px]">
                    <div className="flex items-center gap-2">
                      <p className="text-[#8B9FC4] font-medium text-sm">GST</p>
                      <div className="relative flex items-center">
                        <Input 
                          type="number"
                          min="1"
                          value={gstPercent}
                          onChange={(e) => setGstPercent(e.target.value)}
                          className="h-7 w-[60px] px-2 pr-4 rounded bg-[#050810] border-[#243050] text-[#EEF3FF] text-xs text-right"
                        />
                        <span className="absolute right-2 text-[#5A6E90] text-xs pointer-events-none">%</span>
                      </div>
                    </div>
                    <p className="text-[16px] font-mono text-[#EEF3FF]">
                      ₹{gstAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </p>
                  </div>
                  <div className={cn("flex justify-between items-center w-[280px]", "border-t border-[#243050] pt-3 mt-1")}>
                    <p className="text-[#EEF3FF] font-semibold uppercase tracking-widest text-[15px]">Order Total</p>
                    <p className="text-3xl font-bold font-mono text-[#D4521A]">
                      ₹{grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        <div className="p-5 border-t border-[#243050] shrink-0 flex justify-end gap-3 bg-[#050810]">
          <Button variant="ghost" onClick={handleClose} className="text-[#8B9FC4] hover:text-[#EEF3FF] hover:bg-[#1C2840] h-12 px-6">
            Cancel
          </Button>
          <Button onClick={handleCreateOrder} disabled={!customerOrderNo.trim() || cart.length === 0} className="bg-[#D4521A] hover:bg-[#D4521A] text-white h-12 px-8 font-semibold text-[15px] disabled:opacity-50">
            {initialData ? 'Save Order' : 'Create Order'}
          </Button>
        </div>
      </DialogContent>
      <ConfirmDeleteDialog 
        open={!!itemToDelete} 
        onOpenChange={(open) => !open && setItemToDelete(null)}
        onConfirm={() => {
          if (itemToDelete) handleRemoveItem(itemToDelete)
          setItemToDelete(null)
        }}
        title="Remove Line Item?"
        description="Are you sure you want to remove this item from the order?"
      />
    </Dialog>
  )
}
