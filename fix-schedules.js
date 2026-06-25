const mongoose = require('mongoose');

async function fix() {
  await mongoose.connect('mongodb://localhost:27017/bef_foundry');
  const schedules = await mongoose.connection.db.collection('schedules').find().toArray();
  const products = await mongoose.connection.db.collection('products').find().toArray();
  const patterns = await mongoose.connection.db.collection('patterns').find().toArray();
  const orders = await mongoose.connection.db.collection('orders').find().toArray();

  let fixedCount = 0;

  for (const s of schedules) {
    if (!s.stages || !s.stages.melting || !s.stages.moulding) continue;
    
    // If moulding is 0, but melting > 0, it's an old record that needs backward calculation
    if (s.stages.moulding.planned === 0 && s.stages.melting.planned > 0) {
       // Backward calculate
       const order = orders.find(o => o._id.toString() === s.orderId.toString());
       if (order && order.cart && order.cart.length > 0) {
          let calculatedMoulds = 0;
          let calculatedPieces = 0;
          let calculatedCores = 0;
          
          order.cart.forEach(item => {
             const product = products.find(p => p.name === item.productName || p.code === item.product);
             const pattern = product && product.linkedPattern ? patterns.find(p => p.code === product.linkedPattern) : null;
             
             const cavities = product ? (product.cavities || 1) : 1;
             const mappedProduct = pattern && pattern.mappedProducts ? pattern.mappedProducts.find(mp => mp.name === product.name) : null;
             const coreBoxesCount = mappedProduct ? (mappedProduct.coreBoxesCount || 0) : 0;
             const boxWeight = pattern ? (pattern.totalWeight || 0) : 0;
             const furnaceCapacity = 150;
             
             // If melting.planned is 90 heats, how many moulds is that?
             // heats = (moulds * boxWeight) / 150
             // moulds = (heats * 150) / boxWeight
             const itemRatio = 1 / order.cart.length;
             const targetHeats = s.stages.melting.planned * itemRatio;
             
             const moulds = boxWeight > 0 ? Math.ceil((targetHeats * furnaceCapacity) / boxWeight) : 0;
             calculatedMoulds += moulds;
             calculatedPieces += (moulds * cavities);
             calculatedCores += (moulds * coreBoxesCount);
          });
          
          s.stages.moulding.planned = calculatedMoulds;
          s.stages.moulding.pending = calculatedMoulds - (s.stages.moulding.completed || 0);
          s.stages.moulding.variance = (s.stages.moulding.completed || 0) - calculatedMoulds;
          
          s.stages.core.planned = calculatedCores;
          s.stages.core.pending = calculatedCores - (s.stages.core.completed || 0);
          
          s.stages.pouring.planned = calculatedMoulds;
          s.stages.pouring.pending = calculatedMoulds - (s.stages.pouring.completed || 0);
          
          s.stages.knockout.planned = calculatedPieces;
          s.stages.knockout.pending = calculatedPieces - (s.stages.knockout.completed || 0);
          
          s.stages.shotBlasting.planned = calculatedPieces;
          s.stages.shotBlasting.pending = calculatedPieces - (s.stages.shotBlasting.completed || 0);
          
          s.stages.grinding.planned = calculatedPieces;
          s.stages.grinding.pending = calculatedPieces - (s.stages.grinding.completed || 0);
          
          s.stages.inspection.planned = calculatedPieces;
          s.stages.inspection.pending = calculatedPieces - (s.stages.inspection.completed || 0);
          
          s.stages.readyForDispatch.planned = calculatedPieces;
          s.stages.readyForDispatch.pending = calculatedPieces - (s.stages.readyForDispatch.completed || 0);
          
          await mongoose.connection.db.collection('schedules').updateOne(
            { _id: s._id },
            { $set: { stages: s.stages } }
          );
          fixedCount++;
       }
    } else if (s.stages.moulding.planned > 0 && s.stages.knockout.planned === 0) {
       // It's a record where they updated moulding but knockout didn't update!
       const order = orders.find(o => o._id.toString() === s.orderId.toString());
       if (order && order.cart && order.cart.length > 0) {
          let calculatedPieces = 0;
          let calculatedCores = 0;
          
          order.cart.forEach(item => {
             const product = products.find(p => p.name === item.productName || p.code === item.product);
             const pattern = product && product.linkedPattern ? patterns.find(p => p.code === product.linkedPattern) : null;
             
             const cavities = product ? (product.cavities || 1) : 1;
             const mappedProduct = pattern && pattern.mappedProducts ? pattern.mappedProducts.find(mp => mp.name === product.name) : null;
             const coreBoxesCount = mappedProduct ? (mappedProduct.coreBoxesCount || 0) : 0;
             
             const itemRatio = 1 / order.cart.length;
             const itemMoulds = Math.ceil(s.stages.moulding.planned * itemRatio);
             
             calculatedPieces += (itemMoulds * cavities);
             calculatedCores += (itemMoulds * coreBoxesCount);
          });
          
          s.stages.core.planned = calculatedCores;
          s.stages.core.pending = calculatedCores - (s.stages.core.completed || 0);
          
          s.stages.pouring.planned = s.stages.moulding.planned;
          s.stages.pouring.pending = s.stages.moulding.planned - (s.stages.pouring.completed || 0);
          
          s.stages.knockout.planned = calculatedPieces;
          s.stages.knockout.pending = calculatedPieces - (s.stages.knockout.completed || 0);
          
          s.stages.shotBlasting.planned = calculatedPieces;
          s.stages.shotBlasting.pending = calculatedPieces - (s.stages.shotBlasting.completed || 0);
          
          s.stages.grinding.planned = calculatedPieces;
          s.stages.grinding.pending = calculatedPieces - (s.stages.grinding.completed || 0);
          
          s.stages.inspection.planned = calculatedPieces;
          s.stages.inspection.pending = calculatedPieces - (s.stages.inspection.completed || 0);
          
          s.stages.readyForDispatch.planned = calculatedPieces;
          s.stages.readyForDispatch.pending = calculatedPieces - (s.stages.readyForDispatch.completed || 0);
          
          await mongoose.connection.db.collection('schedules').updateOne(
            { _id: s._id },
            { $set: { stages: s.stages } }
          );
          fixedCount++;
       }
    }
  }
  console.log(`Fixed ${fixedCount} schedules`);
}

fix().then(() => process.exit()).catch(console.error);
