import { NextResponse } from 'next/server'
import dbConnect from '@/infrastructure/db'
import { EquipmentModel } from '@/modules/production/domain/equipment.model'

export async function GET() {
  try {
    await dbConnect()
    const equipment = await EquipmentModel.find().sort({ type: 1, name: 1 })
    
    // Transform to standard object with string _id
    const transformed = equipment.map(e => ({
      ...e.toObject(),
      id: e._id.toString(),
      _id: undefined
    }))
    
    return NextResponse.json(transformed)
  } catch (error) {
    console.error('Failed to fetch equipment:', error)
    return NextResponse.json(
      { error: 'Failed to fetch equipment' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json()
    await dbConnect()
    
    const equipment = new EquipmentModel(data)
    await equipment.save()
    
    const transformed = {
      ...equipment.toObject(),
      id: equipment._id.toString(),
      _id: undefined
    }
    
    return NextResponse.json(transformed)
  } catch (error) {
    console.error('Failed to create equipment:', error)
    return NextResponse.json(
      { error: 'Failed to create equipment' },
      { status: 500 }
    )
  }
}
