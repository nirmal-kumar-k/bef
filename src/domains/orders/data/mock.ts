export interface Order {
  id: number
  customerOrderNo: string
  internalOrderNo: string
  customer: string
  orderDate: string
  deliveryDate: string
  status: string
  gstPercent: number
  subtotal: number
  gstAmount: number
  grandTotal: number
  cart: {
    id: string
    product: string
    productName: string
    quantity: number
    deliveryQuantity: number
    weight: number
    ratePerKg: number
    unitCost: number
  }[]
}

export const customers = [
  { value: 'alpha', label: 'Alpha Heavy Industries' },
  { value: 'beta', label: 'Beta Metalworks' },
  { value: 'gamma', label: 'Gamma Components' },
]

export const patterns = [
  { value: 'PTRN-101', label: 'PTRN-101 (Housing Base)' },
  { value: 'PTRN-102', label: 'PTRN-102 (Valve Body)' },
]

export const products: Record<string, { value: string; label: string; weight: number; ratePerKg: number }[]> = {
  'PTRN-101': [
    { value: 'PRD-001', label: 'Housing Assembly A', weight: 12.4, ratePerKg: 15.50 },
    { value: 'PRD-002', label: 'Housing Assembly B', weight: 15.0, ratePerKg: 15.50 },
  ],
  'PTRN-102': [
    { value: 'PRD-003', label: 'Valve Body Core', weight: 8.2, ratePerKg: 18.25 },
  ],
}

export const categories = ['All', 'Received', 'Completed']

export const statusColors: Record<string, string> = {
  'Received': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Completed': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
}

export const statusAccentColors: Record<string, string> = {
  'Received': 'border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.15)]',
  'Completed': 'border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)]',
}
