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
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import { Check, CaretUpDown, Image as ImageIcon, Lock } from '@phosphor-icons/react'
import { cn, handleEnterToTab } from '@/lib/utils'

// Mock Customers
const customers = [
  { value: 'alpha', label: 'Alpha Heavy Industries' },
  { value: 'beta', label: 'Beta Metalworks' },
  { value: 'gamma', label: 'Gamma Components' },
  { value: 'delta', label: 'Delta Forge' },
]

export function NewPatternModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const [customerOpen, setCustomerOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState('')

  // Toggles
  const [customerProvided, setCustomerProvided] = useState(false)
  const [topMatchplateToggle, setTopMatchplateToggle] = useState(false)
  const [bottomMatchplateToggle, setBottomMatchplateToggle] = useState(false)

  // Weights
  const [goodCastingWeight, setGoodCastingWeight] = useState<number | ''>('')
  const [totalBoxWeight, setTotalBoxWeight] = useState<number | ''>('')

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

  const showMatchplateBadge = topMatchplateToggle || bottomMatchplateToggle

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="w-full sm:max-w-3xl md:max-w-4xl lg:max-w-5xl bg-[#050810] border-sidebar-border text-foreground overflow-y-auto max-h-[90vh]"
        onKeyDown={handleEnterToTab}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle className="text-xl font-heading text-white">
              New Pattern
            </DialogTitle>
            {showMatchplateBadge && (
              <Badge className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border-amber-500/50">
                Matchplate Present
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Row 1: Pattern Code | Customer */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pattern-code">Pattern Code</Label>
              <Input id="pattern-code" placeholder="Enter pattern code" className="bg-[#0C1221] border-sidebar-border" />
            </div>
            <div className="space-y-2">
              <Label>Customer</Label>
              <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                <PopoverTrigger
                  className="flex h-10 w-full items-center justify-between rounded-md border border-sidebar-border bg-[#0C1221] px-3 py-2 text-sm hover:bg-[#1A263D] hover:text-white"
                  aria-expanded={customerOpen}
                >
                  {selectedCustomer
                    ? customers.find((c) => c.value === selectedCustomer)?.label
                    : 'Select customer...'}
                  <CaretUpDown weight="duotone" className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0 bg-[#0C1221] border-sidebar-border">
                  <Command className="bg-transparent">
                    <CommandInput placeholder="Search customer..." />
                    <CommandList>
                      <CommandEmpty>No customer found.</CommandEmpty>
                      <CommandGroup>
                        {customers.map((customer) => (
                          <CommandItem
                            key={customer.value}
                            value={customer.value}
                            onSelect={(currentValue) => {
                              setSelectedCustomer(
                                currentValue === selectedCustomer ? '' : currentValue
                              )
                              setCustomerOpen(false)
                            }}
                            className="text-white hover:bg-[#1A263D]"
                          >
                            <Check weight="duotone"
                              className={cn(
                                'mr-2 h-4 w-4',
                                selectedCustomer === customer.value
                                  ? 'opacity-100'
                                  : 'opacity-0'
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

          {/* Row 2: Pattern Name | Customer Pattern Code */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pattern-name">Pattern Name</Label>
              <Input id="pattern-name" placeholder="Enter pattern name" className="bg-[#0C1221] border-sidebar-border" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-pattern-code">Customer Pattern Code</Label>
              <Input id="customer-pattern-code" placeholder="Optional" className="bg-[#0C1221] border-sidebar-border" />
            </div>
          </div>

          {/* Row 3: Pattern Category | Customer-provided pattern toggle */}
          <div className="grid grid-cols-2 gap-4 items-center">
            <div className="space-y-2">
              <Label>Pattern Category</Label>
              <Select defaultValue="machine">
                <SelectTrigger className="bg-[#0C1221] border-sidebar-border">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-[#0C1221] border-sidebar-border">
                  <SelectItem value="machine">Machine Moulding</SelectItem>
                  <SelectItem value="hand">Hand Moulding</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-3 border border-sidebar-border rounded-md bg-[#0C1221]">
              <div className="space-y-0.5">
                <Label>Customer-provided pattern</Label>
              </div>
              <Switch checked={customerProvided} onCheckedChange={setCustomerProvided} />
            </div>
          </div>

          {/* Top Matchplate/Scope */}
          <div className="grid grid-cols-12 gap-4 items-end">
            <div className="col-span-4 space-y-2">
              <Label>Top Matchplate / Scope</Label>
              <div className="flex items-center justify-between p-2.5 border border-sidebar-border rounded-md bg-[#0C1221] h-10">
                <span className="text-sm">Present</span>
                <Switch
                  checked={topMatchplateToggle}
                  onCheckedChange={setTopMatchplateToggle}
                />
              </div>
            </div>
            <div className="col-span-8 space-y-2">
              <Input placeholder="Enter top matchplate details..." disabled={!topMatchplateToggle} className="bg-[#0C1221] border-sidebar-border disabled:opacity-50" />
            </div>
          </div>

          {/* Bottom Matchplate/Drag */}
          <div className="grid grid-cols-12 gap-4 items-end">
            <div className="col-span-4 space-y-2">
              <Label>Bottom Matchplate / Drag</Label>
              <div className="flex items-center justify-between p-2.5 border border-sidebar-border rounded-md bg-[#0C1221] h-10">
                <span className="text-sm">Present</span>
                <Switch
                  checked={bottomMatchplateToggle}
                  onCheckedChange={setBottomMatchplateToggle}
                />
              </div>
            </div>
            <div className="col-span-8 space-y-2">
              <Input placeholder="Enter bottom matchplate details..." disabled={!bottomMatchplateToggle} className="bg-[#0C1221] border-sidebar-border disabled:opacity-50" />
            </div>
          </div>

          {/* Matchplate Owners */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Top Matchplate / Scope Owner</Label>
              <Select defaultValue="foundry" disabled={!topMatchplateToggle}>
                <SelectTrigger className="bg-[#0C1221] border-sidebar-border disabled:opacity-50">
                  <SelectValue placeholder="Select owner" />
                </SelectTrigger>
                <SelectContent className="bg-[#0C1221] border-sidebar-border">
                  <SelectItem value="foundry">Foundry</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Bottom Matchplate / Drag Owner</Label>
              <Select defaultValue="foundry" disabled={!bottomMatchplateToggle}>
                <SelectTrigger className="bg-[#0C1221] border-sidebar-border disabled:opacity-50">
                  <SelectValue placeholder="Select owner" />
                </SelectTrigger>
                <SelectContent className="bg-[#0C1221] border-sidebar-border">
                  <SelectItem value="foundry">Foundry</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Weights & Quantities */}
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Core Boxes</Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                className="bg-[#0C1221] border-sidebar-border"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">Good Cast Wt (kg) <Lock weight="duotone" className="h-3 w-3 text-muted-foreground" /></Label>
              <Input
                type="number"
                min={0}
                value={goodCastingWeight}
                readOnly
                placeholder="0.0"
                className="bg-[#0C1221]/50 border-sidebar-border text-muted-foreground cursor-not-allowed"
              />
            </div>
            <div className="space-y-2">
              <Label>Total Box Wt (kg)</Label>
              <Input
                type="number"
                min={0}
                value={totalBoxWeight}
                onChange={(e) => setTotalBoxWeight(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0.0"
                className="bg-[#0C1221] border-sidebar-border"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-amber-500">Yield %</Label>
              <div className="h-10 px-3 flex items-center bg-[#1A263D]/50 border border-sidebar-border rounded-md text-amber-400 font-mono text-sm">
                {yieldPercentage}
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div className="space-y-2">
            <Label>Remarks</Label>
            <Textarea
              placeholder="Any additional notes..."
              className="bg-[#0C1221] border-sidebar-border resize-none h-24"
            />
          </div>

          {/* Photos */}
          <div className="space-y-2">
            <Label>Photos (Max 10)</Label>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {/* Fake thumbnails row */}
              <div className="h-16 w-16 shrink-0 bg-[#0C1221] border border-sidebar-border rounded-md flex items-center justify-center text-muted-foreground hover:bg-[#1A263D] transition-colors cursor-pointer">
                <ImageIcon weight="duotone" className="h-6 w-6 opacity-40" />
              </div>
              <div className="h-16 w-16 shrink-0 bg-[#0C1221] border border-sidebar-border rounded-md flex items-center justify-center text-muted-foreground hover:bg-[#1A263D] transition-colors cursor-pointer">
                <ImageIcon weight="duotone" className="h-6 w-6 opacity-40" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              * Photos should be uploaded via the mobile app
            </p>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={onClose} className="hover:bg-[#0C1221] hover:text-white">
            Cancel
          </Button>
          <Button className="bg-[#D4521A] hover:bg-[#D04810] text-white">
            Save Pattern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
