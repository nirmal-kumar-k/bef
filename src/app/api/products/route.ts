import { NextRequest, NextResponse } from 'next/server'
import { desc } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { products } from '@/infrastructure/database/schema'
import { publishOnSuccess } from '@/infrastructure/realtime/route-wrapper'
import { dbErrorResponse } from '@/infrastructure/database/db-error'

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

async function postHandler(request: NextRequest) {
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
      // No `stock`: finished stock only changes through the stock ledger
      // (src/infrastructure/stock). A new product starts at 0.
    }
    // A client-generated id (assigned the moment the product is created in
    // the UI) makes this idempotent - a double-click or slow-network retry
    // of the same not-yet-confirmed create updates the same row instead of
    // creating a duplicate product.
    const [row] = body.id
      ? await db.insert(products).values({ id: body.id, ...insertData })
          .onConflictDoUpdate({ target: products.id, set: insertData })
          .returning()
      : await db.insert(products).values(insertData).returning()
    return NextResponse.json(row, { status: 201 })
  } catch (error) {
    console.error('POST /api/products error:', error)
    return dbErrorResponse(error, 'Failed to create product')
  }
}

// Tell other open screens about successful writes (see src/infrastructure/realtime).
export const POST = publishOnSuccess('product', 'products', 'create', postHandler)
