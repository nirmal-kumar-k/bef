import { NextRequest, NextResponse } from 'next/server'
import { eq, inArray } from 'drizzle-orm'
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
        // Reconcile in place instead of delete-all-then-reinsert - a wholesale
        // replace hands every core box a brand new random id on every save,
        // even ones the user didn't touch, permanently orphaning every
        // product mapping's stored coreBoxId reference to them. That's what
        // made previously-selected core boxes look unchecked (and, once
        // re-toggled to "fix" it, double-counted) after any unrelated edit
        // to the pattern's core-box list, like adding one new box.
        const existingRows = await tx.select().from(patternCoreBoxes).where(eq(patternCoreBoxes.patternId, id))
        const existingIds = new Set(existingRows.map(r => r.id))
        const keepIds = new Set(sharedCoreBoxes.filter((cb: any) => cb.id && existingIds.has(cb.id)).map((cb: any) => cb.id))
        const idsToRemove = existingRows.filter(r => !keepIds.has(r.id)).map(r => r.id)
        if (idsToRemove.length > 0) {
          await tx.delete(patternCoreBoxes).where(inArray(patternCoreBoxes.id, idsToRemove))
        }

        finalCoreBoxes = []
        for (const cb of sharedCoreBoxes) {
          const values = {
            code: cb.code,
            owner: cb.owner,
            images: cb.images,
            typeOfCore: cb.typeOfCore,
            coreWeight: cb.coreWeight != null ? String(cb.coreWeight) : null,
          }
          if (cb.id && existingIds.has(cb.id)) {
            const [row] = await tx.update(patternCoreBoxes).set(values).where(eq(patternCoreBoxes.id, cb.id)).returning()
            finalCoreBoxes.push(row)
          } else {
            const [row] = await tx.insert(patternCoreBoxes).values({ patternId: id, ...values }).returning()
            finalCoreBoxes.push(row)
          }
        }
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
