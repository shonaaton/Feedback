const { MongoClient } = require('mongodb');
const { buildUser, validateUser } = require('../models/User');

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'eca_feedback_portal';

if (!uri) {
  throw new Error('Missing MONGODB_URI. Add it to your environment before running the seed.');
}

const seedUsers = [
  buildUser({
    email: 'contact@envisionchessacademy.com',
    role: 'mentor',
    name: 'Test Mentor',
    status: 'active'
  }),
  buildUser({
    email: 'sayatanchandra2@gmail.com',
    role: 'coach',
    name: 'Test Coach',
    status: 'active',
    mentorEmail: 'contact@envisionchessacademy.com'
  })
];

async function run() {
  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db(dbName);
    const collection = db.collection('users');

    for (const user of seedUsers) {
      const check = validateUser(user);
      if (!check.ok) {
        throw new Error(`Invalid seed user ${user.email}: ${check.errors.join(', ')}`);
      }

      await collection.updateOne(
        { email: user.email, role: user.role },
        {
          $set: {
            ...user,
            updatedAt: new Date()
          },
          $setOnInsert: {
            createdAt: user.createdAt || new Date()
          }
        },
        { upsert: true }
      );
    }

    console.log(`Seeded ${seedUsers.length} user records into ${dbName}.users`);
  } finally {
    await client.close();
  }
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
