/**
 * setup-indexes.js
 *
 * - Creates all required collections
 * - Adds all indexes (unique + TTL)
 * - Validates active students for task-readiness
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." node scripts/setup-indexes.js
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) { console.error('MONGODB_URI not set'); process.exit(1); }

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();
  console.log(`Connected to: ${db.databaseName}\n`);

  // ── 1. Ensure all collections exist ───────────────────────────────────────
  const required = [
    'users',
    'students',
    'feedbackTasks',
    'feedbackHistory',
    'feedbackSubmissions',
    'otpCodes',
    'sessions',
    'notificationJobs',
    'lichessSnapshots',
  ];

  const existing = (await db.listCollections().toArray()).map(c => c.name);
  console.log('── Collections ──────────────────────────────────');
  for (const name of required) {
    if (!existing.includes(name)) {
      await db.createCollection(name);
      console.log(`  created : ${name}`);
    } else {
      console.log(`  exists  : ${name}`);
    }
  }

  // ── 2. Standard indexes ────────────────────────────────────────────────────
  console.log('\n── Indexes ──────────────────────────────────────');

  const indexes = [
    // users
    {
      col: 'users',
      spec: { email: 1 },
      opts: { unique: true, name: 'users_email_unique' },
    },
    {
      col: 'users',
      spec: { email: 1, role: 1 },
      opts: { unique: true, name: 'users_email_role_unique' },
    },
    // students
    {
      col: 'students',
      spec: { studentId: 1 },
      opts: { unique: true, name: 'students_studentId_unique' },
    },
    {
      col: 'students',
      spec: { isActive: 1 },
      opts: { name: 'students_isActive' },
    },
    {
      col: 'students',
      spec: { coachId: 1 },
      opts: { name: 'students_coachId' },
    },
    // feedbackTasks
    {
      col: 'feedbackTasks',
      spec: { taskId: 1 },
      opts: { unique: true, name: 'feedbackTasks_taskId_unique' },
    },
    {
      col: 'feedbackTasks',
      spec: { monthKey: 1, studentId: 1, coachEmail: 1 },
      opts: { unique: true, name: 'feedbackTasks_month_student_coach_unique' },
    },
    {
      col: 'feedbackTasks',
      spec: { coachEmail: 1, monthKey: 1 },
      opts: { name: 'feedbackTasks_coach_month' },
    },
    {
      col: 'feedbackTasks',
      spec: { mentorEmail: 1, mentorStatus: 1 },
      opts: { name: 'feedbackTasks_mentor_status' },
    },
    {
      col: 'feedbackTasks',
      spec: { monthKey: 1 },
      opts: { name: 'feedbackTasks_monthKey' },
    },
    // feedbackHistory
    {
      col: 'feedbackHistory',
      spec: { submissionId: 1 },
      opts: { unique: true, sparse: true, name: 'feedbackHistory_submissionId_unique' },
    },
    {
      col: 'feedbackHistory',
      spec: { studentId: 1, monthKey: 1 },
      opts: { name: 'feedbackHistory_student_month' },
    },
    {
      col: 'feedbackHistory',
      spec: { coachEmail: 1, monthKey: 1 },
      opts: { name: 'feedbackHistory_coach_month' },
    },
    // feedbackSubmissions
    {
      col: 'feedbackSubmissions',
      spec: { taskId: 1 },
      opts: { unique: true, name: 'feedbackSubmissions_taskId_unique' },
    },
    // sessions
    {
      col: 'sessions',
      spec: { sessionToken: 1 },
      opts: { unique: true, name: 'sessions_sessionToken_unique' },
    },
    {
      col: 'sessions',
      spec: { email: 1 },
      opts: { name: 'sessions_email' },
    },
    // notificationJobs
    {
      col: 'notificationJobs',
      spec: { status: 1, scheduledFor: 1 },
      opts: { name: 'notificationJobs_status_scheduled' },
    },
    // lichessSnapshots
    {
      col: 'lichessSnapshots',
      spec: { studentId: 1, monthKey: 1 },
      opts: { unique: true, name: 'lichessSnapshots_student_month_unique' },
    },
  ];

  for (const { col, spec, opts } of indexes) {
    try {
      await db.collection(col).createIndex(spec, opts);
      console.log(`  ok : ${col} → ${opts.name}`);
    } catch (err) {
      if (err.codeName === 'IndexOptionsConflict' || err.code === 85 || err.code === 86) {
        console.log(`  skip (exists) : ${col} → ${opts.name}`);
      } else {
        console.warn(`  WARN : ${col} → ${opts.name} : ${err.message}`);
      }
    }
  }

  // ── 3. TTL indexes ─────────────────────────────────────────────────────────
  console.log('\n── TTL Indexes ──────────────────────────────────');
  const ttlIndexes = [
    {
      col: 'otpCodes',
      spec: { expiresAt: 1 },
      opts: { expireAfterSeconds: 0, name: 'otpCodes_ttl' },
    },
    {
      col: 'sessions',
      spec: { expiresAt: 1 },
      opts: { expireAfterSeconds: 0, name: 'sessions_ttl' },
    },
  ];

  for (const { col, spec, opts } of ttlIndexes) {
    try {
      await db.collection(col).createIndex(spec, opts);
      console.log(`  ok : ${col} → ${opts.name} (TTL)`);
    } catch (err) {
      if (err.code === 85 || err.code === 86) {
        console.log(`  skip (exists) : ${col} → ${opts.name}`);
      } else {
        console.warn(`  WARN : ${col} → ${opts.name} : ${err.message}`);
      }
    }
  }

  // ── 4. Validate active students for task-readiness ─────────────────────────
  console.log('\n── Student Task-Readiness Check ─────────────────');
  const allActive = await db.collection('students').find({ isActive: true }).toArray();
  console.log(`  Active students: ${allActive.length}`);

  const missing = {
    coachEmail:  [],
    mentorEmail: [],
    both:        [],
  };

  for (const s of allActive) {
    const noCoach  = !s.coachEmail  || s.coachEmail.trim()  === '';
    const noMentor = !s.mentorEmail || s.mentorEmail.trim() === '';
    if (noCoach && noMentor) missing.both.push(s.studentId);
    else if (noCoach)        missing.coachEmail.push(s.studentId);
    else if (noMentor)       missing.mentorEmail.push(s.studentId);
  }

  const taskReady = allActive.length - missing.both.length - missing.coachEmail.length - missing.mentorEmail.length;
  console.log(`  Task-ready:      ${taskReady} / ${allActive.length}`);

  if (missing.both.length)        console.warn(`  MISSING coachEmail+mentorEmail: ${missing.both.join(', ')}`);
  if (missing.coachEmail.length)  console.warn(`  MISSING coachEmail only:        ${missing.coachEmail.join(', ')}`);
  if (missing.mentorEmail.length) console.warn(`  MISSING mentorEmail only:       ${missing.mentorEmail.join(', ')}`);
  if (taskReady === allActive.length) console.log('  All active students are task-ready ✓');

  console.log('\nDone.');
  await client.close();
}

main().catch(err => { console.error(err); process.exit(1); });
