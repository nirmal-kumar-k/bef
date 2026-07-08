import { NextRequest, NextResponse } from 'next/server'
import { desc } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { products } from '@/infrastructure/database/schema'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const rows = await db.select().from(products).orderBy(desc(products.createdAt))
    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET /api/products error:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const insertData = {
      code: body.code,
      name: body.name,
      customer: body.customer,
      weight: body.weight,
      cavities: body.cavities,
      ratePerKg: body.ratePerKg != null ? String(body.ratePerKg) : null,
      unitPrice: body.unitPrice != null ? String(body.unitPrice) : null,
      grade: body.grade,
      remarks: body.remarks,
      images: body.images,
      linkedPattern: body.linkedPattern,
      stock: body.stock,
    }
    const [row] = await db.insert(products).values(insertData).returning()
    return NextResponse.json(row, { status: 201 })
  } catch (error) {
    console.error('POST /api/products error:', error)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}
