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
  sharedCoreBoxes?: { id: string; code: string; owner: string; images: string[] }[]
  topOwner?: string
  topImages?: string[]
  bottomOwner?: string
  bottomImages?: string[]
  typeOfCore?: string
  coreWeight?: number
  patternImages?: string[]
  remarks: string
  mappedProducts: { name: string; cavities: number; selectedCoreBoxes?: { coreBoxCode: string; quantity: number }[] }[]
}

export type FilterCategory = 'All' | 'Machine Moulding' | 'Hand Moulding'
