const { MongoClient } = require('mongodb')

const MONGODB_URI = 'mongodb://localhost:27017/bef_foundry'

async function addSingleCustomer() {
  const client = new MongoClient(MONGODB_URI)
  try {
    await client.connect()
    const db = client.db()
    
    await db.collection('customers').deleteMany({}) // Ensure clean state
    
    const customer = {
      value: 'apex_engineering',
      label: 'Apex Engineering Pvt Ltd',
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    await db.collection('customers').insertOne(customer)
    console.log(`Added customer: ${customer.label}`)
  } catch (err) {
    console.error('Failed:', err)
  } finally {
    await client.close()
  }
}

addSingleCustomer()
