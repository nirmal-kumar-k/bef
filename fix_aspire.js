const { MongoClient } = require('mongodb');

async function fixAspire() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('bef_foundry');
  
  // Find Aspire
  const aspire = await db.collection('customers').findOne({ name: 'Aspire' });
  if (aspire && !aspire.value) {
    await db.collection('customers').updateOne(
      { _id: aspire._id },
      { $set: { value: 'aspire', label: 'Aspire' } }
    );
    console.log('Fixed Aspire to have value and label');
  } else {
    console.log('Aspire is fine or does not exist');
  }
  
  await client.close();
}

fixAspire().catch(console.error);
