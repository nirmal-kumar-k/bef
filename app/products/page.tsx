'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NewProductModal } from '@/components/products/new-product-modal'
import { ViewProductModal } from '@/components/products/view-product-modal'

const mockProducts = [
  { id: 1, code: 'PRD-0512', name: 'Pump Housing', customer: 'Apex Industrial Group', weight: '12.4 kg', cavities: 2 },
  { id: 2, code: 'PRD-0513', name: 'Valve Body', customer: 'Titan Mfg Corp', weight: '8.2 kg', cavities: 4 },
  { id: 3, code: 'PRD-0514', name: 'Bearing Housing', customer: 'Nova Forge Ltd.', weight: '5.6 kg', cavities: 6 },
]

export default function ProductsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [viewingProduct, setViewingProduct] = useState<typeof mockProducts[0] | null>(null)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#EEF3FF] font-heading tracking-tight">Products</h1>
          <p className="text-[#8B9FC4] mt-1 text-sm">Manage foundry products and customer weights</p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#E8581A] text-white transition-all hover:bg-[#F5712E] hover:shadow-[0_4px_14px_rgba(232,88,26,0.35)] hover:-translate-y-[1px]"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Product
        </Button>
      </div>

      {/* Products Table */}
      <div className="rounded-lg border border-[#243050] bg-[#0B101A] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[15px] text-left">
            <thead className="bg-[#121A2B] border-b border-[#243050] text-[#8B9FC4] text-[13px] uppercase tracking-wider font-heading">
              <tr>
                <th className="px-6 py-4 font-medium">Product Code</th>
                <th className="px-6 py-4 font-medium">Product Name</th>
                <th className="px-6 py-4 font-medium">Customer</th>
                <th className="px-6 py-4 text-right font-medium">Weight</th>
                <th className="px-6 py-4 text-right font-medium">Cavity Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#243050]">
              {mockProducts.map((product) => (
                <tr 
                  key={product.id} 
                  className="hover:bg-[#1A263D]/50 transition-colors group cursor-pointer"
                  onClick={() => {
                    setViewingProduct(product)
                    setIsViewModalOpen(true)
                  }}
                >
                  <td className="px-6 py-4 font-mono text-[#F5712E] font-medium">{product.code}</td>
                  <td className="px-6 py-4 text-[#EEF3FF] font-medium group-hover:text-white transition-colors">{product.name}</td>
                  <td className="px-6 py-4 text-[#8B9FC4] group-hover:text-[#C4D2EE] transition-colors">{product.customer}</td>
                  <td className="px-6 py-4 text-right text-[#C4D2EE]">{product.weight}</td>
                  <td className="px-6 py-4 text-right font-mono text-[#5A6E90] group-hover:text-[#8B9FC4] transition-colors">{product.cavities}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <NewProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <ViewProductModal
        product={viewingProduct}
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
      />
    </div>
  )
}
