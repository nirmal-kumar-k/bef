import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { schedules, products, orders } from '@/infrastructure/database/schema'
import { stageRowsToObject, replaceStages } from './_stage-helpers'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')

    const rows = await db.query.schedules.findMany({
      where: date ? eq(schedules.date, date) : undefined,
      with: { order: { with: { cart: true } }, stages: true },
      orderBy: (schedules, { asc, desc }) => [asc(schedules.priority), desc(schedules.createdAt)],
    })

    const productRows = await db.select({ code: products.code, cavities: products.cavities }).from(products)
    const productMap = new Map(productRows.map(p => [p.code, p.cavities || 0]))

    const mapped = rows.map((s: any) => {
      const cart = s.order?.cart || []
      const enrichedCart = cart.map((item: any) => ({
        ...item,
        cavity: productMap.get(item.product) || 1,
      }))

      return {
        id: s.id,
        orderId: s.orderId,
        date: s.date,
        shift: s.shift,
        priority: s.priority,
        status: s.status,
        remarks: s.remarks,
        stages: stageRowsToObject(s.stages),

        customerOrderNo: s.order?.customerOrderNo || 'Unknown',
        customer: s.order?.customer || 'Unknown',
        cart: enrichedCart,
      }
    })

    return NextResponse.json(mapped)
  } catch (error) {
    console.error('GET /api/schedules error:', error)
    return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 })
  }
}

async function createSchedule(tx: any, item: any) {
  const { stages, ...scheduleData } = item
  const [schedule] = await tx.insert(schedules).values(scheduleData).returning()
  const stagesObj = await replaceStages(tx, schedule.id, stages)
  return { ...schedule, stages: stagesObj }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const result = await db.transaction(async (tx) => {
      if (Array.isArray(body)) {
        const created = []
        for (const item of body) created.push(await createSchedule(tx, item))
        return created
      }
      return createSchedule(tx, body)
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('POST /api/schedules error:', error)
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    if (!Array.isArray(body)) {
      return NextResponse.json({ error: 'Expected an array for batch update' }, { status: 400 })
    }

    await db.transaction(async (tx) => {
      for (const item of body) {
        const scheduleId = item.id || item._id
        await tx.update(schedules).set({ status: item.status, remarks: item.remarks }).where(eq(schedules.id, scheduleId))
        await replaceStages(tx, scheduleId, item.stages)
      }

      // Post-process: Check if any orders are now fully dispatched
      const orderIds = [...new Set(body.map((item: any) => item.orderId).filter(Boolean))] as string[]

      for (const oId of orderIds) {
        const allSchedules = await tx.query.schedules.findMany({
          where: eq(schedules.orderId, oId),
          with: { stages: true },
        })
        const totalDispatched = allSchedules.reduce((sum, s) => {
          const dispatchStage = s.stages.find(st => st.stageName === 'readyForDispatch')
          return sum + (dispatchStage?.completed || 0)
        }, 0)

        const order = await tx.query.orders.findFirst({
          where: (orders, { eq }) => eq(orders.id, oId),
          with: { cart: true },
        })
        if (order) {
          const totalOrdered = order.cart.reduce((sum, item) => sum + (item.quantity || 0), 0)
          if (totalDispatched >= totalOrdered && order.status !== 'Completed') {
            await tx.update(orders).set({ status: 'Completed' }).where(eq(orders.id, oId))
          }
        }
      }
    })

    return NextResponse.json({ message: 'Batch updated successfully' })
  } catch (error) {
    console.error('PUT /api/schedules error:', error)
    return NextResponse.json({ error: 'Failed to update schedules' }, { status: 500 })
  }
}
