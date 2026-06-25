export const customers = [
  { value: 'alpha', label: 'Alpha Heavy Industries' },
  { value: 'beta', label: 'Beta Metalworks' },
  { value: 'gamma', label: 'Gamma Components' },
  { value: 'delta', label: 'Delta Forge' },
]

export interface Pattern {
  id: string
  code: string
  name: string
  customer: string
  category: string
  goodWeight: number
  totalWeight: number
  topMatchplate: boolean
  bottomMatchplate: boolean
  coreBoxes: number
  remarks: string
  mappedProducts: { name: string; cavities: number }[]
}

export type FilterCategory = 'All' | 'Machine Moulding' | 'Hand Moulding'
