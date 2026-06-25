'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldWarning, CalendarPlus, Cube, CubeTransparent, Fire } from '@phosphor-icons/react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { useRole } from '@/shared/context/role-context'
import { cn } from '@/shared/lib/utils'
import { MeltPlanningTab } from '@/domains/production/components/melt-planning-tab'

// Component to handle local state and only trigger updates on blur/enter
function EditableCell({ initialValue, onSave, className }: { initialValue: number, onSave: (val: number) => void, className?: string }) {
  const [value, setValue] = useState(initialValue.toString())

  useEffect(() => {
    setValue(initialValue.toString())
  }, [initialValue])

  const handleBlur = () => {
    const num = Number(value)
    if (!isNaN(num) && num !== initialValue) {
      onSave(num)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur()
    }
  }

  return (
    <Input 
      type="number"
      min="0"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
    />
  )
}

export default function ProductionPlanningPage() {
  const { role } = useRole()
  const router = useRouter()
  
  const [orders, setOrders] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [patterns, setPatterns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'Core' | 'Mould' | 'Melt'>('Core')

  // Editable overrides for Moulds and Cores
  const [plannedQtyOverrides, setPlannedQtyOverrides] = useState<Record<string, number>>({})
  const [mouldOverrides, setMouldOverrides] = useState<Record<string, number>>({})
  const [coreOverrides, setCoreOverrides] = useState<Record<string, number>>({})

  const fetchData = useCallback(async () => {
    try {
      const [orderRes, prodRes, patRes] = await Promise.all([
        fetch('/api/orders'),
        fetch('/api/products'),
        fetch('/api/patterns')
      ])
      
      if (orderRes.ok && prodRes.ok && patRes.ok) {
        setOrders(await orderRes.json())
        setProducts(await prodRes.json())
        setPatterns(await patRes.json())
      }
    } catch (err) {
      console.error('Failed to fetch planning data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const openOrders = useMemo(() => orders.filter(o => o.status === 'Received'), [orders])

  // Data processing
  const planningData = useMemo(() => {
    const data: any[] = []
    
    openOrders.forEach(order => {
      order.cart?.forEach((item: any, idx: number) => {
        const uniqueId = `${order.id || order._id}-${idx}`
        const product = products.find(p => p.name === item.productName || p.code === item.product)
        const pattern = product?.linkedPattern ? patterns.find(p => p.code === product.linkedPattern) : null
        
        const cavities = product?.cavities || 1
        
        // Use planned quantity if overridden, else fallback to order quantity
        const plannedQty = plannedQtyOverrides[uniqueId] !== undefined ? plannedQtyOverrides[uniqueId] : item.quantity
        
        // Auto-calculate moulds: Planned Qty / Cavities (rounded up)
        const calculatedMoulds = Math.ceil(plannedQty / cavities)
        const finalMoulds = mouldOverrides[uniqueId] !== undefined ? mouldOverrides[uniqueId] : calculatedMoulds
        
        // Find core boxes count from pattern's mapped products
        const mappedProduct = pattern?.mappedProducts?.find((mp: any) => mp.name === product?.name)
        const coreBoxesCount = mappedProduct?.coreBoxesCount || 0
        
        const calculatedCores = finalMoulds * coreBoxesCount
        const finalCores = coreOverrides[uniqueId] !== undefined ? coreOverrides[uniqueId] : calculatedCores

        const boxWeight = pattern?.totalWeight || 0
        const metalRequired = finalMoulds * boxWeight

        data.push({
          itemId: uniqueId,
          orderNo: order.customerOrderNo,
          orderDate: order.orderDate,
          customer: order.customer,
          patternRef: pattern?.code || '-',
          productName: item.productName,
          orderQty: item.quantity,
          plannedQty,
          cavities: cavities,
          calculatedMoulds,
          finalMoulds,
          coreBoxCode: pattern ? `${pattern.code}-CB` : '-',
          calculatedCores,
          finalCores,
          productGrade: product?.grade || '-',
          boxWeight,
          metalRequired,
          furnaceCapacity: 500, // Example fixed capacity, could be dynamic
        })
      })
    })
    
    return data
  }, [openOrders, products, patterns, mouldOverrides, coreOverrides, plannedQtyOverrides])

  // Aggregated Summary
  const totals = useMemo(() => {
    return planningData.reduce((acc, curr) => ({
      cores: acc.cores + curr.finalCores,
      moulds: acc.moulds + curr.finalMoulds,
      metal: acc.metal + curr.metalRequired
    }), { cores: 0, moulds: 0, metal: 0 })
  }, [planningData])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#EEF3FF] font-heading tracking-tight">Production Planning</h1>
          <p className="text-[#8B9FC4] mt-1 text-sm">Calculate requirements and plan production stages</p>
        </div>
        <Button 
          onClick={() => router.push('/production-schedule')}
          className="bg-[#D4521A] hover:bg-[#D4521A] text-white px-6 py-5 text-sm font-semibold rounded-lg shadow-lg shadow-[#D4521A]/20"
        >
          <CalendarPlus weight="bold" className="mr-2 h-5 w-5" />
          Schedule Production
        </Button>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <p className="text-[#8B9FC4] text-lg animate-pulse">Loading planning data...</p>
        </div>
      ) : (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#0C1221] border border-[#243050] p-6 rounded-2xl flex items-center gap-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4521A]/5 rounded-full -mr-10 -mt-10 blur-2xl pointer-events-none" />
              <div className="w-14 h-14 rounded-xl bg-[#1A263D] flex items-center justify-center shrink-0 border border-[#2E3C5C]">
                <CubeTransparent weight="duotone" className="w-7 h-7 text-[#D4521A]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#8B9FC4] uppercase tracking-wider mb-1">Total Cores Needed</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-[#EEF3FF] font-mono tracking-tight">{totals.cores.toLocaleString()}</span>
                  <span className="text-[#5A6E90] text-sm">units</span>
                </div>
              </div>
            </div>
            
            <div className="bg-[#0C1221] border border-[#243050] p-6 rounded-2xl flex items-center gap-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#4285F4]/5 rounded-full -mr-10 -mt-10 blur-2xl pointer-events-none" />
              <div className="w-14 h-14 rounded-xl bg-[#1A263D] flex items-center justify-center shrink-0 border border-[#2E3C5C]">
                <Cube weight="duotone" className="w-7 h-7 text-[#4285F4]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#8B9FC4] uppercase tracking-wider mb-1">Total Moulds Needed</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-[#EEF3FF] font-mono tracking-tight">{totals.moulds.toLocaleString()}</span>
                  <span className="text-[#5A6E90] text-sm">boxes</span>
                </div>
              </div>
            </div>

            <div className="bg-[#0C1221] border border-[#243050] p-6 rounded-2xl flex items-center gap-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#EAB308]/5 rounded-full -mr-10 -mt-10 blur-2xl pointer-events-none" />
              <div className="w-14 h-14 rounded-xl bg-[#1A263D] flex items-center justify-center shrink-0 border border-[#2E3C5C]">
                <Fire weight="duotone" className="w-7 h-7 text-[#EAB308]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#8B9FC4] uppercase tracking-wider mb-1">Total Metal Req.</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-[#EEF3FF] font-mono tracking-tight">{totals.metal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  <span className="text-[#5A6E90] text-sm">kg</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 p-1 bg-[#050810] border border-[#243050] rounded-xl w-fit">
            {(['Core', 'Mould', 'Melt'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200",
                  activeTab === tab 
                    ? "bg-[#1A263D] text-[#EEF3FF] shadow-sm" 
                    : "text-[#8B9FC4] hover:text-[#EEF3FF] hover:bg-[#0C1221]"
                )}
              >
                {tab} Planning
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'Melt' ? (
            <div className="bg-[#050810] rounded-2xl">
              <MeltPlanningTab 
                defaultMetalQty={totals.metal} 
                defaultGrade={planningData.length > 0 ? planningData[0].productGrade : undefined} 
              />
            </div>
          ) : (
            <div className="border border-[#243050] rounded-2xl overflow-hidden bg-[#050810]">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-[#0C1221] border-b border-[#243050] text-[#8B9FC4] text-[11px] uppercase tracking-wider font-bold">
                    <tr>
                      <th className="px-6 py-4">Order No</th>
                      {activeTab === 'Mould' && <th className="px-6 py-4">Customer</th>}
                      <th className="px-6 py-4">Pattern Ref</th>
                      {activeTab === 'Core' && <th className="px-6 py-4">Core Box Code</th>}
                      {activeTab === 'Mould' && <th className="px-6 py-4">Product</th>}
                      {activeTab === 'Mould' && <th className="px-6 py-4 text-center">Cavities</th>}
                      {activeTab === 'Mould' && <th className="px-6 py-4 text-center">Order Qty</th>}
                      {activeTab === 'Mould' && <th className="px-6 py-4 text-right">Planned Qty</th>}
                      
                      {activeTab === 'Core' && <th className="px-6 py-4 text-center">Calc. Cores</th>}
                      {activeTab === 'Core' && <th className="px-6 py-4 text-right">Target Core Count</th>}
                      
                      {activeTab !== 'Core' && <th className="px-6 py-4 text-center">Calc. Moulds</th>}
                      {activeTab === 'Mould' && <th className="px-6 py-4 text-right">Target Mould Count</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#243050]">
                    {planningData.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-6 py-12 text-center">
                          <p className="text-[#8B9FC4] font-medium">No open sales orders found for planning.</p>
                        </td>
                      </tr>
                    ) : (
                      planningData.map((row) => (
                        <tr key={row.itemId} className="hover:bg-[#1A263D]/30 transition-colors">
                          <td className="px-6 py-4 font-bold text-[#EEF3FF]">{row.orderNo}</td>
                          {activeTab === 'Mould' && <td className="px-6 py-4 text-[#C4D2EE]">{row.customer}</td>}
                          <td className="px-6 py-4 font-mono text-[#8B9FC4]">{row.patternRef}</td>
                          {activeTab === 'Core' && <td className="px-6 py-4 font-mono text-[#8B9FC4]">{row.coreBoxCode}</td>}
                          {activeTab === 'Mould' && <td className="px-6 py-4 font-medium text-[#C4D2EE]">{row.productName}</td>}
                          {activeTab === 'Mould' && <td className="px-6 py-4 text-center text-[#8B9FC4]">{row.cavities}</td>}
                          {activeTab === 'Mould' && <td className="px-6 py-4 text-center text-[#8B9FC4]">{row.orderQty}</td>}
                          {activeTab === 'Mould' && (
                            <td className="px-6 py-4 text-right">
                              <EditableCell 
                                initialValue={row.plannedQty}
                                onSave={(val) => setPlannedQtyOverrides(prev => ({ ...prev, [row.itemId]: val }))}
                                className="h-8 w-24 px-2 ml-auto text-right bg-[#050810] border-[#243050] text-[#EEF3FF] focus:border-[#D4521A]"
                              />
                            </td>
                          )}
                          
                          {activeTab === 'Core' && <td className="px-6 py-4 text-center text-[#8B9FC4]">{row.calculatedCores}</td>}
                          {activeTab === 'Core' && (
                            <td className="px-6 py-4 text-right">
                              <EditableCell 
                                initialValue={row.finalCores}
                                onSave={(val) => setCoreOverrides(prev => ({ ...prev, [row.itemId]: val }))}
                                className="h-8 w-24 px-2 ml-auto text-right bg-[#050810] border-[#243050] text-[#EEF3FF] focus:border-[#D4521A]"
                              />
                            </td>
                          )}

                          {activeTab !== 'Core' && <td className="px-6 py-4 text-center text-[#8B9FC4]">{row.calculatedMoulds}</td>}
                          {activeTab === 'Mould' && (
                            <td className="px-6 py-4 text-right">
                              <EditableCell 
                                initialValue={row.finalMoulds}
                                onSave={(val) => setMouldOverrides(prev => ({ ...prev, [row.itemId]: val }))}
                                className="h-8 w-24 px-2 ml-auto text-right bg-[#050810] border-[#243050] text-[#EEF3FF] focus:border-[#D4521A]"
                              />
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
