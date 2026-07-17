import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { schedules as schedulesTable } from '@/infrastructure/database/schema'
import { replaceStages } from '../_stage-helpers'
import { toLocalDateString } from '@/shared/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const { date, schedules } = await request.json()

    if (!date || !schedules || !Array.isArray(schedules)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    await db.transaction(async (tx) => {
      // 1. Mark existing schedules as Completed
      for (const s of schedules) {
        await tx.update(schedulesTable).set({ status: 'Completed' }).where(eq(schedulesTable.id, s.id))
        await replaceStages(tx, s.id, s.stages)
      }
    })

    // 2. Generate Carry Forward Schedules
    const tomorrow = new Date(date)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = toLocalDateString(tomorrow)
    
    const displayDate = new Date(date).toLocaleDateString(undefined, { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    })
    
    const newSchedules: any[] = []
    
    for (const s of schedules) {
      let hasCarryForward = false
      const newStages = JSON.parse(JSON.stringify(s.stages))
      
      Object.keys(newStages).forEach(key => {
        const stage = newStages[key]
        
        let carryForwardQuantity = 0;
        
        if (stage.planned > 0) {
           if (stage.completed < stage.planned) {
              // Shortfall
              carryForwardQuantity += (stage.planned - stage.completed)
           } else if (stage.completed > stage.planned) {
              // Over-production
              carryForwardQuantity = 0
           }
        }
        
        // Add reworks to carry forward
        if (stage.rework && stage.rework > 0) {
           carryForwardQuantity += stage.rework
        }
        
        if (carryForwardQuantity > 0) {
           stage.planned = carryForwardQuantity
           stage.completed = 0
           stage.pending = carryForwardQuantity
           stage.variance = -carryForwardQuantity
           stage.rework = 0
           stage.rejected = 0
           hasCarryForward = true
        } else {
           stage.planned = 0
           stage.completed = 0
           stage.pending = 0
           stage.variance = 0
           stage.rework = 0
           stage.rejected = 0
        }
      })
      
      if (hasCarryForward) {
         newSchedules.push({
            orderId: s.orderId || s.orderId?._id || s.orderId,
            date: tomorrowStr,
            shift: s.shift,
            priority: s.priority,
            remarks: 'Carried forward from ' + displayDate,
            status: 'Planned',
            stages: newStages
         })
      }
    }
    
    if (newSchedules.length > 0) {
      await db.transaction(async (tx) => {
        for (const ns of newSchedules) {
          const { stages, ...scheduleData } = ns
          const [schedule] = await tx.insert(schedulesTable).values(scheduleData).returning()
          await replaceStages(tx, schedule.id, stages)
        }
      })
    }

    return NextResponse.json({ success: true, carriedForward: newSchedules.length })
  } catch (error) {
    console.error('POST /api/schedules/close-day error:', error)
    return NextResponse.json({ error: 'Failed to close day' }, { status: 500 })
  }
}
