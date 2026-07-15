import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { patterns, patternCoreBoxes, patternProducts } from '@/infrastructure/database/schema'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const pattern = await db.query.patterns.findFirst({
      where: eq(patterns.id, id),
      with: { sharedCoreBoxes: true, mappedProducts: true },
    })
    if (!pattern) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(pattern)
  } catch (error) {
    console.error('GET /api/patterns/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch pattern' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    // Callers (e.g. the edit modal) often spread the full fetched record back
    // as a starting point - strip system-managed fields so they can't leak
    // stale/wrong-typed values (id, createdAt/updatedAt as JSON strings) into
    // the update.
    const { sharedCoreBoxes, mappedProducts, id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...patternData } = body

    // Partial update: only include fields the client actually sent, so a PUT
    // that only touches e.g. mappedProducts can't null out unrelated columns.
    const NUMERIC_FIELDS = new Set(['goodWeight', 'runnerRiserWeight', 'totalWeight'])
    const safePatternData: Record<string, any> = { updatedAt: new Date() }
    for (const [key, value] of Object.entries(patternData)) {
      if (value === undefined) continue
      safePatternData[key] = NUMERIC_FIELDS.has(key) && value != null ? String(value) : value
    }

    const result = await db.transaction(async (tx) => {
      const [pattern] = await tx.update(patterns).set(safePatternData).where(eq(patterns.id, id)).returning()
      if (!pattern) return null

      // Only replace core boxes / mapped products when the client actually
      // sent that field - otherwise leave the existing rows untouched.
      let finalCoreBoxes
      if (sharedCoreBoxes !== undefined) {
        await tx.delete(patternCoreBoxes).where(eq(patternCoreBoxes.patternId, id))
        finalCoreBoxes = sharedCoreBoxes.length
          ? await tx.insert(patternCoreBoxes).values(
              sharedCoreBoxes.map((cb: any) => ({
                patternId: id,
                code: cb.code,
                owner: cb.owner,
                images: cb.images,
                typeOfCore: cb.typeOfCore,
                coreWeight: cb.coreWeight != null ? String(cb.coreWeight) : null,
              }))
            ).returning()
          : []
      } else {
        finalCoreBoxes = await tx.select().from(patternCoreBoxes).where(eq(patternCoreBoxes.patternId, id))
      }

      let finalProducts
      if (mappedProducts !== undefined) {
        await tx.delete(patternProducts).where(eq(patternProducts.patternId, id))
        finalProducts = mappedProducts.length
          ? await tx.insert(patternProducts).values(
              mappedProducts.map((mp: any) => ({
                patternId: id,
                name: mp.name,
                cavities: mp.cavities,
                selectedCoreBoxes: mp.selectedCoreBoxes,
              }))
            ).returning()
          : []
      } else {
        finalProducts = await tx.select().from(patternProducts).where(eq(patternProducts.patternId, id))
      }

      return { ...pattern, sharedCoreBoxes: finalCoreBoxes, mappedProducts: finalProducts }
    })

    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(result)
  } catch (error) {
    console.error('PUT /api/patterns/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update pattern' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.delete(patterns).where(eq(patterns.id, id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/patterns/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete pattern' }, { status: 500 })
  }
}
