import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/infrastructure/db'
import Schedule from '@/modules/production/domain/schedule.model'
import Product from '@/modules/products/domain/product.model'

export async function POST(request: NextRequest) {
  try {
    await dbConnect()
    const { itemIds } = await request.json()
    
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 })
    }

    const schedules = await Schedule.find({ orderId: { $in: itemIds } })
    
    for (const sched of schedules) {
      const ko = sched.stages?.knockout
      if (ko && ko.pending > 0) {
        const piecesToGenerate = ko.pending
        
        // 1. Update Product Stock
        const productName = sched.cart?.[0]?.productName
        const productCode = sched.cart?.[0]?.product
        if (productName || productCode) {
           await Product.findOneAndUpdate(
             { $or: [{ name: productName }, { code: productCode }] },
             { $inc: { stock: piecesToGenerate } }
           )
        }
        
        // 2. Update Schedule Knockout Stage
        ko.completed += piecesToGenerate
        ko.pending = 0
        await sched.save()
      }
    }

    return NextResponse.json({ success: true, message: 'Products generated and Knockout confirmed.' })
  } catch (error) {
    console.error('POST /api/knockout-confirm error:', error)
    return NextResponse.json({ error: 'Failed to confirm knockout' }, { status: 500 })
  }
}