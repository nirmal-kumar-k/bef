'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Check, CaretUpDown, Funnel, Plus, X } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { NewPatternModal } from '@/components/patterns/new-pattern-modal'
import { ProductMappingModal } from '@/components/patterns/product-mapping-modal'

// Mock Data
const customers = [
  { value: 'alpha', label: 'Alpha Heavy Industries' },
  { value: 'beta', label: 'Beta Metalworks' },
  { value: 'gamma', label: 'Gamma Components' },
  { value: 'delta', label: 'Delta Forge' },
]

const mockPatterns = [
  {
    id: 'PT-001',
    code: 'AHI-VLV-88',
    name: 'High Pressure Valve Body',
    customer: 'Alpha Heavy Industries',
    category: 'Machine Moulding',
    goodWeight: 45.5,
    totalWeight: 65.0,
    topMatchplate: true,
    bottomMatchplate: true,
    mappedProducts: [
      { name: 'Valve Housing A', cavities: 2 },
      { name: 'Valve Cap', cavities: 4 },
    ],
  },
  {
    id: 'PT-002',
    code: 'BET-FLG-12',
    name: 'Standard Flange 12"',
    customer: 'Beta Metalworks',
    category: 'Hand Moulding',
    goodWeight: 12.0,
    totalWeight: 18.5,
    topMatchplate: false,
    bottomMatchplate: false,
    mappedProducts: [
      { name: 'Flange Base', cavities: 1 },
    ],
  },
  {
    id: 'PT-003',
    code: 'GAM-PMP-05',
    name: 'Centrifugal Pump Impeller',
    customer: 'Gamma Components',
    category: 'Machine Moulding',
    goodWeight: 22.4,
    totalWeight: 31.0,
    topMatchplate: true,
    bottomMatchplate: false,
    mappedProducts: [
      { name: 'Impeller Core', cavities: 1 },
      { name: 'Impeller Shell', cavities: 1 },
    ],
  },
]

type FilterCategory = 'All' | 'Machine Moulding' | 'Hand Moulding'

export default function PatternsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false)
  const [mappingPatternId, setMappingPatternId] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('All')
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [customerOpen, setCustomerOpen] = useState(false)

  // Filter logic
  const filteredPatterns = mockPatterns.filter((p) => {
    const matchCategory = activeCategory === 'All' || p.category === activeCategory
    const matchCustomer = selectedCustomer === '' || p.customer === customers.find((c) => c.value === selectedCustomer)?.label
    return matchCategory && matchCustomer
  })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground font-heading">
            Patterns
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage physical foundry patterns and matchplates
          </p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#D4521A] text-white transition-all hover:bg-[#EB6824] hover:shadow-[0_4px_14px_rgba(232,88,26,0.35)] hover:-translate-y-[1px]"
        >
          <Plus weight="bold" className="mr-2 h-4 w-4" />
          New Pattern
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between py-6 px-6 bg-[#0C1221] border border-white/[0.06] rounded-[14px] min-h-[80px]">
        <div className="flex flex-wrap gap-3">
          {(['All', 'Machine Moulding', 'Hand Moulding'] as const).map(
            (cat) => (
              <Badge
                key={cat}
                variant="outline"
                className={cn(
                  'cursor-pointer h-12 px-8 text-[15px] font-medium transition-colors border border-sidebar-border rounded-lg min-w-[120px] flex items-center justify-center',
                  activeCategory === cat
                    ? 'bg-[#D4521A]/20 border-[#D4521A]/40 text-[#EB6824]'
                    : 'bg-transparent text-[#8B9FC4] hover:border-[#2E3C5C] hover:text-[#EEF3FF]'
                )}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </Badge>
            )
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Funnel weight="duotone" className="h-4 w-4 text-muted-foreground hidden sm:block" />
          <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
            <PopoverTrigger
              className="flex h-10 w-full sm:w-[240px] items-center justify-between rounded-md border border-sidebar-border bg-[#0C1221] px-3 py-2 text-sm hover:bg-[#1A263D] hover:text-white"
              aria-expanded={customerOpen}
            >
              {selectedCustomer
                ? customers.find((c) => c.value === selectedCustomer)?.label
                : 'Filter by customer...'}
              <CaretUpDown weight="duotone" className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </PopoverTrigger>
            <PopoverContent className="w-[240px] p-0 bg-[#0C1221] border-sidebar-border">
              <Command className="bg-transparent">
                <CommandInput placeholder="Search customer..." />
                <CommandList>
                  <CommandEmpty>No customer found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="all"
                      onSelect={() => {
                        setSelectedCustomer('')
                        setCustomerOpen(false)
                      }}
                      className="text-white hover:bg-[#1A263D]"
                    >
                      All Customers
                    </CommandItem>
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

      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPatterns.map((pattern) => {
          const yieldPercent = ((pattern.goodWeight / pattern.totalWeight) * 100).toFixed(1)

          return (
            <Card
              key={pattern.id}
              className="bg-[#0C1221] border border-white/[0.06] rounded-[14px] transition-all duration-150 hover:-translate-y-[2px] hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)] hover:border-white/[0.1] overflow-hidden flex flex-col cursor-pointer"
            >
              <div className="p-5 flex-1 space-y-4">
                {/* Header: Code & Category */}
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="text-[15px] font-mono text-muted-foreground">
                      {pattern.code}
                    </p>
                    <h3 className="font-bold text-xl text-foreground mt-1 line-clamp-1">
                      {pattern.name}
                    </h3>
                  </div>
                  <Badge variant="outline" className="shrink-0 bg-[#0C1221] border-sidebar-border text-[13px]">
                    {pattern.category}
                  </Badge>
                </div>

                {/* Customer */}
                <div className="text-[15px] text-sidebar-foreground/80">
                  <span className="text-muted-foreground mr-2">Customer:</span>
                  {pattern.customer}
                </div>

                {/* Weights & Yield */}
                <div className="grid grid-cols-3 gap-2 py-3 border-y border-sidebar-border/50">
                  <div>
                    <p className="text-[13px] text-muted-foreground">Good Wt</p>
                    <p className="font-mono text-[15px] mt-0.5">{pattern.goodWeight}kg</p>
                  </div>
                  <div>
                    <p className="text-[13px] text-muted-foreground">Box Wt</p>
                    <p className="font-mono text-[15px] mt-0.5">{pattern.totalWeight}kg</p>
                  </div>
                  <div>
                    <p className="text-[13px] text-muted-foreground">Yield</p>
                    <p className="font-mono text-[15px] mt-0.5 text-amber-400">
                      {yieldPercent}%
                    </p>
                  </div>
                </div>

                {/* Matchplate Badges */}
                {(pattern.topMatchplate || pattern.bottomMatchplate) && (
                  <div className="flex flex-wrap gap-2">
                    <Badge 
                      className={cn(
                        "flex items-center gap-1 font-normal border px-2 py-0.5",
                        pattern.topMatchplate 
                          ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/30" 
                          : "bg-sidebar-accent/10 text-muted-foreground border-sidebar-border"
                      )}
                    >
                      {pattern.topMatchplate ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      Top
                    </Badge>
                    <Badge 
                      className={cn(
                        "flex items-center gap-1 font-normal border px-2 py-0.5",
                        pattern.bottomMatchplate 
                          ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/30" 
                          : "bg-sidebar-accent/10 text-muted-foreground border-sidebar-border"
                      )}
                    >
                      {pattern.bottomMatchplate ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      Bottom
                    </Badge>
                  </div>
                )}

                {/* Mapped Products */}
                <div className="space-y-2">
                  <p className="text-[13px] text-muted-foreground uppercase tracking-wider">
                    Mapped Products
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {pattern.mappedProducts.map((prod, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="bg-[#0C1221] text-foreground border-sidebar-border/50 font-normal"
                      >
                        {prod.name}
                        <span className="ml-2 text-muted-foreground font-mono">
                          ×{prod.cavities}
                        </span>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer Action */}
              <div className="p-4 bg-[#0C1221]/50 border-t border-sidebar-border">
                <Button
                  variant="outline"
                  onClick={() => {
                    setMappingPatternId(pattern.id)
                    setIsMappingModalOpen(true)
                  }}
                  className="w-full bg-transparent border-sidebar-border text-[#8B9FC4] transition-colors hover:bg-[#1C2840] hover:text-[#EEF3FF] hover:border-[#2E3C5C]"
                >
                  Map Products
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      {filteredPatterns.length === 0 && (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-sidebar-border rounded-lg">
          No patterns found matching your filters.
        </div>
      )}

      <NewPatternModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <ProductMappingModal
        isOpen={isMappingModalOpen}
        onClose={() => setIsMappingModalOpen(false)}
        patternId={mappingPatternId}
      />
    </div>
  )
}
