const { MongoClient } = require('mongodb')

const MONGODB_URI = 'mongodb://localhost:27017/bef_foundry'

async function clearCollections() {
  const client = new MongoClient(MONGODB_URI)
  try {
    await client.connect()
    const db = client.db()
    
    // We want to clear products, patterns, orders, and schedules.
    // We KEEP customers (just added Apex) and grades (the science grades).
    const collectionsToClear = ['products', 'patterns', 'orders', 'schedules']
    
    for (const colName of collectionsToClear) {
      const result = await db.collection(colName).deleteMany({})
      console.log(`Cleared ${result.deletedCount} documents from ${colName}`)
    }
    
    console.log('All transactional mock data has been purged.')
  } catch (err) {
    console.error('Clear failed:', err)
  } finally {
    await client.close()
  }
}

clearCollections()
