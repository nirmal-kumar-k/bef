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
    const { sharedCoreBoxes, mappedProducts, ...patternData } = body

    const safePatternData = {
      code: patternData.code,
      name: patternData.name,
      customer: patternData.customer,
      category: patternData.category,
      goodWeight: patternData.goodWeight != null ? String(patternData.goodWeight) : null,
      runnerRiserWeight: patternData.runnerRiserWeight != null ? String(patternData.runnerRiserWeight) : null,
      totalWeight: patternData.totalWeight != null ? String(patternData.totalWeight) : null,
      topMatchplate: patternData.topMatchplate,
      bottomMatchplate: patternData.bottomMatchplate,
      coreBoxes: patternData.coreBoxes,
      topOwner: patternData.topOwner,
      topImages: patternData.topImages,
      bottomOwner: patternData.bottomOwner,
      bottomImages: patternData.bottomImages,
      avgMouldsPerHour: patternData.avgMouldsPerHour != null ? String(patternData.avgMouldsPerHour) : null,
      patternImages: patternData.patternImages,
      remarks: patternData.remarks,
      updatedAt: new Date(),
    }

    const result = await db.transaction(async (tx) => {
      const [pattern] = await tx.update(patterns).set(safePatternData).where(eq(patterns.id, id)).returning()
      if (!pattern) return null

      await tx.delete(patternCoreBoxes).where(eq(patternCoreBoxes.patternId, id))
      await tx.delete(patternProducts).where(eq(patternProducts.patternId, id))

      const insertedCoreBoxes = sharedCoreBoxes?.length
        ? await tx.insert(patternCoreBoxes).values(
            sharedCoreBoxes.map((cb: any) => ({
              patternId: id,
              code: cb.code,
              owner: cb.owner,
              images: cb.images,
              typeOfCore: cb.typeOfCore,
              coreWeight: cb.coreWeight != null ? String(cb.coreWeight) : null,
              avgCoreProduction: cb.avgCoreProduction,
            }))
          ).returning()
        : []

      const insertedProducts = mappedProducts?.length
        ? await tx.insert(patternProducts).values(
            mappedProducts.map((mp: any) => ({
              patternId: id,
              name: mp.name,
              cavities: mp.cavities,
              selectedCoreBoxes: mp.selectedCoreBoxes,
            }))
          ).returning()
        : []

      return { ...pattern, sharedCoreBoxes: insertedCoreBoxes, mappedProducts: insertedProducts }
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
