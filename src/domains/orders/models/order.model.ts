import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ICartItem {
  product: string
  productName: string
  quantity: number
  deliveryQuantity: number
  weight: number
  ratePerKg: number
  unitCost: number
}

export interface IOrder extends Document {
  customerOrderNo: string
  internalOrderNo: string
  customer: string
  orderDate: string
  deliveryDate: string
  status: 'Received' | 'Completed'
  gstPercent: number
  subtotal: number
  gstAmount: number
  grandTotal: number
  cart: ICartItem[]
  createdAt: Date
  updatedAt: Date
}

const CartItemSchema = new Schema<ICartItem>(
  {
    product: { type: String, required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
    deliveryQuantity: { type: Number, default: 0 },
    weight: { type: Number, required: true },
    ratePerKg: { type: Number, required: true },
    unitCost: { type: Number, required: true },
  },
  { _id: false }
)

const OrderSchema = new Schema<IOrder>(
  {
    customerOrderNo: { type: String, required: true },
    internalOrderNo: { type: String, default: '' },
    customer: { type: String, default: '' },
    orderDate: { type: String, default: '' },
    deliveryDate: { type: String, default: '' },
    status: { type: String, default: 'Received', enum: ['Received', 'Completed'] },
    gstPercent: { type: Number, default: 18 },
    subtotal: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    cart: { type: [CartItemSchema], default: [] },
  },
  { timestamps: true }
)

const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema)

export default Order
