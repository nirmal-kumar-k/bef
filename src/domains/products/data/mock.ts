export interface Product {
  id: number
  code: string
  name: string
  customer: string
  weight: string
  cavities: number
  ratePerKg?: number
  unitPrice?: number
  grade?: string
  remarks?: string
  images?: string[]
  linkedPattern?: string
}

export const customers = [
  { value: 'alpha', label: 'Alpha Heavy Industries' },
  { value: 'beta', label: 'Beta Metalworks' },
  { value: 'gamma', label: 'Gamma Components' },
  { value: 'delta', label: 'Delta Forge' },
]
