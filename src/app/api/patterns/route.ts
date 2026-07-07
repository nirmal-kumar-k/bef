import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/infrastructure/database/client'
import { patterns, patternCoreBoxes, patternProducts } from '@/infrastructure/database/schema'

export async function GET() {
  try {
    const rows = await db.query.patterns.findMany({
      with: { sharedCoreBoxes: true, mappedProducts: true },
      orderBy: (patterns, { desc }) => [desc(patterns.createdAt)],
    })
    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET /api/patterns error:', error)
    return NextResponse.json({ error: 'Failed to fetch patterns' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sharedCoreBoxes, mappedProducts, ...patternData } = body

    const result = await db.transaction(async (tx) => {
      const [pattern] = await tx.insert(patterns).values(patternData).returning()

      const insertedCoreBoxes = sharedCoreBoxes?.length
        ? await tx.insert(patternCoreBoxes).values(
            sharedCoreBoxes.map((cb: any) => ({
              patternId: pattern.id,
              code: cb.code,
              owner: cb.owner,
              images: cb.images,
              typeOfCore: cb.typeOfCore,
              coreWeight: cb.coreWeight,
              avgCoreProduction: cb.avgCoreProduction,
            }))
          ).returning()
        : []

      const insertedProducts = mappedProducts?.length
        ? await tx.insert(patternProducts).values(
            mappedProducts.map((mp: any) => ({
              patternId: pattern.id,
              name: mp.name,
              cavities: mp.cavities,
              selectedCoreBoxes: mp.selectedCoreBoxes,
            }))
          ).returning()
        : []

      return { ...pattern, sharedCoreBoxes: insertedCoreBoxes, mappedProducts: insertedProducts }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('POST /api/patterns error:', error)
    return NextResponse.json({ error: 'Failed to create pattern' }, { status: 500 })
  }
}
