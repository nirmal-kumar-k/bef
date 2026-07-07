import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray, ne } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { products, patternProducts } from '@/infrastructure/database/schema'

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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const [product] = await db.update(products).set(body).where(eq(products.id, id)).returning()
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
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.delete(products).where(eq(products.id, id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/products/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
  }
}
