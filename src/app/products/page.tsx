'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus } from '@phosphor-icons/react'
import { Button } from '@/shared/ui/button'
import { NewProductModal } from '@/domains/products/components/new-product-modal'
import { ViewProductModal } from '@/domains/products/components/view-product-modal'
import type { Product } from '@/domains/products/data/mock'
import { useRole } from '@/shared/context/role-context'
import { ShieldWarning, Funnel, Check, CaretUpDown, X, MagnifyingGlass } from '@phosphor-icons/react'
import { cn } from '@/shared/lib/utils'
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
import { Input } from '@/shared/ui/input'

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null)
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState('')
  const [customerOpen, setCustomerOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { role } = useRole()

  // Fetched data from API
  const [customers, setCustomers] = useState<{ value: string; label: string }[]>([])

  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then(data => setCustomers(data)).catch(() => {})
  }, [])

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products')
      if (res.ok) {
        const data = await res.json()
        setProducts(data)
      }
    } catch (err) {
      console.error('Failed to fetch products:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const handleSaveProduct = async (product: Omit<Product, 'id'>) => {
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product),
      })
      if (res.ok) {
        await fetchProducts()
        setIsModalOpen(false)
      }
    } catch (err) {
      console.error('Failed to save product:', err)
    }
  }

  const handleUpdateProduct = async (product: Product) => {
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product),
      })
      if (res.ok) {
        await fetchProducts()
        setIsViewModalOpen(false)
      }
    } catch (err) {
      console.error('Failed to update product:', err)
    }
  }

  const filteredProducts = products.filter(product => {
    if (selectedCustomerFilter && product.customer !== selectedCustomerFilter) {
      return false
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!product.name.toLowerCase().includes(q) && !product.code.toLowerCase().includes(q)) {
        return false
      }
    }
    return true
  })
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#EEF3FF] font-heading tracking-tight">Products</h1>
          <p className="text-[#8B9FC4] mt-1 text-sm">Manage foundry products and customer weights</p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#D4521A] text-white transition-all hover:bg-[#D4521A] hover:shadow-[0_4px_14px_rgba(232,88,26,0.35)] hover:-translate-y-[1px]"
        >
          <Plus weight="bold" className="mr-2 h-4 w-4" />
          New Product
        </Button>
      </div>

      {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between py-6 px-6 bg-[#0C1221] border border-white/[0.06] rounded-[14px] min-h-[80px]">
          {/* Left Side: Search */}
          <div className="relative w-full sm:w-[320px]">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5A6E90]" />
            <Input
              type="text"
              placeholder="Search products by code or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 w-full bg-[#1A263D]/50 border-sidebar-border text-sm text-[#EEF3FF] placeholder:text-[#5A6E90] focus-visible:ring-1 focus-visible:ring-[#D4521A]/50 rounded-lg transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A6E90] hover:text-[#EEF3FF] transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Right Side: Customer Filter */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Funnel weight="duotone" className="h-4 w-4 text-muted-foreground hidden sm:block" />
            <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
              <PopoverTrigger
                className="flex h-10 w-full sm:w-[240px] items-center justify-between rounded-md border border-sidebar-border bg-[#0C1221] px-3 py-2 text-sm hover:bg-[#1A263D] hover:text-white"
                aria-expanded={customerOpen}
              >
                {selectedCustomerFilter
                  ? customers.find((c) => c.label === selectedCustomerFilter)?.label || selectedCustomerFilter
                  : 'Filter by Customer...'}
                <CaretUpDown weight="duotone" className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </PopoverTrigger>
              <PopoverContent className="w-[240px] p-0 bg-[#0C1221] border-sidebar-border">
                <Command className="bg-transparent">
                  <CommandInput placeholder="Search customer..." className="text-white" />
                  <CommandList>
                    <CommandEmpty className="text-muted-foreground p-4 text-center text-sm">No customer found.</CommandEmpty>
                    <CommandGroup>
                      {customers.map((customer) => (
                        <CommandItem
                          key={customer.value}
                          value={customer.label}
                          onSelect={(currentValue) => {
                            setSelectedCustomerFilter(currentValue === selectedCustomerFilter ? '' : currentValue)
                            setCustomerOpen(false)
                          }}
                          className="text-[#8B9FC4] hover:text-white hover:bg-[#1A263D] cursor-pointer"
                        >
                          <Check weight="duotone"
                            className={cn(
                              'mr-2 h-4 w-4 text-[#D4521A]',
                              selectedCustomerFilter === customer.label ? 'opacity-100' : 'opacity-0'
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
            
            {selectedCustomerFilter && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setSelectedCustomerFilter('')}
                className="h-10 w-10 text-muted-foreground hover:text-white hover:bg-[#1A263D] shrink-0"
                title="Clear filter"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

      {loading ? (
        <div className="py-20 text-center">
          <p className="text-[#8B9FC4] text-lg animate-pulse">Loading products...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-[#243050] rounded-xl bg-[#0C1221]/30">
          <p className="text-[#8B9FC4] text-lg font-medium">No products yet</p>
          <p className="text-[#5A6E90] text-sm mt-1">Click &quot;New Product&quot; to add your first product</p>
        </div>
      ) : (
        <div className="rounded-[14px] border border-white/[0.06] bg-[#0C1221] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[15px] text-left">
              <thead className="bg-[#0C1221] border-b border-[#243050] text-[#8B9FC4] text-[13px] uppercase tracking-wider font-heading">
                <tr>
                  <th className="px-6 py-4 font-medium">Product Code</th>
                  <th className="px-6 py-4 font-medium">Product Name</th>
                  <th className="px-6 py-4 font-medium">Customer</th>
                  <th className="px-6 py-4 text-right font-medium">Weight</th>
                  <th className="px-6 py-4 text-right font-medium">Cavity Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#243050]">
                {filteredProducts.map((product) => (
                  <tr 
                    key={product.id} 
                    className="hover:bg-[#1A263D]/50 transition-colors group cursor-pointer"
                    onClick={() => {
                      setViewingProduct(product)
                      setIsViewModalOpen(true)
                    }}
                  >
                    <td className="px-6 py-4 font-mono text-[#D4521A] font-medium">{product.code}</td>
                    <td className="px-6 py-4 text-[#EEF3FF] font-medium group-hover:text-white transition-colors">{product.name}</td>
                    <td className="px-6 py-4 text-[#8B9FC4] group-hover:text-[#C4D2EE] transition-colors">{product.customer}</td>
                    <td className="px-6 py-4 text-right text-[#C4D2EE]">{product.weight}</td>
                    <td className="px-6 py-4 text-right font-mono text-[#5A6E90] group-hover:text-[#8B9FC4] transition-colors">{product.cavities}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <NewProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProduct}
      />

      <ViewProductModal
        product={viewingProduct}
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        onSave={handleUpdateProduct}
      />
    </div>
  )
}
