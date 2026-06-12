const { ObjectId } = require('mongodb');
const { optionalEnv, requireEnv } = require('./env');
const { normalizeEmail } = require('./auth');
const { buildStudent } = require('../models/Student');
const { generateMonthlyTasks, makeTaskId } = require('./task-generator');

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

function monthKey(value) {
  if (!value) return '';
  const raw = String(value).trim();
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const iso = raw.match(/^(\d{4})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const named = new Date(`1 ${raw}`);
  if (!Number.isNaN(named.getTime())) return `${named.getFullYear()}-${String(named.getMonth() + 1).padStart(2, '0')}`;
  return raw;
}

function monthLabel(value) {
  const key = monthKey(value);
  if (!key) return '';
  const d = new Date(`${key}-01T00:00:00Z`);
  if (!Number.isNaN(d.getTime())) return d.toLocaleString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  return String(value || '');
}

function automationSecretMatches(input) {
  const expected = requireEnv('AUTOMATION_SECRET');
  return String(input || '').trim() === expected;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

async function getDefaultMentorEmail(db) {
  const fromEnv = normalizeEmail(optionalEnv('DEFAULT_MENTOR_EMAIL'));
  if (fromEnv) return fromEnv;
  const mentor = await db.collection('users').findOne({
    role: { $in: ['mentor', 'admin'] },
    status: { $ne: 'inactive' }
  }, { sort: { role: 1, email: 1 } });
  return mentor ? normalizeEmail(mentor.email) : '';
}

async function buildCoachLookup(db) {
  const users = await db.collection('users').find({
    role: 'coach',
    status: { $ne: 'inactive' }
  }).toArray();
  const byEmail = new Map();
  const byName = new Map();
  const byCoachId = new Map();
  users.forEach((user) => {
    const email = normalizeEmail(user.email);
    const name = normalizeName(user.name);
    if (email) byEmail.set(email, user);
    if (name) byName.set(name, user);
    if (user.coachId) byCoachId.set(String(user.coachId).trim(), user);
  });
  return { byEmail, byName, byCoachId };
}

function enrichStudent(raw, coachLookup, mentorEmail) {
  const student = buildStudent(raw);
  const coach =
    coachLookup.byCoachId.get(student.coachId) ||
    coachLookup.byName.get(normalizeName(student.coachName)) ||
    coachLookup.byEmail.get(normalizeEmail(student.coachEmail));

  const finalCoachEmail = coach ? normalizeEmail(coach.email) : normalizeEmail(student.coachEmail);
  const finalCoachName = coach ? String(coach.name || student.coachName).trim() : student.coachName;
  const finalMentorEmail = normalizeEmail(student.mentorEmail || (coach && coach.mentorEmail) || mentorEmail);

  return {
    ...student,
    coachName: finalCoachName,
    coachEmail: finalCoachEmail,
    mentorEmail: finalMentorEmail,
    parentEmail: normalizeEmail(student.parentEmail || student.email),
    updatedAt: new Date()
  };
}

async function syncStudentsFromRows(db, rows) {
  const coachLookup = await buildCoachLookup(db);
  const mentorEmail = await getDefaultMentorEmail(db);
  let processed = 0;
  let created = 0;
  let updated = 0;
  const missingCoachEmail = [];
  const missingMentorEmail = [];

  for (const row of rows || []) {
    const student = enrichStudent(row, coachLookup, mentorEmail);
    if (!student.studentId || !student.name) continue;
    processed += 1;
    if (!student.coachEmail) missingCoachEmail.push(student.studentId);
    if (!student.mentorEmail) missingMentorEmail.push(student.studentId);

    const existing = await db.collection('students').findOne({ studentId: student.studentId });
    await db.collection('students').updateOne(
      { studentId: student.studentId },
      {
        $set: student,
        $setOnInsert: { createdAt: student.createdAt || new Date() }
      },
      { upsert: true }
    );
    if (existing) updated += 1;
    else created += 1;
  }

  return {
    processed,
    created,
    updated,
    missingCoachEmail,
    missingMentorEmail
  };
}

async function queueJob(db, type, dedupeKey, payload) {
  const existing = await db.collection('notificationJobs').findOne({
    type,
    dedupeKey,
    status: { $in: ['queued', 'processing'] }
  });
  if (existing) return { queued: false, jobId: String(existing._id) };

  const inserted = await db.collection('notificationJobs').insertOne({
    type,
    status: 'queued',
    dedupeKey,
    payload,
    createdAt: new Date()
  });
  return { queued: true, jobId: String(inserted.insertedId) };
}

async function queueCoachLaunchEmails(db, month, options = {}) {
  const key = monthKey(month);
  const coachEmailFilter = normalizeEmail(options.coachEmail);
  const query = { monthKey: key };
  if (coachEmailFilter) query.coachEmail = coachEmailFilter;
  const tasks = await db.collection('feedbackTasks').find(query).toArray();
  const grouped = new Map();
  tasks.forEach((task) => {
    const email = normalizeEmail(task.coachEmail);
    if (!email) return;
    if (!grouped.has(email)) grouped.set(email, []);
    grouped.get(email).push(task);
  });

  let queued = 0;
  for (const [coachEmail, coachTasks] of grouped.entries()) {
    const first = coachTasks[0];
    const result = await queueJob(db, 'coach-task-launch', `coach-task-launch:${key}:${coachEmail}`, {
      coachEmail,
      coachName: first.coachName || '',
      month: monthLabel(key),
      monthKey: key,
      tasks: coachTasks.map((task) => ({
        taskId: task.taskId,
        studentId: task.studentId,
        studentName: task.studentName,
        batchCode: task.batchCode,
        lichessId: task.lichessId
      }))
    });
    if (result.queued) queued += 1;
  }
  return { queued, coaches: grouped.size };
}

async function queueCoachReminders(db, month) {
  const key = monthKey(month);
  const tasks = await db.collection('feedbackTasks').find({
    monthKey: key,
    $or: [
      { submissionStatus: { $in: ['Pending', 'Draft', '', null] } },
      { mentorStatus: 'Returned' }
    ]
  }).toArray();
  const grouped = new Map();
  tasks.forEach((task) => {
    const email = normalizeEmail(task.coachEmail);
    if (!email) return;
    if (!grouped.has(email)) grouped.set(email, []);
    grouped.get(email).push(task);
  });

  let queued = 0;
  for (const [coachEmail, coachTasks] of grouped.entries()) {
    const first = coachTasks[0];
    const result = await queueJob(db, 'coach-reminder', `coach-reminder:${key}:${coachEmail}:${startOfToday().toISOString().slice(0, 10)}`, {
      coachEmail,
      coachName: first.coachName || '',
      month: monthLabel(key),
      monthKey: key,
      tasks: coachTasks.map((task) => ({
        taskId: task.taskId,
        studentId: task.studentId,
        studentName: task.studentName,
        batchCode: task.batchCode,
        taskStatus: task.taskStatus,
        mentorStatus: task.mentorStatus
      }))
    });
    if (result.queued) queued += 1;
  }
  return { queued, coaches: grouped.size };
}

async function queueMentorReminders(db, month) {
  const key = monthKey(month);
  const tasks = await db.collection('feedbackTasks').find({
    monthKey: key,
    submissionStatus: 'Submitted',
    mentorStatus: 'Pending'
  }).toArray();
  const grouped = new Map();
  tasks.forEach((task) => {
    const email = normalizeEmail(task.mentorEmail);
    if (!email) return;
    if (!grouped.has(email)) grouped.set(email, []);
    grouped.get(email).push(task);
  });

  let queued = 0;
  for (const [mentorEmail, mentorTasks] of grouped.entries()) {
    const result = await queueJob(db, 'mentor-reminder', `mentor-reminder:${key}:${mentorEmail}:${startOfToday().toISOString().slice(0, 10)}`, {
      mentorEmail,
      month: monthLabel(key),
      monthKey: key,
      tasks: mentorTasks.map((task) => ({
        taskId: task.taskId,
        studentId: task.studentId,
        studentName: task.studentName,
        coachName: task.coachName,
        batchCode: task.batchCode
      }))
    });
    if (result.queued) queued += 1;
  }
  return { queued, mentors: grouped.size };
}

async function queueParentDelivery(db, month) {
  const query = {
    mentorStatus: 'Approved',
    parentEmail: { $ne: '' },
    $or: [
      { parentEmailSentOn: { $exists: false } },
      { parentEmailSentOn: '' },
      { parentEmailSentOn: null }
    ]
  };
  const key = monthKey(month);
  if (key) query.monthKey = key;
  const tasks = await db.collection('feedbackTasks').find(query).toArray();
  let queued = 0;
  for (const task of tasks) {
    const result = await queueJob(db, 'parent-delivery', `parent-delivery:${task.taskId}`, {
      taskId: task.taskId,
      month: task.month,
      monthKey: task.monthKey,
      parentEmail: task.parentEmail,
      coachName: task.coachName,
      studentName: task.studentName,
      batchCode: task.batchCode,
      feedback: task.feedback || {}
    });
    if (result.queued) queued += 1;
  }
  return { queued, tasks: tasks.length };
}

async function listQueuedJobs(db, type, limit = 20) {
  return db.collection('notificationJobs').find({
    type,
    status: 'queued'
  }).sort({ createdAt: 1 }).limit(limit).toArray();
}

async function claimQueuedJobs(db, type, limit = 20) {
  const jobs = await listQueuedJobs(db, type, limit);
  const claimed = [];
  for (const job of jobs) {
    const result = await db.collection('notificationJobs').findOneAndUpdate(
      { _id: job._id, status: 'queued' },
      { $set: { status: 'processing', processingAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (result) claimed.push(result);
  }
  return claimed;
}

async function completeJob(db, jobId, metadata = {}) {
  const _id = ObjectId.isValid(jobId) ? new ObjectId(jobId) : null;
  if (!_id) throw new Error('Invalid jobId.');
  const job = await db.collection('notificationJobs').findOneAndUpdate(
    { _id },
    {
      $set: {
        status: 'completed',
        completedAt: new Date(),
        result: metadata
      }
    },
    { returnDocument: 'after' }
  );

  if (job && job.type === 'parent-delivery' && job.payload && job.payload.taskId) {
    await db.collection('feedbackTasks').updateOne(
      { taskId: job.payload.taskId },
      { $set: { parentEmailSentOn: new Date().toISOString(), lastUpdated: new Date().toISOString() } }
    );
  }
  return job;
}

async function failJob(db, jobId, errorMessage) {
  const _id = ObjectId.isValid(jobId) ? new ObjectId(jobId) : null;
  if (!_id) throw new Error('Invalid jobId.');
  return db.collection('notificationJobs').findOneAndUpdate(
    { _id },
    {
      $set: {
        status: 'failed',
        failedAt: new Date(),
        error: String(errorMessage || 'Unknown error')
      }
    },
    { returnDocument: 'after' }
  );
}

async function cleanupLichessSnapshots(db, keepLatest = 1) {
  const snapshots = await db.collection('lichessSnapshots').find({}).sort({ createdAt: -1 }).toArray();
  const seen = new Map();
  let deleted = 0;
  for (const snapshot of snapshots) {
    const taskId = String(snapshot.taskId || '');
    const studentId = String(snapshot.studentId || '');
    const key = `${taskId}|${studentId}|${monthKey(snapshot.monthKey || snapshot.month || '')}`;
    const count = seen.get(key) || 0;
    if (count >= keepLatest) {
      await db.collection('lichessSnapshots').deleteOne({ _id: snapshot._id });
      deleted += 1;
      continue;
    }
    seen.set(key, count + 1);
  }
  return { deleted, groups: seen.size };
}

async function getParentDeliveryPayload(db, taskId) {
  const task = await db.collection('feedbackTasks').findOne({ taskId: String(taskId || '').trim() });
  if (!task) throw new Error('Task not found.');
  return {
    taskId: task.taskId,
    month: task.month,
    parentEmail: task.parentEmail,
    studentName: task.studentName,
    coachName: task.coachName,
    batchCode: task.batchCode,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#24172d;padding:24px;max-width:700px;margin:0 auto;background:#fff9e8;border:1px solid #f0ca61;border-radius:18px;">
        <div style="background:linear-gradient(135deg,#2f0a3b,#5a1372);padding:20px 24px;border-radius:14px;color:white;">
          <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#fde75a;font-weight:700;">Envision Chess Academy</div>
          <h2 style="margin:8px 0 0;font-size:28px;line-height:1.1;">Monthly Feedback Report</h2>
        </div>
        <p style="margin:24px 0 8px;">Student: <strong>${task.studentName || ''}</strong></p>
        <p style="margin:0 0 8px;">Coach: <strong>${task.coachName || ''}</strong></p>
        <p style="margin:0 0 18px;">Month: <strong>${task.month || ''}</strong></p>
        <div style="background:#ffffff;border-radius:16px;padding:18px;border:1px solid #eadff0;">
          <p><strong>Strengths</strong><br/>${(task.feedback && task.feedback.strengths) || '-'}</p>
          <p><strong>Improvement Areas</strong><br/>${(task.feedback && task.feedback.improvementAreas) || '-'}</p>
          <p><strong>Focus Next Month</strong><br/>${(task.feedback && task.feedback.focusNextMonth) || '-'}</p>
          <p><strong>Overall Comment</strong><br/>${(task.feedback && task.feedback.overallComment) || '-'}</p>
        </div>
      </div>
    `
  };
}

module.exports = {
  automationSecretMatches,
  cleanupLichessSnapshots,
  claimQueuedJobs,
  completeJob,
  failJob,
  generateMonthlyTasks,
  getParentDeliveryPayload,
  monthKey,
  monthLabel,
  queueCoachLaunchEmails,
  queueCoachReminders,
  queueMentorReminders,
  queueParentDelivery,
  syncStudentsFromRows
};
