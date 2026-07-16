'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Cube, CubeTransparent, Fire } from '@phosphor-icons/react'
import { Button } from '@/shared/ui/button'
import { Label } from '@/shared/ui/label'
import { useRole } from '@/shared/context/role-context'
import { cn } from '@/shared/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'

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
  const [activeTab, setActiveTab] = useState<'Summary' | 'Core' | 'Mould' | 'Melt' | 'Pour' | 'Knockout' | 'Actuals'>('Summary')
  const [splitUpStage, setSplitUpStage] = useState<'Core' | 'Mould' | 'Melt' | null>(null)
  const [summaryView, setSummaryView] = useState<'calendar' | 'list'>('calendar')

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
      const orderId = order.id || order._id

      // Resolve each cart line to its product/pattern/cavity-adjusted mould count first.
      // Cavities come from the pattern's own mapping for this product (how many of it
      // one pour of THIS mould yields), not the standalone product catalog's cavities
      // field - a product could theoretically be cast from different patterns with
      // different cavity counts, so the pattern mapping is the authoritative source.
      const cartItems = ((order.cart || []) as any[]).map((item: any, idx: number) => {
        const product = products.find((p: any) => p.name === item.productName || p.code === item.product)
        const pattern = patterns.find((p: any) => p.mappedProducts?.some((mp: any) => mp.name === product?.name))
        const mappedProduct = pattern?.mappedProducts?.find((mp: any) => mp.name === product?.name)
        const cavities = mappedProduct?.cavities || product?.cavities || 1
        const itemMoulds = Math.ceil(item.quantity / cavities)
        return { item, idx, product, pattern, mappedProduct, itemMoulds, uniqueId: `${orderId}-${idx}` }
      })

      // Group by pattern: multiple products mapped to the same pattern are cast
      // together in the same mould pour (one pour yields all of them at once, split
      // across their allotted cavities), so the pour count for the group is the max
      // across its products' individual requirements - not the sum. A pour count
      // summed per-product would double-count the same physical mould run.
      const groups = new Map<string, typeof cartItems>()
      cartItems.forEach(ci => {
        const key = ci.pattern ? `pattern:${ci.pattern.code}` : `item:${ci.uniqueId}`
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(ci)
      })

      groups.forEach(groupItems => {
        const pattern = groupItems[0].pattern
        const finalMoulds = Math.max(...groupItems.map(ci => ci.itemMoulds))
        // A core box is required per UNIT cast, not per mould pour - a mould with
        // multiple cavities still needs one core per cavity/unit, so core
        // requirement must scale with raw unit quantity, not the cavity-divided
        // mould count finalMoulds uses.
        const finalUnits = Math.max(...groupItems.map(ci => ci.item.quantity))
        const representativeId = groupItems[0].uniqueId
        const productName = Array.from(new Set(groupItems.map(ci => ci.item.productName))).join(', ')

        // MOULD
        const mouldScheduled = plans.filter(p => p.stage === 'Mould' && p.itemId === representativeId).reduce((sum, p) => sum + p.quantityScheduled, 0)
        mouldBacklog.push({
          itemId: representativeId, orderNo: order.customerOrderNo, patternRef: pattern?.code || '-', productName,
          totalRequired: finalMoulds, totalScheduled: mouldScheduled, unit: 'boxes'
        })

        // MELT
        const boxWeight = pattern?.totalWeight || 0
        const metalRequired = finalMoulds * boxWeight
        const meltScheduled = plans.filter(p => p.stage === 'Melt' && p.itemId === representativeId).reduce((sum, p) => sum + p.quantityScheduled, 0)
        meltBacklog.push({
          itemId: representativeId, orderNo: order.customerOrderNo, patternRef: pattern?.code || '-', productName,
          totalRequired: metalRequired, totalScheduled: meltScheduled, unit: 'kg'
        })

        // KNOCKOUT
        const pouredMoulds = plans.filter(p => p.stage === 'Melt' && p.itemId === representativeId).reduce((sum, p) => sum + (p.actualPouredMoulds || 0), 0)
        const knockoutScheduled = plans.filter(p => p.stage === 'Knockout' && p.itemId === representativeId).reduce((sum, p) => sum + p.quantityScheduled, 0)
        if (pouredMoulds > 0) {
          knockoutBacklog.push({
            itemId: representativeId, orderNo: order.customerOrderNo, patternRef: pattern?.code || '-', productName,
            totalRequired: pouredMoulds, totalScheduled: knockoutScheduled, unit: 'moulds'
          })
        }

        // CORE - sum every mapped product's core box requirements across the
        // group by code. Summed, not deduped by max: a core is consumed per
        // casting, so if two different products in the group happen to share
        // the same core box design (same code), each product's units still
        // each need their own core - 400 units of product A + 400 of product
        // B sharing one core box code means 800 cores total, not 400.
        const coreBoxReqs = new Map<string, number>() // code -> total cores required across the group
        let hasProductSpecificCoreBoxes = false
        groupItems.forEach(ci => {
          if (ci.mappedProduct?.selectedCoreBoxes?.length > 0) {
            hasProductSpecificCoreBoxes = true
            ci.mappedProduct.selectedCoreBoxes.forEach((cb: any) => {
              const code = cb.coreBoxCode || 'Unnamed Core Box'
              const qtyPerUnit = cb.quantity || 1
              coreBoxReqs.set(code, (coreBoxReqs.get(code) || 0) + ci.item.quantity * qtyPerUnit)
            })
          }
        })

        if (hasProductSpecificCoreBoxes) {
          coreBoxReqs.forEach((totalCoreRequired, codeToUse) => {
            const coreScheduled = plans.filter(p => p.stage === 'Core' && p.itemId === representativeId && p.coreBoxCode === codeToUse).reduce((sum, p) => sum + p.quantityScheduled, 0)
            coreBacklog.push({
              itemId: representativeId, orderNo: order.customerOrderNo, patternRef: pattern?.code || '-', productName, coreBoxCode: codeToUse,
              totalRequired: totalCoreRequired, totalScheduled: coreScheduled, unit: 'cores'
            })
          })
        } else if (pattern && pattern.sharedCoreBoxes && pattern.sharedCoreBoxes.length > 0) {
          pattern.sharedCoreBoxes.forEach((cb: any) => {
            const totalCoreRequired = finalUnits
            const codeToUse = cb.code || 'Unnamed Core Box'
            const coreScheduled = plans.filter(p => p.stage === 'Core' && p.itemId === representativeId && p.coreBoxCode === codeToUse).reduce((sum, p) => sum + p.quantityScheduled, 0)
            coreBacklog.push({
              itemId: representativeId, orderNo: order.customerOrderNo, patternRef: pattern.code, productName, coreBoxCode: codeToUse,
              totalRequired: totalCoreRequired, totalScheduled: coreScheduled, unit: 'cores'
            })
          })
        } else if (pattern && pattern.coreBoxes > 0) {
          const totalCoreRequired = finalUnits * pattern.coreBoxes
          const coreScheduled = plans.filter(p => p.stage === 'Core' && p.itemId === representativeId && p.coreBoxCode === 'Legacy').reduce((sum, p) => sum + p.quantityScheduled, 0)
          coreBacklog.push({
            itemId: representativeId, orderNo: order.customerOrderNo, patternRef: pattern.code, productName, coreBoxCode: 'Legacy',
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

  // Summary calendar - the Production Schedule page's calendar moved here, now
  // sourced straight from production_plans instead of the separate schedules
  // table, so it always matches what's actually been planned.
  const calendarDays = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
    const startDate = new Date(firstDay)
    startDate.setDate(firstDay.getDate() - startOffset)
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(startDate)
      d.setDate(startDate.getDate() + i)
      return d
    })
  }, [])

  const planningByDate = useMemo(() => {
    const map = new Map<string, { core: number, coreDone: number, mould: number, mouldDone: number, melt: number, meltDone: number }>()
    plans.forEach(p => {
      if (!['Core', 'Mould', 'Melt'].includes(p.stage)) return
      if (!map.has(p.date)) map.set(p.date, { core: 0, coreDone: 0, mould: 0, mouldDone: 0, melt: 0, meltDone: 0 })
      const entry = map.get(p.date)!
      const planned = Number(p.quantityScheduled) || 0
      const completed = Number(p.actualQuantity) || 0
      if (p.stage === 'Core') { entry.core += planned; entry.coreDone += completed }
      else if (p.stage === 'Mould') { entry.mould += planned; entry.mouldDone += completed }
      else if (p.stage === 'Melt') { entry.melt += planned; entry.meltDone += completed }
    })
    return map
  }, [plans])

  const handleSaveDayPlan = async (date: string, newPlans: any[]) => {
    try {
      for (const plan of newPlans) {
        const id = plan._id || plan.id
        if (plan._delete) {
          // Row was removed via the trash icon in the modal - it carries no
          // scheduled quantity to check, just delete its existing record.
          if (id) await fetch(`/api/production-plans/${id}`, { method: 'DELETE' })
          continue
        }
        if (id) {
          // Core/Mould no longer have an Actual-entry field, so `actualQuantity`
          // can never be set for them again - treating an unscheduled (0-hourly)
          // row as "delete this plan" would wipe existing rows any time hourly
          // cells are left empty, with no way to opt out. Melt/Knockout still
          // rely on this guard since their Actual-entry flow is unchanged.
          const usesActualSafetyValve = plan.stage !== 'Core' && plan.stage !== 'Mould'
          if (usesActualSafetyValve && plan.quantityScheduled === 0 && !plan.actualQuantity) {
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground font-heading mb-2">Production Planning</h1>
          <p className="text-[#64748B]">Schedule capacity and track requirements dynamically</p>
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
            <div 
              onClick={() => setSplitUpStage('Core')}
              className="bg-[#FFFFFF] border border-[#E0E7FF] hover:border-[#4285F4] p-6 rounded-2xl flex items-center gap-5 relative overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md"
            >
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
            
            <div 
              onClick={() => setSplitUpStage('Mould')}
              className="bg-[#FFFFFF] border border-[#E0E7FF] hover:border-[#4F46E5] p-6 rounded-2xl flex items-center gap-5 relative overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md"
            >
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

            <div 
              onClick={() => setSplitUpStage('Melt')}
              className="bg-[#FFFFFF] border border-[#E0E7FF] hover:border-[#EAB308] p-6 rounded-2xl flex items-center gap-5 relative overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md"
            >
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
            <div className="inline-flex bg-[#F8FAFC] p-1.5 rounded-full overflow-x-auto shadow-inner border border-[#E2E8F0]">
              {['Summary', 'Core', 'Mould', 'Melt', 'Pour', 'Knockout', 'Actuals'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={cn(
                    "px-8 py-2.5 text-sm font-bold transition-all duration-300 rounded-full whitespace-nowrap",
                    activeTab === tab 
                      ? "bg-[#4F46E5] text-white shadow-md shadow-[#4F46E5]/20" 
                      : "text-[#64748B] hover:text-[#4F46E5] hover:bg-[#EEF2FF]/50"
                  )}
                >
                  {tab === 'Summary' ? 'Summary' : tab === 'Actuals' ? 'Actuals' : `${tab} Planning`}
                </button>
              ))}
            </div>

            <div className="mt-4">
              {activeTab === 'Summary' && (
                <div className="space-y-6">
                  <div className="flex justify-end">
                    <div className="flex items-center gap-3 bg-[#FFFFFF] px-4 py-1.5 border border-[#E0E7FF] rounded-xl shadow-sm">
                      <Label htmlFor="summary-view-mode" className={cn("text-sm font-semibold cursor-pointer transition-colors duration-200", summaryView === 'calendar' ? 'text-[#172554]' : 'text-[#94A3B8]')} onClick={() => setSummaryView('calendar')}>Calendar</Label>
                      <div
                        className="w-12 h-6 bg-[#F4F6FB] rounded-full relative cursor-pointer border border-[#E0E7FF] shadow-inner transition-colors duration-200 hover:bg-[#EEF2FF]"
                        onClick={() => setSummaryView(v => v === 'calendar' ? 'list' : 'calendar')}
                      >
                        <div className={cn(
                          "w-4 h-4 bg-[#4F46E5] rounded-full absolute top-[3px] transition-all duration-300 shadow-sm",
                          summaryView === 'list' ? "left-[27px]" : "left-[3px]"
                        )} />
                      </div>
                      <Label htmlFor="summary-view-mode" className={cn("text-sm font-semibold cursor-pointer transition-colors duration-200", summaryView === 'list' ? 'text-[#172554]' : 'text-[#94A3B8]')} onClick={() => setSummaryView('list')}>List</Label>
                    </div>
                  </div>

                  {summaryView === 'calendar' ? (
                  <div className="bg-[#F4F6FB] border border-[#E0E7FF] rounded-xl p-4 overflow-x-auto">
                    <div>
                      <h3 className="text-[#172554] font-bold text-lg font-heading">Planning Calendar</h3>
                      <p className="text-[#64748B] text-xs mt-1">Core, Mould, and Melt quantities scheduled per day (completed / planned).</p>
                    </div>
                    <div className="grid grid-cols-7 mt-4 mb-2 min-w-[800px]">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                        <div key={day} className="py-2 text-center text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                          {day}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-3 min-w-[800px]">
                      {calendarDays.map((date, i) => {
                        const dateStr = date.toISOString().split('T')[0]
                        const isToday = new Date().toISOString().split('T')[0] === dateStr
                        const isCurrentMonth = date.getMonth() === new Date().getMonth()
                        const counts = planningByDate.get(dateStr)

                        return (
                          <div
                            key={i}
                            className={cn(
                              "min-h-[130px] bg-white p-2 rounded-[12px] border border-[#E0E7FF] flex flex-col gap-1",
                              !isCurrentMonth && "bg-[#F8FAFC]/50 opacity-70"
                            )}
                          >
                            <div className="flex justify-end w-full">
                              <span className={cn(
                                "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                                isToday ? "bg-[#4F46E5] text-white" : "text-[#64748B]"
                              )}>
                                {date.getDate()}
                              </span>
                            </div>

                            <div className="flex flex-col gap-1 mt-1">
                              {counts?.core ? (
                                <div className="flex items-center justify-between px-1.5 py-0.5 rounded-md">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                                    <span className="text-[10.5px] font-medium text-[#64748B]">Core</span>
                                  </div>
                                  <span className="text-[10.5px] font-bold text-[#0F172A]">
                                    {counts.coreDone} <span className="text-[#94A3B8] font-normal mx-0.5">/</span> {counts.core}
                                  </span>
                                </div>
                              ) : null}
                              {counts?.mould ? (
                                <div className="flex items-center justify-between px-1.5 py-0.5 rounded-md">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#4F46E5]" />
                                    <span className="text-[10.5px] font-medium text-[#64748B]">Mould</span>
                                  </div>
                                  <span className="text-[10.5px] font-bold text-[#0F172A]">
                                    {counts.mouldDone} <span className="text-[#94A3B8] font-normal mx-0.5">/</span> {counts.mould}
                                  </span>
                                </div>
                              ) : null}
                              {counts?.melt ? (
                                <div className="flex items-center justify-between px-1.5 py-0.5 rounded-md">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                    <span className="text-[10.5px] font-medium text-[#64748B]">Melt</span>
                                  </div>
                                  <span className="text-[10.5px] font-bold text-[#0F172A]">
                                    {counts.meltDone} <span className="text-[#94A3B8] font-normal mx-0.5">/</span> {counts.melt}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  ) : (
                <div className="space-y-6 bg-white p-6 rounded-2xl border border-[#E0E7FF] shadow-lg">
                  <div>
                    <h3 className="text-[#4F46E5] font-bold text-lg font-heading">Production Split-up Summary</h3>
                    <p className="text-[#64748B] text-xs mt-1">Overview of all active orders, pattern requirements, sand weights, and casting weights.</p>
                  </div>
                  <div className="border border-[#E0E7FF] rounded-xl overflow-x-auto shadow-sm">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                      <thead className="bg-[#F4F6FB] border-b border-[#E0E7FF] text-[#64748B] font-semibold text-xs uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-4">PO No</th>
                          <th className="px-6 py-4">Customer</th>
                          <th className="px-6 py-4">Pattern</th>
                          <th className="px-6 py-4">Core Box</th>
                          <th className="px-6 py-4 text-center">Moulds Req</th>
                          <th className="px-6 py-4 text-center">Cores Req</th>
                          <th className="px-6 py-4 text-right" style={{ textAlign: 'right' }}>Melting Weight</th>
                          <th className="px-6 py-4 text-right" style={{ textAlign: 'right' }}>Sand Weight</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E0E7FF]">
                        {(() => {
                          if (backlogData.Core.length === 0 && backlogData.Mould.length === 0) {
                            return (
                              <tr>
                                <td colSpan={8} className="px-6 py-8 text-center text-[#94A3B8] italic">No active production requirements found.</td>
                              </tr>
                            )
                          }
                          return backlogData.Core.map((item, index) => {
                            const order = openOrders.find(o => o.customerOrderNo === item.orderNo)
                            const mouldItem = backlogData.Mould.find(m => m.orderNo === item.orderNo && m.patternRef === item.patternRef)
                            
                            // Melting Weight
                            const pat = patterns.find(p => p.code === item.patternRef)
                            const totalWeight = pat?.totalWeight || 0
                            const mouldsReq = mouldItem?.totalRequired || 0
                            const meltWeightStr = totalWeight > 0 
                              ? `Unit: ${totalWeight} kg (Total: ${(totalWeight * mouldsReq).toFixed(1)} kg)` 
                              : '-'

                            // Sand Weight
                            const cb = pat?.sharedCoreBoxes?.find((s: any) => s.code === item.coreBoxCode)
                            const coreW = cb?.coreWeight || 0
                            const sandWeightStr = coreW > 0 
                              ? `Unit: ${coreW} kg (Total: ${(coreW * item.totalRequired).toFixed(1)} kg)` 
                              : '-'

                            return (
                              <tr key={index} className="hover:bg-[#F8FAFC]">
                                <td className="px-6 py-4 font-mono font-bold text-[#4285F4]">{item.orderNo}</td>
                                <td className="px-6 py-4 font-medium text-[#172554]">{order?.customer || '-'}</td>
                                <td className="px-6 py-4 font-semibold text-[#172554]">{item.patternRef}</td>
                                <td className="px-6 py-4 font-mono font-bold text-indigo-600">{item.coreBoxCode || '-'}</td>
                                <td className="px-6 py-4 text-center font-mono">{mouldsReq.toLocaleString()}</td>
                                <td className="px-6 py-4 text-center font-mono">{item.totalRequired.toLocaleString()}</td>
                                <td className="px-6 py-4 text-right font-mono text-xs text-[#64748B]" style={{ textAlign: 'right' }}>{meltWeightStr}</td>
                                <td className="px-6 py-4 text-right font-mono text-xs text-[#64748B]" style={{ textAlign: 'right' }}>{sandWeightStr}</td>
                              </tr>
                            )
                          })
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
                  )}
                </div>
              )}

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

              {activeTab === 'Actuals' && (
                <div className="space-y-6 bg-white p-6 rounded-2xl border border-[#E0E7FF] shadow-lg">
                  <div>
                    <h3 className="text-[#172554] font-bold text-lg font-heading">Production Actuals Log</h3>
                    <p className="text-[#64748B] text-xs mt-1">Tracks completed production quantities, planned targets, and variances per stage.</p>
                  </div>
                  <div className="border border-[#E0E7FF] rounded-xl overflow-x-auto shadow-sm">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                      <thead className="bg-[#F4F6FB] border-b border-[#E0E7FF] text-[#64748B] font-semibold text-xs uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-4">Date</th>
                          <th className="px-6 py-4">PO No</th>
                          <th className="px-6 py-4">Pattern</th>
                          <th className="px-6 py-4">Stage</th>
                          <th className="px-6 py-4">Core Box / Info</th>
                          <th className="px-6 py-4 text-center">Planned Qty</th>
                          <th className="px-6 py-4 text-center">Actual Qty</th>
                          <th className="px-6 py-4 text-center">Variance</th>
                          <th className="px-6 py-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E0E7FF]">
                        {(() => {
                          const plansWithActuals = plans.filter(p => p.quantityScheduled > 0 || p.actualQuantity !== undefined)
                          if (plansWithActuals.length === 0) {
                            return (
                              <tr>
                                <td colSpan={9} className="px-6 py-8 text-center text-[#94A3B8] italic">No logged plans or actuals found.</td>
                              </tr>
                            )
                          }
                          return plansWithActuals.map((plan, index) => {
                            const order = orders.find(o => o.id === plan.orderId)
                            const actual = plan.actualQuantity || 0
                            const variance = actual - plan.quantityScheduled
                            const status = plan.isConfirmed ? 'Confirmed' : 'Draft'
                            
                            return (
                              <tr key={index} className="hover:bg-[#F8FAFC]">
                                <td className="px-6 py-4 font-mono font-medium">{plan.date}</td>
                                <td className="px-6 py-4 font-mono text-[#4285F4]">{order?.customerOrderNo || 'N/A'}</td>
                                <td className="px-6 py-4 font-semibold">{plan.patternRef || '-'}</td>
                                <td className="px-6 py-4">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                    plan.stage === 'Core' ? "bg-indigo-100 text-indigo-800" :
                                    plan.stage === 'Mould' ? "bg-blue-100 text-blue-800" :
                                    plan.stage === 'Melt' ? "bg-amber-100 text-amber-800" :
                                    "bg-purple-100 text-purple-800"
                                  )}>
                                    {plan.stage}
                                  </span>
                                </td>
                                <td className="px-6 py-4 font-mono text-gray-500">{plan.coreBoxCode || '-'}</td>
                                <td className="px-6 py-4 text-center font-mono">{plan.quantityScheduled}</td>
                                <td className="px-6 py-4 text-center font-mono font-semibold text-emerald-600">{actual}</td>
                                <td className={cn(
                                  "px-6 py-4 text-center font-mono font-semibold",
                                  variance < 0 ? "text-rose-500" : variance > 0 ? "text-emerald-500" : "text-gray-500"
                                )}>
                                  {variance > 0 ? `+${variance}` : variance}
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-full text-xs font-medium border",
                                    plan.isConfirmed 
                                      ? "bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20" 
                                      : "bg-amber-100 text-amber-800 border-amber-200"
                                  )}>
                                    {status}
                                  </span>
                                </td>
                              </tr>
                            )
                          })
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Split-up Dialog */}
          <Dialog open={!!splitUpStage} onOpenChange={() => setSplitUpStage(null)}>
            <DialogContent className="bg-[#FFFFFF] border-[#E0E7FF] text-[#172554] w-[95vw] max-w-6xl sm:max-w-6xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl font-heading font-bold text-[#172554]">
                  {splitUpStage === 'Core' ? 'Cores Split-up' : splitUpStage === 'Mould' ? 'Moulds Split-up' : 'Metal Requirements Split-up'}
                </DialogTitle>
              </DialogHeader>

              <div className="py-4">
                <div className="border border-[#E0E7FF] rounded-xl overflow-x-auto shadow-sm">
                  <table className="min-w-full text-sm text-left whitespace-nowrap">
                    <thead className="bg-[#F4F6FB] border-b border-[#E0E7FF] text-[#64748B] font-semibold text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4">Purchase Order</th>
                        <th className="px-6 py-4">Pattern Ref</th>
                        {splitUpStage === 'Core' && <th className="px-6 py-4">Core Box Code</th>}
                        <th className="px-6 py-4 text-center">Required</th>
                        <th className="px-6 py-4 text-center">Scheduled</th>
                        <th className="px-6 py-4 text-center">Remaining</th>
                        {splitUpStage === 'Core' && <th className="px-6 py-4 text-right" style={{ textAlign: 'right' }}>Sand Weight</th>}
                        {splitUpStage === 'Mould' && <th className="px-6 py-4 text-right" style={{ textAlign: 'right' }}>Melting Weight</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E0E7FF]">
                      {(() => {
                        const data = splitUpStage === 'Core' ? backlogData.Core : splitUpStage === 'Mould' ? backlogData.Mould : backlogData.Melt
                        if (data.length === 0) {
                          return (
                            <tr>
                              <td colSpan={8} className="px-6 py-8 text-center text-[#94A3B8] italic">No requirements.</td>
                            </tr>
                          )
                        }
                        return data.map((item, index) => {
                          const remaining = Math.max(0, item.totalRequired - item.totalScheduled)
                          
                          // Calculate weights for display
                          let weightText = '-'
                          if (splitUpStage === 'Core') {
                            const pat = patterns.find(p => p.code === item.patternRef)
                            const cb = pat?.sharedCoreBoxes?.find((s: any) => s.code === item.coreBoxCode)
                            const w = cb?.coreWeight || 0
                            if (w > 0) {
                              weightText = `Unit: ${w} kg (Total: ${(w * item.totalRequired).toFixed(1)} kg)`
                            }
                          } else if (splitUpStage === 'Mould') {
                            const pat = patterns.find(p => p.code === item.patternRef)
                            const w = pat?.totalWeight || 0
                            if (w > 0) {
                              weightText = `Unit: ${w} kg (Total: ${(w * item.totalRequired).toFixed(1)} kg)`
                            }
                          }

                          return (
                            <tr key={index} className="hover:bg-[#F8FAFC]">
                              <td className="px-6 py-4 font-semibold font-mono text-[#4285F4]">{item.orderNo}</td>
                              <td className="px-6 py-4 font-medium">{item.patternRef}</td>
                              {splitUpStage === 'Core' && <td className="px-6 py-4 font-mono font-medium text-indigo-600">{item.coreBoxCode}</td>}
                              <td className="px-6 py-4 text-center font-mono font-semibold">{item.totalRequired.toLocaleString()} {item.unit}</td>
                              <td className="px-6 py-4 text-center font-mono text-gray-500">{item.totalScheduled.toLocaleString()} {item.unit}</td>
                              <td className="px-6 py-4 text-center font-mono font-semibold text-[#4285F4]">{remaining.toLocaleString()} {item.unit}</td>
                              {(splitUpStage === 'Core' || splitUpStage === 'Mould') && <td className="px-6 py-4 text-right text-xs font-mono text-[#64748B]" style={{ textAlign: 'right' }}>{weightText}</td>}
                            </tr>
                          )
                        })
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}
