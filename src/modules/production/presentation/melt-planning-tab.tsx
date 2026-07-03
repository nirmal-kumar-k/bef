'use client'

import { useState } from 'react'
import { MeltPlanningTable } from './melt-planning-table'
import { UnifiedMeltCalendar } from './unified-melt-calendar'
import { CalendarBlank, List } from '@phosphor-icons/react'
import { cn } from '@/shared/lib/utils'

export function MeltPlanningTab({ defaultMetalQty, defaultGrade, openOrders, products, patterns, dailyPlans, onSaveDayPlan }: any) {
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('calendar')
  const [activeTab, setActiveTab] = useState<'planning' | 'tracking'>('planning')

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Inner Tabs for Planning/Tracking */}
        <div className={cn("flex gap-2 p-1 bg-[#F4F6FB] border border-[#E0E7FF] rounded-xl transition-opacity", viewMode === 'table' && "opacity-0 pointer-events-none")}>
          <button
            onClick={() => setActiveTab('planning')}
            className={cn("px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors", activeTab === 'planning' ? "bg-[#EEF2FF] text-[#172554]" : "text-[#64748B] hover:text-[#172554]")}
          >
            Planning
          </button>
          <button
            onClick={() => setActiveTab('tracking')}
            className={cn("px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors", activeTab === 'tracking' ? "bg-[#EEF2FF] text-[#172554]" : "text-[#64748B] hover:text-[#172554]")}
          >
            Tracking
          </button>
        </div>

        {/* View Mode Toggle (Icons only) */}
        <div className="flex items-center p-1 bg-[#F4F6FB] border border-[#E0E7FF] rounded-xl ml-auto">
          <button 
            onClick={() => setViewMode('calendar')}
            className={cn("p-2 rounded-lg transition-colors", viewMode === 'calendar' ? "bg-[#EEF2FF] text-[#172554]" : "text-[#64748B] hover:text-[#172554]")}
            title="Calendar View"
          >
            <CalendarBlank weight={viewMode === 'calendar' ? "fill" : "regular"} className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setViewMode('table')}
            className={cn("p-2 rounded-lg transition-colors", viewMode === 'table' ? "bg-[#EEF2FF] text-[#172554]" : "text-[#64748B] hover:text-[#172554]")}
            title="Table View"
          >
            <List weight={viewMode === 'table' ? "bold" : "regular"} className="w-5 h-5" />
          </button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <MeltPlanningTable defaultMetalQty={defaultMetalQty} defaultGrade={defaultGrade} />
      ) : (
        <UnifiedMeltCalendar 
          activeTab={activeTab}
          openOrders={openOrders} 
          patterns={patterns} 
          products={products}
          dailyPlans={dailyPlans} 
          onSaveDayPlan={onSaveDayPlan} 
        />
      )}
    </div>
  )
}
