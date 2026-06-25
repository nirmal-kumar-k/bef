import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/infrastructure/db'
import Schedule from '@/domains/production/models/schedule.model'
import Order from '@/domains/orders/models/order.model'

export async function GET(request: NextRequest) {
  try {
    await dbConnect()
    
    // Ensure Order model is registered before population
    Order.init()

    const schedules = await Schedule.find({}).populate('orderId').lean()
    
    const mapped = schedules.map((s: any) => ({
      id: s._id?.toString(),
      orderId: s.orderId?._id?.toString() || s.orderId,
      date: s.date,
      stage: s.stage,
      // Pass along order details for the UI
      customerOrderNo: s.orderId?.customerOrderNo || 'Unknown',
      customer: s.orderId?.customer || 'Unknown',
      product: s.orderId?.product || '',
      pattern: s.orderId?.pattern || '',
      quantity: s.orderId?.quantity || 0,
      plannedQuantity: s.plannedQuantity || 0,
      actualQuantity: s.actualQuantity || 0,
    }))
    
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
    const schedule = await Schedule.create(body)
    
    // Populate before returning so UI has the order details immediately
    await schedule.populate('orderId')
    
    const obj: any = schedule.toObject()
    
    return NextResponse.json({ 
      id: obj._id?.toString(),
      orderId: obj.orderId?._id?.toString() || obj.orderId,
      date: obj.date,
      stage: obj.stage,
      customerOrderNo: obj.orderId?.customerOrderNo || 'Unknown',
      customer: obj.orderId?.customer || 'Unknown',
      product: obj.orderId?.product || '',
      pattern: obj.orderId?.pattern || '',
      quantity: obj.orderId?.quantity || 0,
      plannedQuantity: obj.plannedQuantity || 0,
      actualQuantity: obj.actualQuantity || 0,
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/schedules error:', error)
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 })
  }
}
