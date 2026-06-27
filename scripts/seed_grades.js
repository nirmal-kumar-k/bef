const mongoose = require('mongoose');

const uri = 'mongodb://localhost:27017/bef_foundry';

const gradesData = [
  { code: 'FC 200', name: 'Grey Cast Iron', c: '3.1-3.4', si: '1.8-2.2', mn: '0.6-0.9', p: '0.15 max', s: '0.12 max' },
  { code: 'FC 250', name: 'Grey Cast Iron', c: '3.0-3.3', si: '1.7-2.1', mn: '0.7-1.0', p: '0.15 max', s: '0.12 max' },
  { code: 'SG 400', name: 'Ductile Iron', c: '3.5-3.8', si: '2.2-2.8', mn: '0.3 max', p: '0.05 max', s: '0.02 max' },
  { code: 'SG 500', name: 'Ductile Iron', c: '3.4-3.7', si: '2.0-2.6', mn: '0.4 max', p: '0.05 max', s: '0.02 max' },
  { code: 'EN 8', name: 'Carbon Steel', c: '0.36-0.44', si: '0.1-0.4', mn: '0.6-1.0', p: '0.05 max', s: '0.05 max' }
];

async function seedGrades() {
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const collection = db.collection('grades');
    
    // Clear only grades first to avoid duplicates
    await collection.deleteMany({});
    
    const docs = gradesData.map(g => ({
      ...g,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    await collection.insertMany(docs);
    console.log('✅ Successfully seeded Grades data!');
  } catch (error) {
    console.error('Error seeding grades:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedGrades();
