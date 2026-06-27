const { MongoClient } = require('mongodb')

const MONGODB_URI = 'mongodb://localhost:27017/bef_foundry'

async function clear() {
  const client = new MongoClient(MONGODB_URI)
  try {
    await client.connect()
    const db = client.db()
    const result = await db.collection('customers').deleteMany({})
    
    console.log(`Deleted ${result.deletedCount} customers from the database.`)
  } catch (err) {
    console.error('Clear failed:', err)
  } finally {
    await client.close()
  }
}

clear()
