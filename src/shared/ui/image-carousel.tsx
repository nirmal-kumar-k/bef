'use client'

import { useState, useEffect } from 'react'
import { CaretLeft, CaretRight, Plus, PencilSimple, Trash, Image as ImageIcon } from '@phosphor-icons/react'
import { ConfirmDeleteDialog } from '@/shared/ui/confirm-delete-dialog'
import { cn } from '@/shared/lib/utils'

interface ImageCarouselProps {
  images: string[]
  onImagesChange: (imgs: string[]) => void
  disabled?: boolean
  size?: 'small' | 'large'
  previewPosition?: 'left' | 'right'
}

export function ImageCarousel({
  images,
  onImagesChange,
  disabled = false,
  size = 'large',
  previewPosition = 'left'
}: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)
  
  const boxClass = size === 'large' ? 'w-28 h-28' : 'w-20 h-20'
  const floatingClass = size === 'large' ? 'w-96 h-96' : 'w-[350px] h-[350px]'
  const btnClass = size === 'large' ? 'w-[85px] px-2 py-1.5 text-xs' : 'w-[75px] px-2 py-1 text-[10px]'
  const iconClass = size === 'large' ? 'w-3.5 h-3.5' : 'w-3 h-3'
  const uploadIconClass = size === 'large' ? 'w-6 h-6 mb-1' : 'w-5 h-5 mb-1'
  const emptyTextClass = size === 'large' ? 'text-[10px]' : 'text-[9px]'

  useEffect(() => {
    if (currentIndex >= images.length) {
      setCurrentIndex(Math.max(0, images.length - 1))
    }
  }, [images.length, currentIndex])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent changing images if user is typing in an input field
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) {
        return
      }
      
      if (images.length <= 1 || showConfirm) return

      if (e.key === 'ArrowLeft') {
        setCurrentIndex((prev) => Math.max(0, prev - 1))
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex((prev) => Math.min(images.length - 1, prev + 1))
      }
    }

    document.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [images.length, showConfirm])

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = error => reject(error)
    })
  }

  const handleAdd = async (files: FileList | null) => {
    if (files && files.length > 0) {
       const newUrls = await Promise.all(Array.from(files).map(file => fileToBase64(file)))
       onImagesChange([...images, ...newUrls])
       setCurrentIndex(0)
    }
  }

  const handleEdit = async (file: File | null) => {
    if (file && images.length > 0) {
       const url = await fileToBase64(file)
       const newImgs = [...images]
       newImgs[currentIndex] = url
       onImagesChange(newImgs)
    }
  }

  const handleRemove = () => {
    if (images.length > 0) {
       const newImgs = [...images]
       newImgs.splice(currentIndex, 1)
       onImagesChange(newImgs)
    }
  }

  return (
    <div className="flex items-start gap-3">
      {images.length > 0 ? (
        <>
          <div className="flex flex-col gap-1.5 shrink-0">
            <div className={cn("relative group", boxClass)}>
              <img src={images[currentIndex]} alt={`Preview ${currentIndex + 1}`} className="w-full h-full rounded-xl object-cover border-2 border-[#243050] border-solid" />
              
              <div className={cn("absolute bottom-0 z-[100] rounded-2xl overflow-hidden border border-[#8B9FC4]/30 shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_30px_rgba(139,159,196,0.2)] opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-500 ease-out scale-90 group-hover:scale-100 hidden md:block", floatingClass, previewPosition === 'left' ? "right-[calc(100%+24px)] origin-bottom-right" : "left-[calc(100%+24px)] origin-bottom-left")}>
                <img src={images[currentIndex]} alt="Large Preview" className="w-full h-full object-cover" />
              </div>
            </div>

            {images.length > 1 && (
              <div className="flex justify-between items-center px-1">
                 <button type="button" className="text-[#5A6E90] hover:text-[#EEF3FF] transition-colors p-0.5" onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}>
                   <CaretLeft className="w-3.5 h-3.5" />
                 </button>
                 <span className="text-[10px] text-[#5A6E90] font-medium">
                   {currentIndex + 1} / {images.length}
                 </span>
                 <button type="button" className="text-[#5A6E90] hover:text-[#EEF3FF] transition-colors p-0.5" onClick={() => setCurrentIndex(Math.min(images.length - 1, currentIndex + 1))}>
                   <CaretRight className="w-3.5 h-3.5" />
                 </button>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <div className={cn("flex items-center justify-center gap-1.5 bg-[#0C1221] border border-[#243050] rounded-md text-[#8B9FC4] font-medium shrink-0 cursor-default", btnClass)} title="Total Images">
              <span className="text-[#EEF3FF] font-bold">{images.length}</span> Total
            </div>
            <label className={cn("cursor-pointer flex items-center justify-center gap-1.5 bg-[#1A263D] hover:bg-[#243050] rounded-md text-[#8B9FC4] hover:text-[#EEF3FF] transition-colors font-medium", btnClass)} title="Add Image">
              <Plus className={iconClass} /> Add
              <input type="file" className="hidden" accept="image/*" multiple disabled={disabled} onChange={(e) => handleAdd(e.target.files)} />
            </label>
            <label className={cn("cursor-pointer flex items-center justify-center gap-1.5 bg-[#1A263D] hover:bg-[#243050] rounded-md text-[#8B9FC4] hover:text-[#EEF3FF] transition-colors font-medium", btnClass)} title="Edit Image">
              <PencilSimple className={iconClass} /> Edit
              <input type="file" className="hidden" accept="image/*" onChange={(e) => handleEdit(e.target.files?.[0] || null)} />
            </label>
            <button type="button" onClick={() => setShowConfirm(true)} className={cn("flex items-center justify-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-md text-red-400 hover:text-red-300 transition-colors font-medium", btnClass)} title="Remove Image">
              <Trash className={iconClass} /> Remove
            </button>
          </div>
        </>
      ) : (
        <div className={cn("relative shrink-0 group", boxClass)}>
          <div className="w-full h-full rounded-xl overflow-hidden border-2 border-dashed transition-colors relative border-[#243050] hover:border-[#8B9FC4]/50 bg-[#050810]">
            <div className="w-full h-full flex flex-col items-center justify-center text-[#8B9FC4] group-hover:text-[#EEF3FF]">
              <ImageIcon className={uploadIconClass} />
              <span className={cn("uppercase font-medium", emptyTextClass)}>Upload</span>
            </div>
            <input 
              type="file" 
              accept="image/*" 
              multiple
              className="absolute inset-0 opacity-0 cursor-pointer z-20 disabled:cursor-not-allowed"
              disabled={disabled}
              onChange={(e) => handleAdd(e.target.files)}
            />
          </div>
        </div>
      )}
      <ConfirmDeleteDialog 
        open={showConfirm} 
        onOpenChange={setShowConfirm}
        onConfirm={handleRemove}
        title="Remove Image?"
        description="Are you sure you want to remove this image?"
      />
    </div>
  )
}
