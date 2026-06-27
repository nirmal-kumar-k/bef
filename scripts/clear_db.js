const mongoose = require('mongoose');

// The URI is taken from your .env.local file
const uri = 'mongodb://localhost:27017/bef_foundry';

async function clearDB() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.');
    
    // Get all collections
    const collections = await mongoose.connection.db.collections();
    
    // Drop all collections EXCEPT 'grades'
    let droppedCount = 0;
    for (let collection of collections) {
      if (collection.collectionName !== 'grades') {
        await collection.drop();
        droppedCount++;
      }
    }
    
    console.log('\x1b[32m%s\x1b[0m', `✅ Successfully cleared all data! (Dropped ${droppedCount} collections, preserved 'grades')`);
  } catch (error) {
    console.error('Error clearing database:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

clearDB();
