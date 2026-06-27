const { MongoClient } = require('mongodb')

const MONGODB_URI = 'mongodb://localhost:27017/bef_foundry'

const grades = [
  { code: 'FC 200', name: 'Grey Cast Iron 200', c: '3.1–3.4', si: '1.9–2.3', mn: '0.6–0.9', p: '≤0.15', s: '≤0.12' },
  { code: 'FC 215', name: 'Grey Cast Iron 215', c: '3.1–3.4', si: '1.9–2.3', mn: '0.6–0.9', p: '≤0.15', s: '≤0.12' },
  { code: 'FC 250', name: 'Grey Cast Iron 250', c: '3.0–3.3', si: '1.6–2.0', mn: '0.6–0.9', p: '≤0.12', s: '≤0.10' },
  { code: 'FC 300', name: 'Grey Cast Iron 300', c: '2.9–3.2', si: '1.4–1.8', mn: '0.6–0.9', p: '≤0.10', s: '≤0.10' },
  { code: 'FC 350', name: 'Grey Cast Iron 350', c: '2.7–3.0', si: '1.2–1.6', mn: '0.6–0.9', p: '≤0.10', s: '≤0.10' },
  { code: 'SG 400', name: 'Ductile Iron 400', c: '3.5–3.8', si: '2.2–2.8', mn: '≤0.30', p: '≤0.05', s: '≤0.02' },
  { code: 'SG 500', name: 'Ductile Iron 500', c: '3.4–3.7', si: '2.0–2.6', mn: '≤0.30', p: '≤0.05', s: '≤0.02' },
  { code: 'SG 600', name: 'Ductile Iron 600', c: '3.3–3.6', si: '1.8–2.4', mn: '≤0.30', p: '≤0.05', s: '≤0.02' },
]

async function seed() {
  const client = new MongoClient(MONGODB_URI)
  try {
    await client.connect()
    const db = client.db()
    const collection = db.collection('grades')
    
    // Clear existing grades and insert fresh
    await collection.deleteMany({})
    const result = await collection.insertMany(grades.map(g => ({
      ...g,
      createdAt: new Date(),
      updatedAt: new Date(),
    })))
    
    console.log(`Seeded ${result.insertedCount} grades into the database.`)
  } catch (err) {
    console.error('Seed failed:', err)
  } finally {
    await client.close()
  }
}

seed()
