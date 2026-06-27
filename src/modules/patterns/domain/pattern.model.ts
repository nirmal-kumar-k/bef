import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IMappedProduct {
  name: string
  cavities: number
  selectedCoreBoxes?: { coreBoxCode: string; quantity: number }[]
}

export interface IPattern extends Document {
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
  avgCoreProduction?: string
  avgMouldsPerHour?: number
  patternImages?: string[]
  remarks: string
  mappedProducts: IMappedProduct[]
  createdAt: Date
  updatedAt: Date
}

const SelectedCoreBoxSchema = new Schema(
  {
    coreBoxCode: { type: String, required: true },
    quantity: { type: Number, default: 1 },
  },
  { _id: false }
)

const MappedProductSchema = new Schema<IMappedProduct>(
  {
    name: { type: String, required: true },
    cavities: { type: Number, default: 1 },
    selectedCoreBoxes: { type: [SelectedCoreBoxSchema], default: [] },
  },
  { _id: false }
)

const CoreBoxSchema = new Schema(
  {
    id: { type: String },
    code: { type: String, default: '' },
    owner: { type: String, default: 'Foundry' },
    images: { type: [String], default: [] },
  },
  { _id: false }
)

const PatternSchema = new Schema<IPattern>(
  {
    code: { type: String, required: true },
    name: { type: String, required: true },
    customer: { type: String, default: '' },
    category: { type: String, default: 'Machine Moulding' },
    goodWeight: { type: Number, default: 0 },
    totalWeight: { type: Number, default: 0 },
    topMatchplate: { type: Boolean, default: false },
    bottomMatchplate: { type: Boolean, default: false },
    coreBoxes: { type: Number, default: 0 },
    sharedCoreBoxes: { type: [CoreBoxSchema], default: [] },
    topOwner: { type: String, default: 'Foundry' },
    topImages: { type: [String], default: [] },
    bottomOwner: { type: String, default: 'Foundry' },
    bottomImages: { type: [String], default: [] },
    typeOfCore: { type: String, default: '' },
    coreWeight: { type: Number, default: null },
    avgCoreProduction: { type: String, default: '' },
    avgMouldsPerHour: { type: Number, default: null },
    patternImages: { type: [String], default: [] },
    remarks: { type: String, default: '' },
    mappedProducts: { type: [MappedProductSchema], default: [] },
  },
  { timestamps: true }
)

const Pattern: Model<IPattern> =
  mongoose.models.Pattern || mongoose.model<IPattern>('Pattern', PatternSchema)

export default Pattern
