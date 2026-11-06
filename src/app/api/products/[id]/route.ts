import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray, ne } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { products, patternProducts } from '@/infrastructure/database/schema'
import { publishOnSuccess } from '@/infrastructure/realtime/route-wrapper'
import { dbErrorResponse } from '@/infrastructure/database/db-error'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const [product] = await db.select().from(products).where(eq(products.id, id))
    if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(product)
  } catch (error) {
    console.error('GET /api/products/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 })
  }
}

async function putHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const updateData = {
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
      // No `stock`: the product form sends back the stock it loaded, which
      // overwrote any inspection that happened while it was open. Stock only
      // changes through the ledger (src/infrastructure/stock).
      updatedAt: new Date()
    }
    
    const [product] = await db.update(products).set(updateData).where(eq(products.id, id)).returning()
    if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Sync grade across all products mapped to the same pattern
    if (body.grade && product.name) {
      const [pp] = await db
        .select({ patternId: patternProducts.patternId })
        .from(patternProducts)
        .where(eq(patternProducts.name, product.name))
        .limit(1)

      if (pp) {
        const siblings = await db
          .select({ name: patternProducts.name })
          .from(patternProducts)
          .where(eq(patternProducts.patternId, pp.patternId))
        const productNames = siblings.map(s => s.name)

        if (productNames.length) {
          await db
            .update(products)
            .set({ grade: body.grade })
            .where(and(inArray(products.name, productNames), ne(products.id, product.id)))
        }
      }
    }
    return NextResponse.json(product)
  } catch (error) {
    console.error('PUT /api/products/[id] error:', error)
    return dbErrorResponse(error, 'Failed to update product')
  }
}

async function deleteHandler(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.delete(products).where(eq(products.id, id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/products/[id] error:', error)
    return dbErrorResponse(error, 'Failed to delete product')
  }
}

// Tell other open screens about successful writes (see src/infrastructure/realtime).
export const PUT = publishOnSuccess('product', 'products', 'update', putHandler)
export const DELETE = publishOnSuccess('product', 'products', 'delete', deleteHandler)
