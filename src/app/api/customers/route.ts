import { NextRequest, NextResponse } from 'next/server'
import { asc } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { customers } from '@/infrastructure/database/schema'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const detailed = searchParams.get('detailed') === 'true'

    const rows = await db.select().from(customers).orderBy(asc(customers.label))

    if (detailed) {
      const mapped = rows.map(c => ({
        id: c.id,
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

    const mapped = rows.map((c) => ({ value: c.value, label: c.label, id: c.id }))
    return NextResponse.json(mapped)
  } catch (error) {
    console.error('GET /api/customers error:', error)
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const insertData = {
      value: body.value,
      label: body.label,
      email: body.email,
      phone: body.phone,
      contactPerson: body.contactPerson,
      address: body.address,
      status: body.status || 'Active',
    }
    const [row] = await db.insert(customers).values(insertData).returning()
    return NextResponse.json(row, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/customers error:', error)
    const message = error?.code === '23505' ? 'A customer with this code already exists' : (error?.message || 'Failed to create customer')
    return NextResponse.json({ error: message }, { status: error?.code === '23505' ? 409 : 500 })
  }
}
