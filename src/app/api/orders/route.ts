import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/infrastructure/db'
import Order from '@/modules/orders/domain/order.model'

export async function GET() {
  try {
    await dbConnect()
    const orders = await Order.find({}).sort({ createdAt: -1 }).lean()
    const mapped = orders.map((o) => ({ ...o, id: o._id?.toString() }))
    return NextResponse.json(mapped)
  } catch (error) {
    console.error('GET /api/orders error:', error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect()
    const body = await request.json()
    const order = await Order.create(body)
    const obj = order.toObject()
    return NextResponse.json({ ...obj, id: obj._id?.toString() }, { status: 201 })
  } catch (error) {
    console.error('POST /api/orders error:', error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
