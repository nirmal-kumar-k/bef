'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { Card } from '@/shared/ui/card'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/ui/command'
import { Check, CaretUpDown, Funnel, Plus, X } from '@phosphor-icons/react'
import { cn } from '@/shared/lib/utils'
import { NewPatternModal } from '@/modules/patterns/presentation/new-pattern-modal'
import { ProductMappingModal } from '@/modules/patterns/presentation/product-mapping-modal'
import { ViewPatternModal } from '@/modules/patterns/presentation/view-pattern-modal'
import { type Pattern, type FilterCategory } from '@/modules/patterns/domain/pattern.types'
import { useRole } from '@/shared/context/role-context'
import { ShieldWarning } from '@phosphor-icons/react'

export default function PatternsPage() {
  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false)
  const [mappingPatternId, setMappingPatternId] = useState<string | null>(null)
  const [viewPattern, setViewPattern] = useState<any | null>(null)
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('All')
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [customerOpen, setCustomerOpen] = useState(false)
  const { role } = useRole()

  // Fetched data from API
  const [customers, setCustomers] = useState<{ value: string; label: string }[]>([])

  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then(data => setCustomers(data)).catch(() => {})
  }, [])


  const fetchPatterns = useCallback(async () => {
    try {
      const res = await fetch('/api/patterns')
      if (res.ok) {
        const data = await res.json()
        setPatterns(data)
      }
    } catch (err) {
      console.error('Failed to fetch patterns:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPatterns()
  }, [fetchPatterns])

  const handleSavePattern = async (pattern: Omit<Pattern, 'id'>) => {
    try {
      const res = await fetch('/api/patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pattern),
      })
      if (res.ok) {
        await fetchPatterns()
        setIsModalOpen(false)
      }
    } catch (err) {
      console.error('Failed to save pattern:', err)
    }
  }

  const handleSaveMapping = async (mappedProducts: any[]) => {
    if (!mappingPatternId) return
    try {
      const res = await fetch(`/api/patterns/${mappingPatternId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappedProducts }),
      })
      if (res.ok) {
        await fetchPatterns()
        setIsMappingModalOpen(false)
      }
    } catch (err) {
      console.error('Failed to save mapping:', err)
    }
  }

  const handleSavePatternEdit = async (updated: any) => {
    if (!updated?.id) return
    try {
      const res = await fetch(`/api/patterns/${updated.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
      if (res.ok) {
        await fetchPatterns()
        setViewPattern(null)
      }
    } catch (err) {
      console.error('Failed to update pattern:', err)
    }
  }

  // Filter logic
  const filteredPatterns = patterns.filter((p) => {
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
          className="bg-[#4F46E5] text-white transition-all hover:bg-[#4F46E5] hover:shadow-[0_4px_14px_rgba(79,70,229,0.35)] hover:-translate-y-[1px]"
        >
          <Plus weight="bold" className="mr-2 h-4 w-4" />
          New Pattern
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between py-6 px-6 bg-[#FFFFFF] border border-black/[0.04] rounded-[14px] min-h-[80px]">
        <div className="flex flex-wrap gap-3">
          {(['All', 'Machine Moulding', 'Hand Moulding'] as const).map(
            (cat) => (
              <Badge
                key={cat}
                variant="outline"
                className={cn(
                  'cursor-pointer h-12 px-8 text-[15px] font-medium transition-colors border border-sidebar-border rounded-lg min-w-[120px] flex items-center justify-center',
                  activeCategory === cat
                    ? 'bg-[#4F46E5]/20 border-[#4F46E5]/40 text-[#4F46E5]'
                    : 'bg-transparent text-[#64748B] hover:border-[#C7D2FE] hover:text-[#172554]'
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
              className="flex h-10 w-full sm:w-[240px] items-center justify-between rounded-md border border-sidebar-border bg-[#FFFFFF] px-3 py-2 text-sm hover:bg-[#EEF2FF] hover:text-[#4F46E5]"
              aria-expanded={customerOpen}
            >
              {selectedCustomer
                ? customers.find((c) => c.value === selectedCustomer)?.label
                : 'Filter by customer...'}
              <CaretUpDown weight="duotone" className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </PopoverTrigger>
            <PopoverContent className="w-[240px] p-0 bg-[#FFFFFF] border-sidebar-border">
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
                      className="text-[#64748B] hover:text-[#4F46E5] hover:bg-[#EEF2FF] cursor-pointer"
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
                        className="text-[#64748B] hover:text-[#4F46E5] hover:bg-[#EEF2FF] cursor-pointer"
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

      {/* Card Grid or Empty/Loading State */}
      {loading ? (
        <div className="py-20 text-center">
          <p className="text-[#64748B] text-lg animate-pulse">Loading patterns...</p>
        </div>
      ) : patterns.length === 0 && activeCategory === 'All' && selectedCustomer === '' ? (
        <div className="py-20 text-center border border-dashed border-[#E0E7FF] rounded-xl bg-[#FFFFFF]/30">
          <p className="text-[#64748B] text-lg font-medium">No patterns yet</p>
          <p className="text-[#94A3B8] text-sm mt-1">Click &quot;New Pattern&quot; to add your first pattern</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPatterns.map((pattern) => {
              const yieldPercent = pattern.totalWeight > 0 
                ? ((pattern.goodWeight / pattern.totalWeight) * 100).toFixed(1)
                : '-'

              return (
                <Card
                  key={pattern.id}
                  onClick={() => setViewPattern(pattern)}
                  className="bg-[#FFFFFF] border border-[#E0E7FF] rounded-[14px] transition-all duration-300 hover:-translate-y-[2px] hover:shadow-[0_8px_24px_-4px_rgba(79,70,229,0.25)] hover:border-[#4F46E5]/30 overflow-hidden flex flex-col cursor-pointer"
                >
                  <div className="p-5 flex-1 space-y-4">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="text-[15px] font-mono text-muted-foreground">{pattern.code}</p>
                        <h3 className="font-bold text-xl text-foreground mt-1 line-clamp-1">{pattern.name}</h3>
                      </div>
                      <Badge variant="outline" className="shrink-0 bg-[#FFFFFF] border-sidebar-border text-[13px]">{pattern.category}</Badge>
                    </div>
                    <div className="text-[15px] text-sidebar-foreground/80">
                      <span className="text-muted-foreground mr-2">Customer:</span>{pattern.customer}
                    </div>
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
                        <p className="font-mono text-[15px] mt-0.5 text-amber-400">{yieldPercent}{yieldPercent !== '-' ? '%' : ''}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={cn("flex items-center gap-1 font-normal border px-2 py-0.5", pattern.topMatchplate ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/30" : "bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/30")}>
                        {pattern.topMatchplate ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} Top
                      </Badge>
                      <Badge className={cn("flex items-center gap-1 font-normal border px-2 py-0.5", pattern.bottomMatchplate ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/30" : "bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/30")}>
                        {pattern.bottomMatchplate ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} Bottom
                      </Badge>
                    </div>
                    {pattern.mappedProducts && pattern.mappedProducts.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[13px] text-muted-foreground uppercase tracking-wider">Mapped Products</p>
                        <div className="flex flex-wrap gap-2">
                          {pattern.mappedProducts.map((prod, idx) => (
                            <Badge key={idx} variant="secondary" className="bg-[#FFFFFF] text-foreground border-sidebar-border/50 font-normal">
                              {prod.name}<span className="ml-2 text-muted-foreground font-mono">×{prod.cavities}</span>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-4 bg-[#FFFFFF]/50 border-t border-sidebar-border">
                    <Button
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        setMappingPatternId(pattern.id)
                        setIsMappingModalOpen(true)
                      }}
                      className="w-full bg-transparent border-sidebar-border text-[#64748B] transition-colors hover:bg-[#EEF2FF] hover:text-[#172554] hover:border-[#C7D2FE]"
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
        </>
      )}

      <NewPatternModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSavePattern}
      />

      <ProductMappingModal
        isOpen={isMappingModalOpen}
        onClose={() => setIsMappingModalOpen(false)}
        patternId={mappingPatternId}
        onSave={handleSaveMapping}
        initialMappedProducts={patterns.find(p => p.id === mappingPatternId)?.mappedProducts || []}
        coreBoxes={patterns.find(p => p.id === mappingPatternId)?.sharedCoreBoxes || []}
      />
      <ViewPatternModal
        pattern={viewPattern}
        isOpen={!!viewPattern}
        onClose={() => setViewPattern(null)}
        onSave={handleSavePatternEdit}
      />
    </div>
  )
}
