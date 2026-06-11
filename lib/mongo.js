const { MongoClient } = require('mongodb');
const { optionalEnv, requireEnv } = require('./env');

const dbName = optionalEnv('MONGODB_DB', 'eca_feedback_portal');
let clientPromise;

function getClientPromise() {
  if (!clientPromise) {
    const client = new MongoClient(requireEnv('MONGODB_URI'));
    clientPromise = client.connect();
  }
  return clientPromise;
}

async function getDb() {
  const client = await getClientPromise();
  return client.db(dbName);
}

module.exports = { getDb };
