import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/infrastructure/db'
import ProductionPlan from '@/modules/production/domain/production-plan.model'
import Product from '@/modules/products/domain/product.model'
import Order from '@/modules/orders/domain/order.model'

export async function POST(request: NextRequest) {
  try {
    await dbConnect()
    const { planIds } = await request.json()
    
    if (!planIds || !Array.isArray(planIds) || planIds.length === 0) {
      return NextResponse.json({ error: 'No plan IDs provided' }, { status: 400 })
    }

    const plans = await ProductionPlan.find({ _id: { $in: planIds }, stage: 'Knockout', isConfirmed: { $ne: true } })
    
    let processed = 0
    for (const plan of plans) {
      if (!plan.actualQuantity || plan.actualQuantity <= 0) continue;

      const order = await Order.findById(plan.orderId);
      if (!order || !order.cart) continue;
      
      const parts = plan.itemId.split('-');
      const idx = parseInt(parts[parts.length - 1], 10);
      const cartItem = order.cart[idx];
      if (!cartItem) continue;

      const productName = cartItem.productName;
      const productCode = cartItem.product;
      
      const product = await Product.findOne({ $or: [{ name: productName }, { code: productCode }] });
      if (product) {
        const cavities = product.cavities || 1;
        const piecesToGenerate = plan.actualQuantity * cavities;
        
        await Product.findByIdAndUpdate(product._id, { $inc: { stock: piecesToGenerate } });
        
        plan.isConfirmed = true;
        await plan.save();
        processed++;
      }
    }

    return NextResponse.json({ success: true, message: `Generated products for ${processed} knockout plans.` })
  } catch (error) {
    console.error('POST /api/knockout-confirm error:', error)
    return NextResponse.json({ error: 'Failed to confirm knockout' }, { status: 500 })
  }
}