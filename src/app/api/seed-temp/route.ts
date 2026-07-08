import { NextResponse } from 'next/server'
import { db } from '@/infrastructure/database/client'
import { grades } from '@/infrastructure/database/schema/grades.schema'
import { customers } from '@/infrastructure/database/schema/customers.schema'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const hardcodedGrades = [
      { code: 'FC 200', name: 'Grey Cast Iron 200', c: '3.1-3.4', si: '1.8-2.2', mn: '0.6-0.9', p: '0.1 max', s: '0.1 max' },
      { code: 'FC 250', name: 'Grey Cast Iron 250', c: '2.8-3.2', si: '1.5-2.0', mn: '0.6-0.9', p: '0.1 max', s: '0.1 max' },
      { code: 'FC 300', name: 'Grey Cast Iron 300', c: '2.8-3.1', si: '1.3-1.7', mn: '0.8-1.2', p: '0.1 max', s: '0.1 max' },
      { code: 'FC 350', name: 'Grey Cast Iron 350', c: '2.8-3.1', si: '1.2-1.6', mn: '0.8-1.2', p: '0.1 max', s: '0.1 max' },
      { code: 'SG 400', name: 'Ductile Iron 400', c: '3.5-3.8', si: '2.2-2.8', mn: '0.3 max', p: '0.05 max', s: '0.02 max' },
      { code: 'SG 500', name: 'Ductile Iron 500', c: '3.5-3.8', si: '2.0-2.6', mn: '0.3-0.6', p: '0.05 max', s: '0.02 max' },
      { code: 'SG 600', name: 'Ductile Iron 600', c: '3.4-3.7', si: '1.8-2.4', mn: '0.4-0.7', p: '0.05 max', s: '0.02 max' },
    ]
    
    for (const g of hardcodedGrades) {
      await db.insert(grades).values(g).onConflictDoNothing()
    }

    await db.insert(customers).values({
      value: 'aspire',
      label: 'Aspire',
      status: 'Active',
    }).onConflictDoNothing()

    return NextResponse.json({ success: true, message: 'Seeded Aspire and Grades successfully!' })
  } catch (error: any) {
    console.error('Seed error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
