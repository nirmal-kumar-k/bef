import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ICustomer extends Document {
  value: string
  label: string
  email?: string
  phone?: string
  contactPerson?: string
  address?: string
  status?: string
  createdAt: Date
  updatedAt: Date
}

const CustomerSchema = new Schema<ICustomer>(
  {
    value: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    contactPerson: { type: String },
    address: { type: String },
    status: { type: String, default: 'Active' }
  },
  { timestamps: true }
)

const Customer: Model<ICustomer> =
  mongoose.models.Customer || mongoose.model<ICustomer>('Customer', CustomerSchema)

export default Customer
