import { NextResponse } from 'next/server'
import dbConnect from '@/infrastructure/db'
import { EquipmentModel } from '@/modules/production/domain/equipment.model'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const data = await req.json()
    await dbConnect()
    const { id } = await params
    
    // Remove id fields before update
    const { id: _idField, _id: _mongoId, ...updateData } = data
    
    const equipment = await EquipmentModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
    
    if (!equipment) {
      return NextResponse.json(
        { error: 'Equipment not found' },
        { status: 404 }
      )
    }
    
    const transformed = {
      ...equipment.toObject(),
      id: equipment._id.toString(),
      _id: undefined
    }
    
    return NextResponse.json(transformed)
  } catch (error) {
    console.error('Failed to update equipment:', error)
    return NextResponse.json(
      { error: 'Failed to update equipment' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const { id } = await params
    const equipment = await EquipmentModel.findByIdAndDelete(id)
    
    if (!equipment) {
      return NextResponse.json(
        { error: 'Equipment not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete equipment:', error)
    return NextResponse.json(
      { error: 'Failed to delete equipment' },
      { status: 500 }
    )
  }
}
