const mongoose = require('mongoose');

const uri = 'mongodb://localhost:27017/bef_foundry';

async function clearOldSchedules() {
  try {
    await mongoose.connect(uri);
    console.log('Connected. Clearing schedules, dailyplans, and heats...');
    
    const collectionsToClear = ['schedules', 'dailyplans', 'heats', 'productionplans'];
    for (const collName of collectionsToClear) {
      const coll = mongoose.connection.db.collection(collName);
      if (coll) {
        const res = await coll.deleteMany({});
        console.log(`Deleted ${res.deletedCount} documents from ${collName}.`);
      }
    }
    
    console.log('Successfully cleared old schedule data!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

clearOldSchedules();
