'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { initialJobs, ProductionJob } from '@/domains/production/data/tracking-mock'
import { Card } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'
import { CheckCircle, ClockCounterClockwise, ArrowRight } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

type StageKey = keyof ProductionJob['stages']

const STAGES: { key: StageKey; label: string }[] = [
  { key: 'core', label: 'Core' },
  { key: 'melting', label: 'Melting' },
  { key: 'moulding', label: 'Moulding' },
  { key: 'pouring', label: 'Pouring' },
  { key: 'knockout', label: 'Knockout' },
  { key: 'shotBlasting', label: 'Shot Blasting' },
  { key: 'grinding', label: 'Grinding' },
  { key: 'inspection', label: 'Inspection' },
  { key: 'readyForDispatch', label: 'Ready for Dispatch' }
]

export default function ProductionTrackingPage() {
  const [activeStage, setActiveStage] = useState<StageKey>('core')
  const [jobs, setJobs] = useState<ProductionJob[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [orderRes, prodRes, patRes] = await Promise.all([
        fetch('/api/orders'),
        fetch('/api/products'),
        fetch('/api/patterns')
      ])
      
      if (orderRes.ok && prodRes.ok && patRes.ok) {
        const ordersData = await orderRes.json()
        const productsData = await prodRes.json()
        const patternsData = await patRes.json()
        
        const openOrders = ordersData.filter((o: any) => o.status === 'Received')
        
        const savedProgressStr = localStorage.getItem('production_tracking_progress')
        const savedProgress = savedProgressStr ? JSON.parse(savedProgressStr) : {}

        const realJobs: ProductionJob[] = []
        
        openOrders.forEach((order: any) => {
          order.cart?.forEach((item: any, idx: number) => {
            const uniqueId = `${order.id || order._id}-${idx}`
            
            // Only add if it doesn't already exist in our realJobs (just in case of weird duplicates)
            if (realJobs.find(j => j.id === uniqueId)) return;

            const product = productsData.find((p: any) => p.name === item.productName || p.code === item.product)
            const pattern = product?.linkedPattern ? patternsData.find((p: any) => p.code === product.linkedPattern) : null
            
            const cavities = product?.cavities || 1
            const plannedQty = item.quantity || 0
            const calculatedMoulds = Math.ceil(plannedQty / cavities)
            
            const mappedProduct = pattern?.mappedProducts?.find((mp: any) => mp.name === product?.name)
            const coreBoxesCount = mappedProduct?.coreBoxesCount || 0
            const calculatedCores = calculatedMoulds * coreBoxesCount
            const boxWeight = pattern?.totalWeight || 0
            
            // Calculate heats required
            const furnaceCapacity = 150 // Example fixed capacity
            const totalMetal = calculatedMoulds * boxWeight
            const totalHeats = Math.ceil(totalMetal / furnaceCapacity)

            // If we have saved progress for this job, use it. Otherwise, initialize fresh.
            if (savedProgress[uniqueId]) {
              realJobs.push(savedProgress[uniqueId])
            } else {
              realJobs.push({
                id: uniqueId,
                orderNo: order.customerOrderNo || 'Unknown',
                customer: order.customer || 'Unknown',
                productCode: product?.code || item.product || '-',
                productName: item.productName || '-',
                patternCode: pattern?.code || '-',
                cavities: cavities,
                coreBoxes: coreBoxesCount,
                boxWeight: boxWeight,
                stages: {
                  core: { planned: calculatedCores, completed: 0, pending: calculatedCores, variance: -calculatedCores, unit: 'cores' },
                  melting: { planned: totalHeats, completed: 0, pending: totalHeats, variance: -totalHeats, unit: 'heats' },
                  moulding: { planned: calculatedMoulds, completed: 0, pending: calculatedMoulds, variance: -calculatedMoulds, unit: 'moulds' },
                  pouring: { planned: 0, completed: 0, pending: 0, variance: 0, unit: 'moulds' }, // Flows from moulding
                  knockout: { planned: 0, completed: 0, pending: 0, variance: 0, unit: 'moulds' }, // Flows from pouring
                  shotBlasting: { planned: 0, completed: 0, pending: 0, variance: 0, unit: 'pieces' }, // Flows from knockout
                  grinding: { planned: 0, completed: 0, pending: 0, variance: 0, unit: 'pieces' }, // Flows from shotBlasting
                  inspection: { planned: 0, completed: 0, pending: 0, variance: 0, unit: 'pieces' }, // Flows from grinding
                  readyForDispatch: { planned: 0, completed: 0, pending: 0, variance: 0, unit: 'pieces' } // Flows from inspection
                }
              })
            }
          })
        })
        
        setJobs(realJobs)
      }
    } catch (err) {
      console.error('Failed to fetch tracking data:', err)
      // Fallback to initialJobs if API fails completely
      setJobs(initialJobs)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Save to localStorage whenever jobs change significantly (e.g. from handleUpdateCompleted)
  const saveProgress = (updatedJobs: ProductionJob[]) => {
    const progressMap: Record<string, ProductionJob> = {}
    updatedJobs.forEach(job => {
      progressMap[job.id] = job
    })
    localStorage.setItem('production_tracking_progress', JSON.stringify(progressMap))
  }

  // Handlers for completing quantities
  const handleUpdateCompleted = (jobId: string, newValue: number) => {
    setJobs(prevJobs => {
      const newJobs = prevJobs.map(job => {
        if (job.id !== jobId) return job
        
        const updatedJob = JSON.parse(JSON.stringify(job)) as ProductionJob
        const stageData = updatedJob.stages[activeStage]
        
        // Update the current stage
        stageData.completed = newValue
        stageData.pending = stageData.planned - stageData.completed
        stageData.variance = stageData.completed - stageData.planned
        
        // Cascade to the next stage
        const stageIndex = STAGES.findIndex(s => s.key === activeStage)
        if (stageIndex < STAGES.length - 1) {
          const nextStageKey = STAGES[stageIndex + 1].key
          const nextStageData = updatedJob.stages[nextStageKey]
          
          // Separation logic (Knockout -> Shot Blasting)
          if (activeStage === 'knockout' && nextStageKey === 'shotBlasting') {
            nextStageData.planned = stageData.completed * updatedJob.cavities
          } else if (activeStage === 'moulding' && nextStageKey === 'pouring') {
              nextStageData.planned = stageData.completed
          } else if (activeStage === 'core') {
              // Core does not directly map 1:1 to melting planned in the same way, but keeping it simple for now
          } else if (activeStage !== 'melting' && activeStage !== 'core') {
            // Normal 1:1 flow
            nextStageData.planned = stageData.completed
          }
          
          // Recalculate pending and variance for the next stage based on its new planned value
          nextStageData.pending = nextStageData.planned - nextStageData.completed
          nextStageData.variance = nextStageData.completed - nextStageData.planned
        }
        
        return updatedJob
      })

      saveProgress(newJobs)
      return newJobs
    })
  }

  const renderTable = () => {
    return (
      <div className="bg-[#0C1221] border border-[#243050] rounded-xl overflow-hidden mt-6">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#1A263D] border-b border-[#243050]">
              <th className="px-6 py-4 text-xs font-semibold text-[#8B9FC4] uppercase tracking-wider">Job / Order No</th>
              <th className="px-6 py-4 text-xs font-semibold text-[#8B9FC4] uppercase tracking-wider">Product & Pattern</th>
              <th className="px-6 py-4 text-xs font-semibold text-[#8B9FC4] uppercase tracking-wider text-right">Expected/Planned</th>
              <th className="px-6 py-4 text-xs font-semibold text-[#8B9FC4] uppercase tracking-wider text-right">Actual Completed</th>
              {activeStage === 'melting' || activeStage === 'pouring' ? (
                <th className="px-6 py-4 text-xs font-semibold text-[#8B9FC4] uppercase tracking-wider text-left">Heat Info</th>
              ) : null}
              <th className="px-6 py-4 text-xs font-semibold text-[#8B9FC4] uppercase tracking-wider text-right">Pending</th>
              <th className="px-6 py-4 text-xs font-semibold text-[#8B9FC4] uppercase tracking-wider text-right">Variance</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-[#8B9FC4]">
                  Loading production data...
                </td>
              </tr>
            ) : jobs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-[#8B9FC4]">
                  No active production jobs found.
                </td>
              </tr>
            ) : (
              jobs.map(job => {
                const stage = job.stages[activeStage]
                const unitLabel = stage.unit.charAt(0).toUpperCase() + stage.unit.slice(1)
                
                return (
                  <tr key={job.id} className="border-b border-[#243050] hover:bg-[#1A263D]/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-[#EEF3FF]">{job.orderNo}</div>
                      <div className="text-sm text-[#8B9FC4]">{job.customer}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-[#C4D2EE]">{job.productName} ({job.productCode})</div>
                      <div className="text-sm font-mono text-[#5A6E90]">Pat: {job.patternCode} | {job.cavities} Cavities</div>
                    </td>
                    
                    {/* Expected / Planned */}
                    <td className="px-6 py-4 text-right">
                      <span className="font-mono text-[#EEF3FF] text-lg">{stage.planned}</span>
                      <span className="text-xs text-[#5A6E90] ml-1">{unitLabel}</span>
                    </td>
                    
                    {/* Actual Completed */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                        <Input 
                          type="number"
                          min="0"
                          value={stage.completed.toString()}
                          onChange={(e) => handleUpdateCompleted(job.id, Number(e.target.value))}
                          className="w-24 h-10 text-right bg-[#050810] border-[#243050] text-[#EEF3FF] focus:border-[#D4521A] text-lg font-mono"
                        />
                      </div>
                    </td>

                    {/* Heat Info (Melting / Pouring) */}
                    {(activeStage === 'melting' || activeStage === 'pouring') && (
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2 max-w-[200px]">
                          {stage.heatDetails?.map((hd, idx) => (
                            <span 
                              key={idx} 
                              className={cn(
                                "text-xs px-2 py-1 rounded border font-mono",
                                hd.completed 
                                  ? "bg-green-500/10 border-green-500/30 text-green-400" 
                                  : "bg-[#050810] border-[#243050] text-[#8B9FC4]"
                              )}
                            >
                              {hd.heatNo} ({hd.quantity})
                            </span>
                          ))}
                        </div>
                      </td>
                    )}

                    {/* Pending */}
                    <td className="px-6 py-4 text-right">
                      <span className={cn(
                        "font-mono text-lg",
                        stage.pending > 0 ? "text-yellow-400" : "text-[#8B9FC4]"
                      )}>
                        {stage.pending}
                      </span>
                    </td>

                    {/* Variance */}
                    <td className="px-6 py-4 text-right">
                      <span className={cn(
                        "font-mono text-lg px-3 py-1 rounded-full bg-opacity-10",
                        stage.variance === 0 ? "text-[#8B9FC4]" : 
                        stage.variance > 0 ? "text-green-400 bg-green-400/10" : "text-red-400 bg-red-400/10"
                      )}>
                        {stage.variance > 0 ? '+' : ''}{stage.variance}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#050810] text-[#EEF3FF] p-8 overflow-y-auto">
      <div className="max-w-[1600px] mx-auto w-full space-y-6">
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end pb-4 border-b border-[#243050] gap-4">
          <div>
            <h1 className="text-3xl font-bold font-heading text-[#EEF3FF] tracking-tight">Production Tracking</h1>
            <p className="text-[#8B9FC4] mt-2">Track real-time actuals, manage stage flows, and monitor variances.</p>
          </div>
          <div className="flex items-center gap-3">
             {/* Action buttons if needed */}
          </div>
        </header>

        {/* Central Navigation Bar (The 9 Stages) */}
        <div className="w-full overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-[#243050] scrollbar-track-transparent">
          <div className="flex space-x-2 min-w-max p-1.5 bg-[#0C1221]/80 backdrop-blur-md border border-[#243050] rounded-2xl shadow-sm">
            {STAGES.map((stage, idx) => (
              <button
                key={stage.key}
                onClick={() => setActiveStage(stage.key)}
                className={cn(
                  "flex items-center gap-3 px-6 py-3.5 rounded-xl text-[15px] font-semibold transition-all relative overflow-hidden group",
                  activeStage === stage.key 
                    ? "bg-[#D4521A] text-white shadow-md scale-[1.02]" 
                    : "text-[#8B9FC4] hover:text-[#EEF3FF] hover:bg-[#1A263D]/50"
                )}
              >
                {/* Arrow connector between tabs */}
                {idx > 0 && activeStage !== stage.key && (
                  <ArrowRight className="absolute left-2 w-4 h-4 opacity-20" />
                )}
                <span className="relative z-10">{idx + 1}. {stage.label}</span>
                {activeStage === stage.key && (
                  <motion.div 
                    layoutId="activeTabIndicator"
                    className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Animated Content Area */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStage}
            initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="space-y-6"
          >
            {/* Info Banner */}
            <div className="flex items-center justify-between bg-[#0C1221]/80 backdrop-blur-md border border-[#243050] p-5 rounded-2xl shadow-sm">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-full bg-[#1A263D] flex items-center justify-center border border-[#243050] shadow-inner">
                   <CheckCircle weight="duotone" className="w-6 h-6 text-[#D4521A]" />
                 </div>
                 <div>
                   <h3 className="text-[#EEF3FF] font-semibold text-lg">{STAGES.find(s => s.key === activeStage)?.label} Stage</h3>
                   <p className="text-[#8B9FC4] text-[15px] mt-0.5">
                     {activeStage === 'knockout' 
                       ? 'After knockout, boxes are separated into individual product pieces for Shot Blasting.'
                       : activeStage === 'melting' || activeStage === 'pouring'
                       ? 'Track heat numbers and poured moulds/boxes.'
                       : 'Only completed quantities will flow into the next production stage.'}
                   </p>
                 </div>
              </div>
            </div>

            {/* Dynamic Table Area */}
            {renderTable()}
          </motion.div>
        </AnimatePresence>

      </div>
    </div>
  )
}
