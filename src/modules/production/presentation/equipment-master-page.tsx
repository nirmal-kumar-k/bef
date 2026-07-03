'use client'

import { useState, useEffect } from 'react'
import { Plus, PencilSimple, Trash } from '@phosphor-icons/react'
import { Button } from '@/shared/ui/button'
import { EquipmentModal } from './equipment-modal'
import { Switch } from '@/shared/ui/switch'
import { cn } from '@/shared/lib/utils'

export interface Equipment {
  id?: string
  name: string
  type: 'Furnace' | 'Moulding Machine' | 'Core Machine' | 'Knockout'
  weightCapacity?: number
  firstHeatDurationMins?: number
  regularHeatDurationMins?: number
  avgPiecesPerHour?: number
  isActive: boolean
}

export function EquipmentMasterPage() {
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>('Furnace')

  const fetchEquipment = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/equipment')
      if (res.ok) {
        const data = await res.json()
        setEquipmentList(data)
      }
    } catch (error) {
      console.error('Failed to fetch equipment:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchEquipment()
  }, [])

  const handleEdit = (equipment: Equipment) => {
    setSelectedEquipment(equipment)
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this equipment?')) return
    
    try {
      const res = await fetch(`/api/equipment/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchEquipment()
      }
    } catch (error) {
      console.error('Failed to delete equipment:', error)
    }
  }

  const toggleActive = async (equipment: Equipment) => {
    try {
      const res = await fetch(`/api/equipment/${equipment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !equipment.isActive })
      })
      if (res.ok) {
        fetchEquipment()
      }
    } catch (error) {
      console.error('Failed to toggle equipment:', error)
    }
  }

  const equipmentTypes = ['Furnace', 'Moulding Machine', 'Core Machine', 'Knockout'] as const

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#172554] tracking-tight font-heading">Equipment Master</h1>
          <p className="text-sm text-[#64748B] mt-1">Manage factory equipment and their parameters</p>
        </div>
        <Button 
          onClick={() => {
            setSelectedEquipment(null)
            setIsModalOpen(true)
          }}
          className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white font-medium"
        >
          <Plus weight="bold" className="mr-2" />
          Add Equipment
        </Button>
      </div>

      <div className="bg-[#F4F6FB] border border-[#E0E7FF] rounded-xl overflow-hidden shadow-xl">
        <div className="w-full">
          <div className="px-6 py-4 border-b border-[#E0E7FF] bg-[#FFFFFF]">
            <div className="flex bg-[#F4F6FB] border border-[#E0E7FF] p-1 rounded-md w-fit">
              {equipmentTypes.map(type => (
                <button 
                  key={type}
                  onClick={() => setActiveTab(type)}
                  className={cn(
                    "px-4 py-1.5 text-sm font-medium rounded-sm transition-colors",
                    activeTab === type 
                      ? "bg-[#4F46E5] text-white" 
                      : "text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#172554]"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="m-0">
            {isLoading ? (
              <div className="p-12 text-center text-[#94A3B8] animate-pulse">Loading...</div>
            ) : equipmentList.filter(e => e.type === activeTab).length === 0 ? (
              <div className="p-12 text-center text-[#94A3B8] italic">
                No {activeTab}s configured yet. Click "Add Equipment" to create one.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-[#FFFFFF] text-[#64748B] font-semibold text-xs uppercase tracking-wider border-b border-[#E0E7FF]">
                    <tr>
                      <th className="px-6 py-4">Name</th>
                      <th className="px-6 py-4">Weight Capacity</th>
                      {activeTab === 'Furnace' && (
                        <>
                          <th className="px-6 py-4 text-center">First Heat</th>
                          <th className="px-6 py-4 text-center">Regular Heat</th>
                        </>
                      )}
                      {activeTab === 'Knockout' && (
                        <th className="px-6 py-4 text-center">Avg Pieces / Hr</th>
                      )}
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E7FF]">
                    {equipmentList.filter(e => e.type === activeTab).map((eq) => (
                      <tr key={eq.id} className={cn("group hover:bg-[#FFFFFF]/50 transition-colors", !eq.isActive && "opacity-50")}>
                        <td className="px-6 py-4">
                          <div className="font-medium text-[#172554]">{eq.name}</div>
                        </td>
                        <td className="px-6 py-4 text-[#64748B] font-mono">
                          {eq.weightCapacity ? `${eq.weightCapacity} kg` : '-'}
                        </td>
                        
                        {activeTab === 'Furnace' && (
                          <>
                            <td className="px-6 py-4 text-center text-[#64748B] font-mono">
                              {eq.firstHeatDurationMins} min
                            </td>
                            <td className="px-6 py-4 text-center text-[#64748B] font-mono">
                              {eq.regularHeatDurationMins} min
                            </td>
                          </>
                        )}
                        
                        {activeTab === 'Knockout' && (
                          <td className="px-6 py-4 text-center text-[#64748B] font-mono">
                            {eq.avgPiecesPerHour || '-'}
                          </td>
                        )}

                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className={cn(
                              "text-xs font-semibold px-2 py-0.5 rounded-full border",
                              eq.isActive 
                                ? "bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20" 
                                : "bg-[#94A3B8]/10 text-[#94A3B8] border-[#94A3B8]/20"
                            )}>
                              {eq.isActive ? 'Active' : 'Inactive'}
                            </span>
                            <Switch 
                              checked={eq.isActive} 
                              onCheckedChange={() => toggleActive(eq)}
                              className="data-[state=checked]:bg-[#10B981]"
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleEdit(eq)}
                              className="h-8 w-8 text-[#64748B] hover:text-[#172554] hover:bg-[#E0E7FF]"
                            >
                              <PencilSimple weight="bold" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleDelete(eq.id!)}
                              className="h-8 w-8 text-[#64748B] hover:text-red-400 hover:bg-red-400/10"
                            >
                              <Trash weight="bold" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <EquipmentModal 
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          fetchEquipment()
        }}
        initialData={selectedEquipment}
      />
    </div>
  )
}
