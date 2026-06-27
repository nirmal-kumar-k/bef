import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/infrastructure/db'
import Schedule from '@/modules/production/domain/schedule.model'
import Order from '@/modules/orders/domain/order.model'
import Product from '@/modules/products/domain/product.model'

export async function GET(request: NextRequest) {
  try {
    await dbConnect()
    Order.init()

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const query = date ? { date } : {}

    const schedules = await Schedule.find(query).populate('orderId').sort({ priority: 1, createdAt: -1 }).lean()
    
    const products = await Product.find({}, 'code cavities').lean()
    const productMap = new Map()
    products.forEach((p: any) => productMap.set(p.code, p.cavities || 0))
    
    const mapped = schedules.map((s: any) => {
      const cart = s.orderId?.cart || []
      const enrichedCart = cart.map((item: any) => ({
         ...item,
         cavity: productMap.get(item.product) || 1 // default to 1 if not found
      }))
      
      return {
        id: s._id?.toString(),
        orderId: s.orderId?._id?.toString() || s.orderId,
        date: s.date,
        shift: s.shift,
        priority: s.priority,
        status: s.status,
        remarks: s.remarks,
        stages: s.stages,
        
        // Order details for UI convenience
        customerOrderNo: s.orderId?.customerOrderNo || 'Unknown',
        customer: s.orderId?.customer || 'Unknown',
        cart: enrichedCart
      }
    })
    
    return NextResponse.json(mapped)
  } catch (error) {
    console.error('GET /api/schedules error:', error)
    return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect()
    const body = await request.json()
    
    // Support batch creation
    if (Array.isArray(body)) {
      const schedules = await Schedule.insertMany(body)
      return NextResponse.json(schedules, { status: 201 })
    }

    const schedule = await Schedule.create(body)
    await schedule.populate('orderId')
    
    const obj: any = schedule.toObject()
    
    return NextResponse.json({ 
      ...obj,
      id: obj._id?.toString(),
      orderId: obj.orderId?._id?.toString() || obj.orderId,
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/schedules error:', error)
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    await dbConnect()
    const body = await request.json()
    
    // Support batch update (Close Day bulk update)
    if (Array.isArray(body)) {
      const bulkOps = body.map((item: any) => ({
        updateOne: {
          filter: { _id: item.id || item._id },
          update: { $set: { stages: item.stages, status: item.status, remarks: item.remarks } }
        }
      }))
      
      if (bulkOps.length > 0) {
        await Schedule.bulkWrite(bulkOps)
        
        // Post-process: Check if any orders are now fully dispatched
        const orderIds = [...new Set(body.map((item: any) => item.orderId).filter(Boolean))]
        
        for (const oId of orderIds) {
           const allSchedules = await Schedule.find({ orderId: oId })
           const totalDispatched = allSchedules.reduce((sum, s) => sum + (s.stages?.readyForDispatch?.completed || 0), 0)
           
           const order = await Order.findById(oId)
           if (order) {
              const totalOrdered = order.cart.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)
              
              if (totalDispatched >= totalOrdered && order.status !== 'Completed') {
                 order.status = 'Completed'
                 await order.save()
              }
           }
        }
      }
      return NextResponse.json({ message: 'Batch updated successfully' })
    }

    return NextResponse.json({ error: 'Expected an array for batch update' }, { status: 400 })
  } catch (error) {
    console.error('PUT /api/schedules error:', error)
    return NextResponse.json({ error: 'Failed to update schedules' }, { status: 500 })
  }
}
