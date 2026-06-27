'use client'

import { useState } from 'react'
import { MeltPlanningTable } from './melt-planning-table'
import { MeltPlanningCalendar } from './melt-planning-calendar'
import { MeltTrackingCalendar } from './melt-tracking-calendar'
import { Label } from '@/shared/ui/label'
import { cn } from '@/shared/lib/utils'

export function MeltPlanningTab({ defaultMetalQty, defaultGrade, openOrders, patterns, dailyPlans, onSaveDayPlan }: any) {
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('calendar')
  const [activeTab, setActiveTab] = useState<'planning' | 'tracking'>('planning')

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Inner Tabs for Planning/Tracking (only show if in calendar mode) */}
        {viewMode === 'calendar' ? (
          <div className="flex gap-2 p-1 bg-[#050810] border border-[#243050] rounded-xl">
            <button
              onClick={() => setActiveTab('planning')}
              className={cn("px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors", activeTab === 'planning' ? "bg-[#1A263D] text-[#EEF3FF]" : "text-[#8B9FC4] hover:text-[#EEF3FF]")}
            >
              Planning
            </button>
            <button
              onClick={() => setActiveTab('tracking')}
              className={cn("px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors", activeTab === 'tracking' ? "bg-[#1A263D] text-[#EEF3FF]" : "text-[#8B9FC4] hover:text-[#EEF3FF]")}
            >
              Tracking
            </button>
          </div>
        ) : <div />}

        {/* View Mode Toggle */}
        <div className="flex items-center gap-3 bg-[#0C1221] px-4 py-2 border border-[#243050] rounded-xl ml-auto">
          <Label className={cn("text-sm font-semibold cursor-pointer", viewMode === 'table' ? 'text-white' : 'text-[#5A6E90]')} onClick={() => setViewMode('table')}>Table</Label>
          <div 
            className="w-12 h-6 bg-[#050810] rounded-full relative cursor-pointer border border-[#243050]"
            onClick={() => setViewMode(v => v === 'table' ? 'calendar' : 'table')}
          >
            <div className={cn(
              "w-4 h-4 bg-[#D4521A] rounded-full absolute top-0.5 transition-all duration-300",
              viewMode === 'calendar' ? "left-[26px]" : "left-1"
            )} />
          </div>
          <Label className={cn("text-sm font-semibold cursor-pointer", viewMode === 'calendar' ? 'text-white' : 'text-[#5A6E90]')} onClick={() => setViewMode('calendar')}>Calendar</Label>
        </div>
      </div>

      {viewMode === 'table' ? (
        <MeltPlanningTable defaultMetalQty={defaultMetalQty} defaultGrade={defaultGrade} />
      ) : activeTab === 'planning' ? (
        <MeltPlanningCalendar 
          openOrders={openOrders} 
          patterns={patterns} 
          dailyPlans={dailyPlans} 
          onSaveDayPlan={onSaveDayPlan} 
        />
      ) : (
        <MeltTrackingCalendar 
          openOrders={openOrders} 
          patterns={patterns} 
          dailyPlans={dailyPlans} 
          onSaveDayPlan={onSaveDayPlan} 
        />
      )}
    </div>
  )
}
