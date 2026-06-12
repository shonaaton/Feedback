require('dotenv').config();
const { getDb } = require('../lib/mongo');
const { generateMonthlyTasks, queueCoachLaunchEmails } = require('../lib/automation');

async function run() {
  const db = await getDb();
  const month = process.argv[2] || new Date().toISOString();
  const result = await generateMonthlyTasks(db, month);
  const queue = await queueCoachLaunchEmails(db, month);
  console.log(JSON.stringify({ ...result, coachLaunchEmailsQueued: queue.queued }, null, 2));
  process.exit(0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
