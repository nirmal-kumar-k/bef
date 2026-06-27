'use client'

import { useState, useMemo } from 'react'
import { CheckCircle, MagnifyingGlass, Fire } from '@phosphor-icons/react'
import { Badge } from '@/shared/ui/badge'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { cn } from '@/shared/lib/utils'

// Shared Configuration
const RECIPES: Record<string, { pigIron: number, scrap: number, feMn: number, carburizer: number }> = {
  'FC 200': { pigIron: 35, scrap: 60, feMn: 2, carburizer: 3 },
  'FC 250': { pigIron: 35, scrap: 60, feMn: 2, carburizer: 3 },
  'FC 300': { pigIron: 35, scrap: 60, feMn: 2, carburizer: 3 },
  'FC 350': { pigIron: 30, scrap: 65, feMn: 2, carburizer: 3 },
  'SG 400': { pigIron: 45, scrap: 47, feMn: 3, carburizer: 5 },
  'SG 500': { pigIron: 45, scrap: 47, feMn: 3, carburizer: 5 },
  'SG 600': { pigIron: 50, scrap: 42, feMn: 3, carburizer: 5 },
}

export function PourPlanningTab({ patterns, openOrders, dailyPlans }: any) {
  const [selectedHeatId, setSelectedHeatId] = useState<string>('')

  // Build a rich list of heats with product details for searching/display
  const heats = useMemo(() => {
    const meltPlans = dailyPlans.filter((p: any) => p.stage === 'Melt')
    return meltPlans.map((heat: any) => {
      const order = openOrders.find((o: any) => o.id === heat.orderId || o.customerOrderNo === heat.orderNo)
      let prodName = 'N/A', patternRef = 'N/A', moulds = 0, coreBoxRef = 'N/A', cavities = 1
      
      if (order && order.cart && order.cart.length > 0) {
        // Find the specific item if heat is linked to one, otherwise default to first
        const item = order.cart.find((i: any) => `${order.id || order._id}-${order.cart.indexOf(i)}` === heat.itemId) || order.cart[0]
        prodName = item.productName || 'N/A'
        
        const pattern = patterns.find((p: any) => p.mappedProducts?.some((mp: any) => mp.name === prodName))
        if (pattern) {
          patternRef = pattern.code
          const mp = pattern.mappedProducts.find((m: any) => m.name === prodName)
          cavities = mp?.cavities || 1
          moulds = Math.ceil((item.quantity || 1) / cavities)
          coreBoxRef = mp?.selectedCoreBoxes?.[0]?.coreBoxCode || 'Legacy'
        }
      }
      
      return {
        ...heat,
        prodName,
        patternRef,
        moulds,
        coreBoxRef,
        cavities,
        uid: heat.itemId || heat.heatNo
      }
    })
  }, [dailyPlans, openOrders, patterns])

  const selectedHeat = heats.find(h => h.uid === selectedHeatId)

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="bg-[#0C1221] border border-[#243050] p-6 rounded-xl space-y-4 shadow-sm">
        <Label className="text-[#8B9FC4] text-xs font-bold uppercase tracking-wider">Search Heat or Product to Pour</Label>
        <div className="relative">
          <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5A6E90]" />
          {/* Note: In a real app we'd use a Command or autocomplete for dual-search, but Select works well for demo given the list size */}
          <Select value={selectedHeatId} onValueChange={setSelectedHeatId}>
            <SelectTrigger className="w-full pl-12 h-12 bg-[#050810] border-[#243050] text-[#EEF3FF] text-base rounded-lg">
              <SelectValue placeholder="Select a planned heat..." />
            </SelectTrigger>
            <SelectContent className="bg-[#0C1221] border-[#243050] max-h-80">
              {heats.map(h => (
                <SelectItem key={h.uid} value={h.uid} className="text-[#EEF3FF] hover:bg-[#1A263D] py-3">
                  <div className="flex flex-col">
                    <span className="font-mono font-bold text-[#EEF3FF]">{h.heatNo || 'H---'}</span>
                    <span className="text-[#8B9FC4] text-xs mt-0.5">{h.prodName} &bull; {h.date}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedHeat ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#050810] border border-[#243050] rounded-xl flex flex-col overflow-hidden shadow-2xl">
              {/* Header */}
              <div className="p-6 border-b border-[#243050] bg-[#0C1221] flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#D4521A]/10 flex items-center justify-center border border-[#D4521A]/20">
                    <Fire className="w-5 h-5 text-[#D4521A]" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold font-mono text-[#EEF3FF]">{selectedHeat.heatNo || 'H---'}</h2>
                    <p className="text-[#8B9FC4] text-sm font-mono mt-0.5">Planned for {selectedHeat.date}</p>
                  </div>
                </div>
                <Badge variant="outline" className="px-3 py-1.5 border-[#D4521A]/30 text-[#D4521A] bg-[#D4521A]/10 text-sm">
                  {selectedHeat.grade || 'FC 200'}
                </Badge>
              </div>

              {/* Pouring Details Table */}
              <div className="p-6">
                <Label className="text-xs font-bold text-[#5A6E90] uppercase tracking-wider mb-4 block">POURING DETAILS</Label>
                <div className="bg-[#0C1221] border border-[#243050] rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-[#1A263D]/50 border-b border-[#243050] text-[#8B9FC4] text-xs">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Product Name</th>
                        <th className="px-4 py-3 font-semibold">Core Box Ref</th>
                        <th className="px-4 py-3 font-semibold text-center">Cavities</th>
                        <th className="px-4 py-3 font-semibold text-right">Moulds to Pour</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#243050]">
                      <tr className="hover:bg-[#1A263D]/30 transition-colors">
                        <td className="px-4 py-4 font-medium text-[#EEF3FF]">{selectedHeat.prodName}</td>
                        <td className="px-4 py-4 font-mono text-[#8B9FC4]">{selectedHeat.coreBoxRef}</td>
                        <td className="px-4 py-4 text-center font-mono text-[#5A6E90]">{selectedHeat.cavities}</td>
                        <td className="px-4 py-4 text-right font-mono font-bold text-[#4285F4] text-lg">{selectedHeat.moulds}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-[#050810] border border-[#243050] rounded-xl flex flex-col overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-[#243050] bg-[#0C1221]">
                <Label className="text-xs font-bold text-[#5A6E90] uppercase tracking-wider">CHARGE PLAN</Label>
                <p className="text-[#8B9FC4] text-xs mt-1">Material requirements for this heat</p>
              </div>
              
              <div className="p-6 space-y-4">
                {(() => {
                  const rec = RECIPES[selectedHeat.grade] || RECIPES['FC 200']
                  const weight = selectedHeat.quantityScheduled || selectedHeat.meltWeight || 150
                  return (
                    <>
                      <div className="flex justify-between items-center text-sm p-3 rounded-lg bg-[#0C1221] border border-[#243050]/50">
                        <span className="text-[#8B9FC4] font-medium">Pig Iron</span>
                        <span className="font-mono text-[#EEF3FF] font-bold">{(weight * rec.pigIron / 100).toFixed(1)} kg <span className="text-[#5A6E90] font-normal text-xs ml-1">({rec.pigIron}%)</span></span>
                      </div>
                      <div className="flex justify-between items-center text-sm p-3 rounded-lg bg-[#0C1221] border border-[#243050]/50">
                        <span className="text-[#8B9FC4] font-medium">Scrap</span>
                        <span className="font-mono text-[#EEF3FF] font-bold">{(weight * rec.scrap / 100).toFixed(1)} kg <span className="text-[#5A6E90] font-normal text-xs ml-1">({rec.scrap}%)</span></span>
                      </div>
                      <div className="flex justify-between items-center text-sm p-3 rounded-lg bg-[#0C1221] border border-[#243050]/50">
                        <span className="text-[#8B9FC4] font-medium">FeMn</span>
                        <span className="font-mono text-[#EEF3FF] font-bold">{(weight * rec.feMn / 100).toFixed(1)} kg <span className="text-[#5A6E90] font-normal text-xs ml-1">({rec.feMn}%)</span></span>
                      </div>
                      <div className="flex justify-between items-center text-sm p-3 rounded-lg bg-[#0C1221] border border-[#243050]/50">
                        <span className="text-[#8B9FC4] font-medium">Carburizer</span>
                        <span className="font-mono text-[#EEF3FF] font-bold">{(weight * rec.carburizer / 100).toFixed(1)} kg <span className="text-[#5A6E90] font-normal text-xs ml-1">({rec.carburizer}%)</span></span>
                      </div>
                      <div className="pt-4 mt-4 border-t border-[#243050] flex justify-between items-center px-1">
                        <span className="text-[#EEF3FF] font-bold text-sm uppercase tracking-wider">Total Melt Weight</span>
                        <span className="font-mono text-[#D4521A] font-bold text-xl">{weight.toFixed(1)} kg</span>
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-20 text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-[#1A263D] flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-[#5A6E90]" />
          </div>
          <div>
            <p className="text-[#EEF3FF] font-semibold text-lg">Select a Heat to View Details</p>
            <p className="text-[#8B9FC4] text-sm mt-1">Search by heat number or product name above to display pouring specifications.</p>
          </div>
        </div>
      )}
    </div>
  )
}
