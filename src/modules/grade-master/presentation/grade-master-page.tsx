'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, PencilSimple, Trash } from '@phosphor-icons/react'
import { Button } from '@/shared/ui/button'
import { GradeModal } from '@/modules/grade-master/presentation/grade-modal'
import type { Grade } from '@/modules/grade-master/domain/grade.types'
import { ConfirmDeleteDialog } from '@/shared/ui/confirm-delete-dialog'

export default function GradeMasterPage() {
  const [grades, setGrades] = useState<Grade[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null)
  const [gradeToDelete, setGradeToDelete] = useState<Grade | null>(null)

  const handleDeleteGrade = async (id: string) => {
    try {
      const res = await fetch(`/api/grades/${id}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchGrades()
      }
    } catch (err) {
      console.error('Failed to delete grade:', err)
    }
  }

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
          <h1 className="text-3xl font-bold font-heading text-[#172554]">Grade Master</h1>
          <p className="text-[#64748B] mt-1">Manage chemical compositions for cast iron grades.</p>
        </div>
        <Button onClick={openAddModal} className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white font-semibold">
          <Plus className="w-4 h-4 mr-2" />
          Add Grade
        </Button>
      </div>

      <div className="rounded-[14px] border border-black/[0.04] bg-[#FFFFFF] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[15px] text-left">
            <thead className="bg-[#FFFFFF] border-b border-[#E0E7FF] text-[#64748B] text-[13px] uppercase tracking-wider font-heading">
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
            <tbody className="divide-y divide-[#E0E7FF]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-[#64748B]">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-6 h-6 border-2 border-[#E0E7FF] border-t-[#4F46E5] rounded-full animate-spin" />
                      Loading grades...
                    </div>
                  </td>
                </tr>
              ) : grades.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-[#64748B]">
                    No grades found. Add your first grade to get started.
                  </td>
                </tr>
              ) : (
                grades.map((grade) => (
                  <tr 
                    key={grade.id} 
                    className="hover:bg-[#EEF2FF]/50 transition-colors group"
                  >
                    <td className="px-6 py-4 font-mono text-[#4F46E5] font-medium">{grade.code}</td>
                    <td className="px-6 py-4 text-[#172554] font-medium">{grade.name}</td>
                    <td className="px-6 py-4 text-[#64748B] font-mono text-sm">{grade.c}</td>
                    <td className="px-6 py-4 text-[#64748B] font-mono text-sm">{grade.si}</td>
                    <td className="px-6 py-4 text-[#64748B] font-mono text-sm">{grade.mn}</td>
                    <td className="px-6 py-4 text-[#64748B] font-mono text-sm">{grade.p}</td>
                    <td className="px-6 py-4 text-[#64748B] font-mono text-sm">{grade.s}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => openEditModal(grade)}
                          className="text-[#64748B] hover:text-[#172554] hover:bg-[#E0E7FF] h-8 px-2"
                        >
                          <PencilSimple className="w-4 h-4 mr-1.5" />
                          Edit
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setGradeToDelete(grade)}
                          className="text-[#64748B] hover:text-red-500 hover:bg-red-50 h-8 px-2"
                        >
                          <Trash className="w-4 h-4 mr-1.5" />
                          Delete
                        </Button>
                      </div>
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
      <ConfirmDeleteDialog
        open={!!gradeToDelete}
        onOpenChange={(open) => !open && setGradeToDelete(null)}
        onConfirm={() => gradeToDelete && gradeToDelete.id && handleDeleteGrade(gradeToDelete.id)}
        title="Delete Grade?"
        description="Are you sure you want to delete this grade? Chemical compositions mapped to items in this grade may be affected."
        itemName={gradeToDelete?.code || gradeToDelete?.name}
      />
    </div>
  )
}
