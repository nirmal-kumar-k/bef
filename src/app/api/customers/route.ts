import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/infrastructure/db'
import Customer from '@/modules/customers/domain/customer.model'

export async function GET(request: NextRequest) {
  try {
    await dbConnect()
    const { searchParams } = new URL(request.url)
    const detailed = searchParams.get('detailed') === 'true'

    const customers = await Customer.find({}).sort({ label: 1 }).lean()
    
    if (detailed) {
      const mapped = customers.map(c => ({
        id: c._id?.toString(),
        value: c.value,
        label: c.label,
        email: c.email || '',
        phone: c.phone || '',
        contactPerson: c.contactPerson || '',
        address: c.address || '',
        status: c.status || 'Active',
      }))
      return NextResponse.json(mapped)
    }

    const mapped = customers.map((c) => ({ value: c.value, label: c.label, id: c._id?.toString() }))
    return NextResponse.json(mapped)
  } catch (error) {
    console.error('GET /api/customers error:', error)
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect()
    const body = await request.json()
    const customer = await Customer.create(body)
    const obj = customer.toObject()
    return NextResponse.json({ value: obj.value, label: obj.label, id: obj._id?.toString() }, { status: 201 })
  } catch (error) {
    console.error('POST /api/customers error:', error)
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 })
  }
}
