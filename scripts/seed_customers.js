const mongoose = require('mongoose');

const uri = 'mongodb://localhost:27017/bef_foundry';

const customersData = [
  { value: 'cust-global', label: 'Global Castings Ltd.', email: 'orders@globalcastings.com', phone: '+1 555-0821', address: '450 Foundry Way, Detroit, MI', status: 'Active' },
  { value: 'cust-aspire', label: 'Aspire', email: 'contact@aspire.com', phone: '+1 555-0100', address: 'Aspire Headquarters', status: 'Active' },
  { value: 'cust-apex', label: 'Apex Engineering', email: 'contact@apex.com', phone: '+1 555-0198', address: '123 Industrial Parkway, Suite A', status: 'Active' },
  { value: 'cust-stark', label: 'Stark Industries', email: 'procurement@stark.com', phone: '+1 555-0992', address: '2000 Stark Tower, NY', status: 'Active' }
];

async function seedCustomers() {
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const collection = db.collection('customers');
    
    // Clear only customers first to avoid duplicates
    await collection.deleteMany({});
    
    const docs = customersData.map(c => ({
      ...c,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    await collection.insertMany(docs);
    console.log('✅ Successfully seeded sample Customers data!');
  } catch (error) {
    console.error('Error seeding customers:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedCustomers();
