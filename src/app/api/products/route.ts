import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/infrastructure/db'
import Product from '@/domains/products/models/product.model'

export async function GET() {
  try {
    await dbConnect()
    const products = await Product.find({}).sort({ createdAt: -1 }).lean()
    // Map _id to id for frontend compatibility
    const mapped = products.map((p) => ({ ...p, id: p._id?.toString() }))
    return NextResponse.json(mapped)
  } catch (error) {
    console.error('GET /api/products error:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect()
    const body = await request.json()
    const product = await Product.create(body)
    const obj = product.toObject()
    return NextResponse.json({ ...obj, id: obj._id?.toString() }, { status: 201 })
  } catch (error) {
    console.error('POST /api/products error:', error)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}
