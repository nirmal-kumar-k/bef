import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IProduct extends Document {
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
  stock?: number
  createdAt: Date
  updatedAt: Date
}

const ProductSchema = new Schema<IProduct>(
  {
    code: { type: String, required: true },
    name: { type: String, required: true },
    customer: { type: String, default: '' },
    weight: { type: String, default: '-' },
    cavities: { type: Number, default: 0 },
    ratePerKg: { type: Number },
    unitPrice: { type: Number },
    grade: { type: String },
    remarks: { type: String },
    images: { type: [String] },
    linkedPattern: { type: String },
    stock: { type: Number, default: 0 },
  },
  { timestamps: true }
)

const Product: Model<IProduct> =
  mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema)

export default Product
