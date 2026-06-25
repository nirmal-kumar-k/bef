import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/infrastructure/db'
import Product from '@/domains/products/models/product.model'
import Pattern from '@/domains/patterns/models/pattern.model'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const { id } = await params
    const product = await Product.findById(id).lean()
    if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ...product, id: product._id?.toString() })
  } catch (error) {
    console.error('GET /api/products/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const { id } = await params
    const body = await request.json()
    const product = await Product.findByIdAndUpdate(id, body, { new: true }).lean()
    if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Sync grade across all products mapped to the same pattern
    if (body.grade && product.name) {
      const pattern = await Pattern.findOne({ 'mappedProducts.name': product.name })
      if (pattern) {
        const productNames = pattern.mappedProducts.map((mp: any) => mp.name)
        await Product.updateMany(
          { name: { $in: productNames }, _id: { $ne: product._id } },
          { $set: { grade: body.grade } }
        )
      }
    }
    return NextResponse.json({ ...product, id: product._id?.toString() })
  } catch (error) {
    console.error('PUT /api/products/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const { id } = await params
    await Product.findByIdAndDelete(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/products/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
  }
}
