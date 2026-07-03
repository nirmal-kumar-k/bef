'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Cube, CubeTransparent, Fire } from '@phosphor-icons/react'
import { Button } from '@/shared/ui/button'
import { Label } from '@/shared/ui/label'
import { useRole } from '@/shared/context/role-context'
import { cn } from '@/shared/lib/utils'

import { BacklogItem } from '@/modules/production/presentation/daily-planning-modal'
import { CorePlanningTab } from '@/modules/production/presentation/core-planning-tab'
import { MouldPlanningTab } from '@/modules/production/presentation/mould-planning-tab'
import { MeltPlanningTab } from '@/modules/production/presentation/melt-planning-tab'
import { PourPlanningTab } from '@/modules/production/presentation/pour-planning-tab'
import { KnockoutPlanningTab } from '@/modules/production/presentation/knockout-planning-tab'

export default function ProductionPlanningPage() {
  const { role } = useRole()
  const router = useRouter()
  
  const [orders, setOrders] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [patterns, setPatterns] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'Core' | 'Mould' | 'Melt' | 'Pour' | 'Knockout'>('Core')

  const fetchData = useCallback(async () => {
    try {
      const [orderRes, prodRes, patRes, planRes] = await Promise.all([
        fetch('/api/orders'),
        fetch('/api/products'),
        fetch('/api/patterns'),
        fetch('/api/production-plans')
      ])
      
      if (orderRes.ok && prodRes.ok && patRes.ok && planRes.ok) {
        setOrders(await orderRes.json())
        setProducts(await prodRes.json())
        setPatterns(await patRes.json())
        setPlans(await planRes.json())
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
  const backlogData = useMemo(() => {
    const coreBacklog: BacklogItem[] = []
    const mouldBacklog: BacklogItem[] = []
    const meltBacklog: BacklogItem[] = []
    const knockoutBacklog: BacklogItem[] = []
    
    openOrders.forEach(order => {
      order.cart?.forEach((item: any, idx: number) => {
        const uniqueId = `${order.id || order._id}-${idx}`
        const product = products.find(p => p.name === item.productName || p.code === item.product)
        const pattern = patterns.find(p => p.mappedProducts?.some((mp: any) => mp.name === product?.name))
        
        const cavities = product?.cavities || 1
        const plannedQty = item.quantity
        const finalMoulds = Math.ceil(plannedQty / cavities)
        
        // MOULD
        const mouldScheduled = plans.filter(p => p.stage === 'Mould' && p.itemId === uniqueId).reduce((sum, p) => sum + p.quantityScheduled, 0)
        mouldBacklog.push({
          itemId: uniqueId, orderNo: order.customerOrderNo, patternRef: pattern?.code || '-', productName: item.productName,
          totalRequired: finalMoulds, totalScheduled: mouldScheduled, unit: 'boxes'
        })

        // MELT
        const castingWeight = pattern?.goodWeight || pattern?.totalWeight || 0
        const metalRequired = finalMoulds * castingWeight
        const meltScheduled = plans.filter(p => p.stage === 'Melt' && p.itemId === uniqueId).reduce((sum, p) => sum + p.quantityScheduled, 0)
        meltBacklog.push({
          itemId: uniqueId, orderNo: order.customerOrderNo, patternRef: pattern?.code || '-', productName: item.productName,
          totalRequired: metalRequired, totalScheduled: meltScheduled, unit: 'kg'
        })
        
        // KNOCKOUT
        const pouredMoulds = plans.filter(p => p.stage === 'Melt' && p.itemId === uniqueId).reduce((sum, p) => sum + (p.actualPouredMoulds || 0), 0)
        const knockoutScheduled = plans.filter(p => p.stage === 'Knockout' && p.itemId === uniqueId).reduce((sum, p) => sum + p.quantityScheduled, 0)
        if (pouredMoulds > 0) {
          knockoutBacklog.push({
            itemId: uniqueId, orderNo: order.customerOrderNo, patternRef: pattern?.code || '-', productName: item.productName,
            totalRequired: pouredMoulds, totalScheduled: knockoutScheduled, unit: 'moulds'
          })
        }

        // CORE
        const mappedProduct = pattern?.mappedProducts?.find((mp: any) => mp.name === product?.name)
        if (mappedProduct && mappedProduct.selectedCoreBoxes && mappedProduct.selectedCoreBoxes.length > 0) {
          mappedProduct.selectedCoreBoxes.forEach((cb: any) => {
            const qtyPerMould = cb.quantity || 1
            const totalCoreRequired = finalMoulds * qtyPerMould
            const codeToUse = cb.coreBoxCode || 'Unnamed Core Box'
            const coreScheduled = plans.filter(p => p.stage === 'Core' && p.itemId === uniqueId && p.coreBoxCode === codeToUse).reduce((sum, p) => sum + p.quantityScheduled, 0)
            coreBacklog.push({
              itemId: uniqueId, orderNo: order.customerOrderNo, patternRef: pattern?.code || '-', productName: item.productName, coreBoxCode: codeToUse,
              totalRequired: totalCoreRequired, totalScheduled: coreScheduled, unit: 'cores'
            })
          })
        } else if (pattern && pattern.sharedCoreBoxes && pattern.sharedCoreBoxes.length > 0) {
          pattern.sharedCoreBoxes.forEach((cb: any) => {
            const qtyPerMould = 1
            const totalCoreRequired = finalMoulds * qtyPerMould
            const codeToUse = cb.code || 'Unnamed Core Box'
            const coreScheduled = plans.filter(p => p.stage === 'Core' && p.itemId === uniqueId && p.coreBoxCode === codeToUse).reduce((sum, p) => sum + p.quantityScheduled, 0)
            coreBacklog.push({
              itemId: uniqueId, orderNo: order.customerOrderNo, patternRef: pattern.code, productName: item.productName, coreBoxCode: codeToUse,
              totalRequired: totalCoreRequired, totalScheduled: coreScheduled, unit: 'cores'
            })
          })
        } else if (pattern && pattern.coreBoxes > 0) {
          const totalCoreRequired = finalMoulds * pattern.coreBoxes
          const coreScheduled = plans.filter(p => p.stage === 'Core' && p.itemId === uniqueId && p.coreBoxCode === 'Legacy').reduce((sum, p) => sum + p.quantityScheduled, 0)
          coreBacklog.push({
            itemId: uniqueId, orderNo: order.customerOrderNo, patternRef: pattern.code, productName: item.productName, coreBoxCode: 'Legacy',
            totalRequired: totalCoreRequired, totalScheduled: coreScheduled, unit: 'cores'
          })
        }
      })
    })
    
    return { Core: coreBacklog, Mould: mouldBacklog, Melt: meltBacklog, Knockout: knockoutBacklog }
  }, [openOrders, products, patterns, plans])

  const totals = useMemo(() => {
    return {
      cores: backlogData.Core.reduce((acc, curr) => acc + curr.totalRequired, 0),
      moulds: backlogData.Mould.reduce((acc, curr) => acc + curr.totalRequired, 0),
      metal: backlogData.Melt.reduce((acc, curr) => acc + curr.totalRequired, 0),
      knockouts: backlogData.Knockout.reduce((acc, curr) => acc + curr.totalRequired, 0)
    }
  }, [backlogData])

  const handleSaveDayPlan = async (date: string, newPlans: any[]) => {
    try {
      for (const plan of newPlans) {
        const id = plan._id || plan.id
        if (id) {
          if (plan.quantityScheduled === 0 && !plan.actualQuantity) {
            // Delete
            await fetch(`/api/production-plans/${id}`, { method: 'DELETE' })
          } else {
            // Update
            await fetch(`/api/production-plans/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...plan, date: plan.date || date })
            })
          }
        } else {
          // Create
          await fetch('/api/production-plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...plan, date: plan.date || date })
          })
        }
      }
      
      // Re-fetch all plans to keep frontend perfectly in sync with backend
      const res = await fetch('/api/production-plans')
      if (res.ok) {
        setPlans(await res.json())
      }
    } catch (err) {
      console.error('Failed to save day plan:', err)
    }
  }

  return (
    <div className="space-y-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#172554] font-heading tracking-tight">Production Planning</h1>
          <p className="text-[#64748B] mt-1 text-sm">Schedule capacity and track requirements dynamically</p>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <p className="text-[#64748B] text-lg animate-pulse">Loading planning data...</p>
        </div>
      ) : (
        <>
          {/* Overview Cards (Always Visible) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#FFFFFF] border border-[#E0E7FF] p-6 rounded-2xl flex items-center gap-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#4285F4]/5 rounded-full -mr-10 -mt-10 blur-2xl pointer-events-none" />
              <div className="w-14 h-14 rounded-xl bg-[#EEF2FF] flex items-center justify-center shrink-0 border border-[#C7D2FE]">
                <CubeTransparent weight="duotone" className="w-7 h-7 text-[#4285F4]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#64748B] uppercase tracking-wider mb-1">Total Cores Needed</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-[#172554] font-mono tracking-tight">{totals.cores.toLocaleString()}</span>
                </div>
              </div>
            </div>
            
            <div className="bg-[#FFFFFF] border border-[#E0E7FF] p-6 rounded-2xl flex items-center gap-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#4F46E5]/5 rounded-full -mr-10 -mt-10 blur-2xl pointer-events-none" />
              <div className="w-14 h-14 rounded-xl bg-[#EEF2FF] flex items-center justify-center shrink-0 border border-[#C7D2FE]">
                <Cube weight="duotone" className="w-7 h-7 text-[#4F46E5]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#64748B] uppercase tracking-wider mb-1">Total Moulds Needed</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-[#172554] font-mono tracking-tight">{totals.moulds.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#FFFFFF] border border-[#E0E7FF] p-6 rounded-2xl flex items-center gap-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#EAB308]/5 rounded-full -mr-10 -mt-10 blur-2xl pointer-events-none" />
              <div className="w-14 h-14 rounded-xl bg-[#EEF2FF] flex items-center justify-center shrink-0 border border-[#C7D2FE]">
                <Fire weight="duotone" className="w-7 h-7 text-[#EAB308]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#64748B] uppercase tracking-wider mb-1">Total Metal Req.</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-[#172554] font-mono tracking-tight">{totals.metal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  <span className="text-[#94A3B8] text-sm">kg</span>
                </div>
              </div>
            </div>
          </div>

          {/* TAB CONTENT */}
          <div className="space-y-6">
            <div className="flex border-b border-[#E0E7FF] overflow-x-auto">
              {['Core', 'Mould', 'Melt', 'Pour', 'Knockout'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-6 py-2.5 text-sm font-semibold transition-all duration-200 border-b-2",
                    activeTab === tab 
                      ? "bg-[#EEF2FF] text-[#172554] shadow-sm" 
                      : "text-[#64748B] hover:text-[#172554] hover:bg-[#FFFFFF]"
                  )}
                >
                  {tab} Planning
                </button>
              ))}
            </div>

            <div className="mt-4">
              {activeTab === 'Core' && (
                <CorePlanningTab coreBacklog={backlogData.Core} patterns={patterns} openOrders={openOrders} dailyPlans={plans} onSaveDayPlan={handleSaveDayPlan} />
              )}
              {activeTab === 'Mould' && (
                <MouldPlanningTab mouldBacklog={backlogData.Mould} patterns={patterns} openOrders={openOrders} dailyPlans={plans} onSaveDayPlan={handleSaveDayPlan} />
              )}
              {activeTab === 'Melt' && (
                <MeltPlanningTab defaultMetalQty={totals.metal} products={products} patterns={patterns} openOrders={openOrders} dailyPlans={plans} onSaveDayPlan={handleSaveDayPlan} />
              )}
              {activeTab === 'Pour' && (
                <PourPlanningTab patterns={patterns} openOrders={openOrders} dailyPlans={plans} onSaveDayPlan={handleSaveDayPlan} />
              )}
              {activeTab === 'Knockout' && (
                <KnockoutPlanningTab knockoutBacklog={backlogData.Knockout} patterns={patterns} openOrders={openOrders} dailyPlans={plans} onSaveDayPlan={handleSaveDayPlan} />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
