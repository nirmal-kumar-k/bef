const mongoose = require('mongoose');

const uri = 'mongodb://localhost:27017/bef_foundry';

async function clearTestData() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.');
    
    // 1. Get the "Aspire" customer
    const Customer = mongoose.connection.db.collection('customers');
    const aspireCustomer = await Customer.findOne({ name: { $regex: /aspire/i } });
    
    if (!aspireCustomer) {
      console.log('Aspire customer not found! Exiting safely.');
      process.exit(1);
    }
    
    console.log('Found Aspire customer:', aspireCustomer.name);
    
    // 2. Delete all customers EXCEPT Aspire
    const custRes = await Customer.deleteMany({ _id: { $ne: aspireCustomer._id } });
    console.log(`Deleted ${custRes.deletedCount} customers.`);
    
    // 3. Delete all products EXCEPT those belonging to Aspire
    const Product = mongoose.connection.db.collection('products');
    const prodRes = await Product.deleteMany({ customerId: { $ne: aspireCustomer._id } });
    console.log(`Deleted ${prodRes.deletedCount} products.`);
    
    // Get the IDs of remaining Aspire products
    const aspireProducts = await Product.find({ customerId: aspireCustomer._id }).toArray();
    const aspireProductIds = aspireProducts.map(p => p._id.toString());
    
    // 4. Delete all patterns EXCEPT those mapping to Aspire products
    const Pattern = mongoose.connection.db.collection('patterns');
    const allPatterns = await Pattern.find({}).toArray();
    let patternsDeleted = 0;
    for (const pat of allPatterns) {
      // Check if any mappedProduct is in aspireProductIds
      const hasAspireProd = pat.mappedProducts && pat.mappedProducts.some(mp => aspireProductIds.includes(mp.toString()));
      if (!hasAspireProd) {
        await Pattern.deleteOne({ _id: pat._id });
        patternsDeleted++;
      }
    }
    console.log(`Deleted ${patternsDeleted} patterns.`);

    // 5. Delete all transactional data
    const collectionsToClear = ['orders', 'schedules', 'dailyplans', 'heats'];
    for (const collName of collectionsToClear) {
      const coll = mongoose.connection.db.collection(collName);
      if (coll) {
        const res = await coll.deleteMany({});
        console.log(`Deleted ${res.deletedCount} documents from ${collName}.`);
      }
    }
    
    console.log('\x1b[32m%s\x1b[0m', '✅ Successfully cleared test data while preserving Aspire data and Master tables (Grades, Equipment, Shifts)!');
  } catch (error) {
    console.error('Error clearing database:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

clearTestData();
