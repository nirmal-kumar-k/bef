import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IMappedProduct {
  name: string
  cavities: number
  coreBoxesCount: number
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
  remarks: string
  mappedProducts: IMappedProduct[]
  createdAt: Date
  updatedAt: Date
}

const MappedProductSchema = new Schema<IMappedProduct>(
  {
    name: { type: String, required: true },
    cavities: { type: Number, default: 1 },
    coreBoxesCount: { type: Number, default: 2 },
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
    remarks: { type: String, default: '' },
    mappedProducts: { type: [MappedProductSchema], default: [] },
  },
  { timestamps: true }
)

const Pattern: Model<IPattern> =
  mongoose.models.Pattern || mongoose.model<IPattern>('Pattern', PatternSchema)

export default Pattern
