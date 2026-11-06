import { NextRequest, NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { products, stockMovements } from '@/infrastructure/database/schema'
import { currentActor } from '@/infrastructure/audit'
import { moveStock } from '@/infrastructure/stock'
import { getSessionUser } from '@/shared/lib/auth'

export const dynamic = 'force-dynamic'

// GET: the product's stock ledger, newest first - "why is stock 412?".
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const [product] = await db.select({ id: products.id, name: products.name, stock: products.stock }).from(products).where(eq(products.id, id))
    if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const movements = await db.select().from(stockMovements).where(eq(stockMovements.productId, id)).orderBy(desc(stockMovements.at)).limit(500)
    return NextResponse.json({ product, movements })
  } catch (error) {
    console.error('GET stock-movements error:', error)
    return NextResponse.json({ error: 'Failed to load stock history' }, { status: 500 })
  }
}

// POST: a manual adjustment after a physical count. The caller sends the
// counted quantity, not a delta, so the adjustment is always relative to the
// stock at this instant (row-locked) - never to a stale number on a screen.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Only an admin can adjust stock' }, { status: 403 })
  }
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const counted = Number(body?.countedStock)
    const note = typeof body?.note === 'string' ? body.note.trim() : ''
    if (!Number.isInteger(counted) || counted < 0) {
      return NextResponse.json({ error: 'Counted stock must be a whole number, 0 or more' }, { status: 400 })
    }
    if (!note) return NextResponse.json({ error: 'A reason is required for a stock adjustment' }, { status: 400 })

    const actor = await currentActor()
    const result = await db.transaction(async (tx) => {
      const [p] = await tx.select({ stock: products.stock }).from(products).where(eq(products.id, id)).for('update')
      if (!p) return null
      const delta = counted - (p.stock ?? 0)
      const moved = await moveStock(tx, actor, { productId: id, delta, reason: 'adjustment', note })
      return { delta, stock: moved ? moved.stock : p.stock }
    })
    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(result)
  } catch (error) {
    console.error('POST stock-movements error:', error)
    return NextResponse.json({ error: 'Failed to adjust stock' }, { status: 500 })
  }
}
