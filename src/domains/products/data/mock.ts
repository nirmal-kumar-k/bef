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
