export interface Order {
  id: string
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

export const categories = ['All', 'Received', 'Completed']

export const statusColors: Record<string, string> = {
  'Received': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Completed': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
}

export const statusAccentColors: Record<string, string> = {
  'Received': 'border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.15)]',
  'Completed': 'border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)]',
}
