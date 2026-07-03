'use client'

import { useState, useMemo } from 'react'
import { MagnifyingGlass, Printer, CheckCircle, Clock, CaretRight } from '@phosphor-icons/react'
import { Badge } from '@/shared/ui/badge'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'

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

  const heats = useMemo(() => {
    const meltPlans = dailyPlans.filter((p: any) => p.stage === 'Melt')
    return meltPlans.map((heat: any) => {
      const order = openOrders.find((o: any) => o.id === heat.orderId || o.customerOrderNo === heat.orderNo)
      let prodName = 'N/A', patternRef = 'N/A', moulds = 0, coreBoxRef = 'N/A', cavities = 1
      
      if (order && order.cart && order.cart.length > 0) {
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

  // Default to first heat if available
  const selectedHeat = heats.find(h => h.uid === selectedHeatId) || heats[0]

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="relative">
        <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748B] z-10" />
        <Select value={selectedHeatId} onValueChange={setSelectedHeatId}>
          <SelectTrigger className="w-full pl-12 h-14 bg-[#F4F6FB] border-[#E0E7FF] text-[#172554] text-lg rounded-xl shadow-sm">
            <SelectValue placeholder="Search by Heat Number or Product..." />
          </SelectTrigger>
          <SelectContent className="bg-[#FFFFFF] border-[#E0E7FF] max-h-80">
            {heats.map(h => (
              <SelectItem key={h.uid} value={h.uid} className="text-[#172554] hover:bg-[#EEF2FF] py-3 cursor-pointer">
                <div className="flex flex-col">
                  <span className="font-mono font-bold text-[#172554]">{h.heatNo || 'H---'}</span>
                  <span className="text-[#64748B] text-xs mt-0.5">{h.prodName} &bull; {h.date}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedHeat ? (
        <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in duration-300">
          
          {/* Main Content Area (~75%) */}
          <div className="flex-[3] space-y-6 bg-[#F4F6FB] border border-[#E0E7FF] rounded-xl overflow-hidden shadow-2xl">
            
            <div className="p-8 pb-6">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-4">
                    <h1 className="text-4xl font-bold font-heading tracking-tight text-[#4F46E5]">
                      {selectedHeat.heatNo || 'H---'}
                    </h1>
                    <Badge variant="outline" className="border-[#4F46E5] text-[#4F46E5] bg-[#4F46E5]/10 text-sm py-1">
                      GRADE {selectedHeat.grade || 'FC 200'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-3 text-[#64748B] text-sm font-medium">
                    <Clock weight="fill" className="w-4 h-4" />
                    <span>Scheduled Pour: {selectedHeat.date} 14:30 | Furnace Unit A</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Button variant="outline" className="border-[#E0E7FF] text-[#64748B] hover:text-[#172554] hover:bg-[#FFFFFF] bg-transparent">
                    <Printer className="w-4 h-4 mr-2" />
                    Print Ticket
                  </Button>
                  <Button className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white font-bold shadow-lg shadow-[#4F46E5]/20">
                    <CheckCircle weight="bold" className="w-4 h-4 mr-2" />
                    Approve Charge
                  </Button>
                </div>
              </div>
            </div>

            <div className="h-[1px] w-full bg-[#4F46E5]/30" />

            <div className="p-8 space-y-8">
              {/* Charge Plan Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-bold font-heading text-[#172554]">Charge Plan</h2>
                  <Badge variant="outline" className="bg-[#EEF2FF] border-[#E0E7FF] text-[#4285F4]">Final</Badge>
                </div>
                
                <div className="bg-[#FFFFFF] border border-[#E0E7FF] rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-[#F4F6FB] border-b border-[#E0E7FF] text-[#64748B] text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4 font-semibold">Material</th>
                        <th className="px-6 py-4 font-semibold text-right">Weight (kg)</th>
                        <th className="px-6 py-4 font-semibold text-right">Ratio (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E0E7FF]">
                      {(() => {
                        const rec = RECIPES[selectedHeat.grade] || RECIPES['FC 200']
                        const weight = selectedHeat.quantityScheduled || selectedHeat.meltWeight || 150
                        return (
                          <>
                            <tr className="hover:bg-[#EEF2FF]/30 transition-colors">
                              <td className="px-6 py-4 font-medium text-[#172554] flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-[#4F46E5]" />
                                Pig Iron
                              </td>
                              <td className="px-6 py-4 text-right font-mono text-[#64748B]">{(weight * rec.pigIron / 100).toFixed(1)}</td>
                              <td className="px-6 py-4 text-right font-mono text-[#94A3B8]">{rec.pigIron}%</td>
                            </tr>
                            <tr className="hover:bg-[#EEF2FF]/30 transition-colors">
                              <td className="px-6 py-4 font-medium text-[#172554] flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-[#4F46E5]" />
                                Scrap
                              </td>
                              <td className="px-6 py-4 text-right font-mono text-[#64748B]">{(weight * rec.scrap / 100).toFixed(1)}</td>
                              <td className="px-6 py-4 text-right font-mono text-[#94A3B8]">{rec.scrap}%</td>
                            </tr>
                            <tr className="hover:bg-[#EEF2FF]/30 transition-colors">
                              <td className="px-6 py-4 font-medium text-[#172554] flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-[#4285F4]" />
                                FeMn
                              </td>
                              <td className="px-6 py-4 text-right font-mono text-[#64748B]">{(weight * rec.feMn / 100).toFixed(1)}</td>
                              <td className="px-6 py-4 text-right font-mono text-[#94A3B8]">{rec.feMn}%</td>
                            </tr>
                            <tr className="hover:bg-[#EEF2FF]/30 transition-colors">
                              <td className="px-6 py-4 font-medium text-[#172554] flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-[#4285F4]" />
                                Carburizer
                              </td>
                              <td className="px-6 py-4 text-right font-mono text-[#64748B]">{(weight * rec.carburizer / 100).toFixed(1)}</td>
                              <td className="px-6 py-4 text-right font-mono text-[#94A3B8]">{rec.carburizer}%</td>
                            </tr>
                            <tr className="bg-[#F4F6FB]">
                              <td className="px-6 py-4 font-bold text-[#4F46E5] flex items-center gap-3 uppercase tracking-wider">
                                TOTAL CHARGE
                              </td>
                              <td className="px-6 py-4 text-right font-mono font-bold text-[#4F46E5]">{weight.toFixed(1)}</td>
                              <td className="px-6 py-4 text-right font-mono font-bold text-[#4F46E5]">100%</td>
                            </tr>
                          </>
                        )
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Products Being Poured Section */}
              <div className="space-y-4 pt-4">
                <Label className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">PRODUCTS BEING POURED</Label>
                <div className="bg-[#FFFFFF] border border-[#E0E7FF] rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-[#F4F6FB] border-b border-[#E0E7FF] text-[#64748B] text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4 font-semibold">Product Name</th>
                        <th className="px-6 py-4 font-semibold">Core Box Ref</th>
                        <th className="px-6 py-4 font-semibold text-center">Cavities</th>
                        <th className="px-6 py-4 font-semibold text-right">Moulds to Pour</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E0E7FF]">
                      <tr className="hover:bg-[#EEF2FF]/30 transition-colors">
                        <td className="px-6 py-4 font-medium text-[#172554]">{selectedHeat.prodName}</td>
                        <td className="px-6 py-4 font-mono text-[#64748B]">{selectedHeat.coreBoxRef}</td>
                        <td className="px-6 py-4 text-center font-mono text-[#94A3B8]">{selectedHeat.cavities}</td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-[#4285F4] text-lg">{selectedHeat.moulds}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>

          {/* Right Panel (~25%) */}
          <div className="flex-1 space-y-4">
            <Label className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider pl-2 block">RECENT HEATS</Label>
            <div className="space-y-2">
              {heats.map(h => (
                <div 
                  key={h.uid} 
                  onClick={() => setSelectedHeatId(h.uid)}
                  className={cn(
                    "p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all duration-200",
                    selectedHeatId === h.uid || (!selectedHeatId && selectedHeat.uid === h.uid)
                      ? "bg-[#EEF2FF] border-[#4285F4]/30 shadow-md"
                      : "bg-[#F4F6FB] border-[#E0E7FF] hover:bg-[#FFFFFF] hover:border-[#4F46E5]"
                  )}
                >
                  <div>
                    <p className="font-bold font-mono text-[#4F46E5]">{h.heatNo || 'H---'}</p>
                    <p className="text-xs text-[#64748B] mt-1 font-medium">Poured: 12:00</p>
                  </div>
                  <CaretRight weight="bold" className={cn("w-4 h-4 transition-colors", selectedHeatId === h.uid || (!selectedHeatId && selectedHeat.uid === h.uid) ? "text-[#172554]" : "text-[#94A3B8]")} />
                </div>
              ))}
              {heats.length === 0 && (
                <div className="text-center text-[#94A3B8] text-sm py-10 bg-[#F4F6FB] border border-[#E0E7FF] rounded-xl">
                  No heats available
                </div>
              )}
            </div>
          </div>

        </div>
      ) : (
        <div className="text-center text-[#94A3B8] py-20 bg-[#F4F6FB] border border-[#E0E7FF] rounded-xl">
          No heats available. Go to Melt Planning to add a charge.
        </div>
      )}
    </div>
  )
}
