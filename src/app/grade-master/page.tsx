'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, PencilSimple } from '@phosphor-icons/react'
import { Button } from '@/shared/ui/button'
import { GradeModal } from '@/domains/grade-master/components/grade-modal'
import type { Grade } from '@/domains/grade-master/data/mock'

export default function GradeMasterPage() {
  const [grades, setGrades] = useState<Grade[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null)

  const fetchGrades = useCallback(async () => {
    try {
      const res = await fetch('/api/grades')
      if (res.ok) {
        const data = await res.json()
        setGrades(data)
      }
    } catch (err) {
      console.error('Failed to fetch grades:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGrades()
  }, [fetchGrades])

  const handleSaveGrade = async (grade: Partial<Grade>) => {
    try {
      if (grade.id) {
        const res = await fetch(`/api/grades/${grade.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(grade),
        })
        if (res.ok) await fetchGrades()
      } else {
        const res = await fetch('/api/grades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(grade),
        })
        if (res.ok) await fetchGrades()
      }
    } catch (err) {
      console.error('Failed to save grade:', err)
    }
  }

  const openAddModal = () => {
    setEditingGrade(null)
    setIsModalOpen(true)
  }

  const openEditModal = (grade: Grade) => {
    setEditingGrade(grade)
    setIsModalOpen(true)
  }

  return (
    <div className="p-8 max-w-[1200px] mx-auto w-full flex flex-col gap-8 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-heading text-white">Grade Master</h1>
          <p className="text-[#8B9FC4] mt-1">Manage chemical compositions for cast iron grades.</p>
        </div>
        <Button onClick={openAddModal} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold">
          <Plus className="w-4 h-4 mr-2" />
          Add Grade
        </Button>
      </div>

      <div className="rounded-[14px] border border-white/[0.06] bg-[#0C1221] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[15px] text-left">
            <thead className="bg-[#0C1221] border-b border-[#243050] text-[#8B9FC4] text-[13px] uppercase tracking-wider font-heading">
              <tr>
                <th className="px-6 py-4 font-medium">Grade Code</th>
                <th className="px-6 py-4 font-medium">Grade Name</th>
                <th className="px-6 py-4 font-medium">C%</th>
                <th className="px-6 py-4 font-medium">Si%</th>
                <th className="px-6 py-4 font-medium">Mn%</th>
                <th className="px-6 py-4 font-medium">P%</th>
                <th className="px-6 py-4 font-medium">S%</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#243050]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-[#8B9FC4]">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-6 h-6 border-2 border-[#243050] border-t-[#D4521A] rounded-full animate-spin" />
                      Loading grades...
                    </div>
                  </td>
                </tr>
              ) : grades.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-[#8B9FC4]">
                    No grades found. Add your first grade to get started.
                  </td>
                </tr>
              ) : (
                grades.map((grade) => (
                  <tr 
                    key={grade.id} 
                    className="hover:bg-[#1A263D]/50 transition-colors group"
                  >
                    <td className="px-6 py-4 font-mono text-[#D4521A] font-medium">{grade.code}</td>
                    <td className="px-6 py-4 text-[#EEF3FF] font-medium">{grade.name}</td>
                    <td className="px-6 py-4 text-[#8B9FC4] font-mono text-sm">{grade.c}</td>
                    <td className="px-6 py-4 text-[#8B9FC4] font-mono text-sm">{grade.si}</td>
                    <td className="px-6 py-4 text-[#8B9FC4] font-mono text-sm">{grade.mn}</td>
                    <td className="px-6 py-4 text-[#8B9FC4] font-mono text-sm">{grade.p}</td>
                    <td className="px-6 py-4 text-[#8B9FC4] font-mono text-sm">{grade.s}</td>
                    <td className="px-6 py-4 text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => openEditModal(grade)}
                        className="text-[#8B9FC4] hover:text-[#EEF3FF] hover:bg-[#243050] h-8 px-2"
                      >
                        <PencilSimple className="w-4 h-4 mr-1.5" />
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <GradeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveGrade}
        grade={editingGrade}
      />
    </div>
  )
}
