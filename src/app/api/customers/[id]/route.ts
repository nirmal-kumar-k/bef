import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { customers } from '@/infrastructure/database/schema'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const [customer] = await db.select().from(customers).where(eq(customers.id, id))
    if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(customer)
  } catch (error) {
    console.error('GET /api/customers/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch customer' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const updateData = {
      value: body.value,
      label: body.label,
      email: body.email,
      phone: body.phone,
      contactPerson: body.contactPerson,
      address: body.address,
      status: body.status,
      updatedAt: new Date(),
    }

    const [customer] = await db.update(customers).set(updateData).where(eq(customers.id, id)).returning()
    if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(customer)
  } catch (error: any) {
    console.error('PUT /api/customers/[id] error:', error)
    const message = error?.code === '23505' ? 'A customer with this code already exists' : (error?.message || 'Failed to update customer')
    return NextResponse.json({ error: message }, { status: error?.code === '23505' ? 409 : 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.delete(customers).where(eq(customers.id, id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/customers/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 })
  }
}
