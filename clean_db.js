const { MongoClient } = require('mongodb');

async function cleanData() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  console.log('Connected to DB');
  
  const db = client.db('bef_foundry');

  // 1. Delete all schedules and production plans
  await db.collection('productionplans').deleteMany({});
  await db.collection('schedules').deleteMany({});
  console.log('Cleared all production plans and schedules');

  // 2. Keep only customer Aspire
  await db.collection('customers').deleteMany({ name: { $ne: 'Aspire' } });
  console.log('Cleared all customers except Aspire');

  // 3. Keep only Aspire's received orders
  await db.collection('orders').deleteMany({ 
    $or: [
      { customer: { $ne: 'Aspire' } },
      { status: { $ne: 'Received' } }
    ]
  });
  console.log('Cleared all non-Aspire and non-Received orders');

  // 4. Find which products are used in the remaining Aspire orders
  const remainingOrders = await db.collection('orders').find({}).toArray();
  const usedProductNames = new Set();
  remainingOrders.forEach(o => {
    o.cart?.forEach(item => usedProductNames.add(item.productName));
  });
  
  const productNamesArr = Array.from(usedProductNames);
  console.log('Products to retain:', productNamesArr);

  // 5. Delete unused products
  if (productNamesArr.length > 0) {
    await db.collection('products').deleteMany({ name: { $nin: productNamesArr } });
  } else {
    await db.collection('products').deleteMany({});
  }
  console.log('Cleared unused products');

  // 6. Delete unused patterns
  const remainingProducts = await db.collection('products').find({}).toArray();
  const remainingProductNames = remainingProducts.map(p => p.name);
  
  if (remainingProductNames.length > 0) {
    await db.collection('patterns').deleteMany({ 'mappedProducts.name': { $nin: remainingProductNames } });
  } else {
    await db.collection('patterns').deleteMany({});
  }
  console.log('Cleared unused patterns');

  console.log('Database cleanup completed successfully!');
  await client.close();
}

cleanData().catch(console.error);
