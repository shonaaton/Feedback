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
    const { createdAt, ...studentForSet } = student;
    await db.collection('students').updateOne(
      { studentId: student.studentId },
      {
        $set: studentForSet,
        $setOnInsert: { createdAt: createdAt || new Date() }
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
  const query = {
    submissionStatus: 'Submitted',
    mentorStatus: 'Pending'
  };
  if (key) query.monthKey = key;

  const tasks = await db.collection('feedbackTasks').find(query).toArray();
  const grouped = new Map();
  tasks.forEach((task) => {
    const email = normalizeEmail(task.mentorEmail);
    if (!email) return;
    if (!grouped.has(email)) grouped.set(email, []);
    grouped.get(email).push(task);
  });

  let queued = 0;
  for (const [mentorEmail, mentorTasks] of grouped.entries()) {
    const dedupeMonth = key || 'all-pending';
    const result = await queueJob(db, 'mentor-reminder', `mentor-reminder:${dedupeMonth}:${mentorEmail}:${startOfToday().toISOString().slice(0, 10)}`, {
      mentorEmail,
      month: key ? monthLabel(key) : 'All pending months',
      monthKey: key,
      tasks: mentorTasks.map((task) => ({
        taskId: task.taskId,
        studentId: task.studentId,
        studentName: task.studentName,
        coachName: task.coachName,
        batchCode: task.batchCode,
        month: task.month,
        monthKey: task.monthKey
      }))
    });
    if (result.queued) queued += 1;
  }
  return { queued, mentors: grouped.size };
}

async function queueParentDelivery(db, month) {
  const query = {
    mentorStatus: 'Approved',
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
    const student = task.studentId
      ? await db.collection('students').findOne({ studentId: String(task.studentId).trim() })
      : null;
    const fallbackParentEmail = normalizeEmail(
      task.parentEmail ||
      (student && (student.parentEmail || student.email)) ||
      task.studentEmail
    );
    if (!fallbackParentEmail) continue;

    if (fallbackParentEmail !== normalizeEmail(task.parentEmail)) {
      await db.collection('feedbackTasks').updateOne(
        { taskId: task.taskId },
        {
          $set: {
            parentEmail: fallbackParentEmail,
            parentEmailResolvedOn: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
          }
        }
      );
    }

    const result = await queueJob(db, 'parent-delivery', `parent-delivery:${task.taskId}`, {
      taskId: task.taskId,
      month: task.month,
      monthKey: task.monthKey,
      parentEmail: fallbackParentEmail,
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
  const student = task.studentId
    ? await db.collection('students').findOne({ studentId: String(task.studentId).trim() })
    : null;
  const resolvedParentEmail = normalizeEmail(
    task.parentEmail ||
    (student && (student.parentEmail || student.email)) ||
    task.studentEmail
  );
  const feedback = task.feedback || {};
  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const show = (value, fallback = 'Not shared this month') => {
    const text = String(value ?? '').trim();
    return escapeHtml(text || fallback);
  };
  const metric = (label, value) => `
    <div style="padding:14px 16px;border-radius:16px;background:#ffffff;border:1px solid #ecdff4;min-width:0;">
      <div style="font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:#6b5876;font-weight:700;">${escapeHtml(label)}</div>
      <div style="margin-top:8px;font-size:20px;font-weight:800;color:#24172d;word-break:break-word;">${show(value, 'NA')}</div>
    </div>
  `;
  return {
    taskId: task.taskId,
    month: task.month,
    parentEmail: resolvedParentEmail,
    studentName: task.studentName,
    coachName: task.coachName,
    batchCode: task.batchCode,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#24172d;padding:24px;max-width:760px;margin:0 auto;background:#fff9e8;border:1px solid #f0ca61;border-radius:24px;">
        <div style="background:linear-gradient(135deg,#2f0a3b,#5a1372);padding:24px 26px;border-radius:18px;color:white;">
          <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#fde75a;font-weight:700;">Envision Chess Academy</div>
          <h2 style="margin:10px 0 6px;font-size:30px;line-height:1.1;">Monthly Feedback Report</h2>
          <div style="color:rgba(255,255,255,.78);font-size:14px;">A structured snapshot of progress, performance, and next steps for this month.</div>
        </div>

        <div style="margin-top:18px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;">
          ${metric('Student', task.studentName || '-')}
          ${metric('Coach', task.coachName || '-')}
          ${metric('Month', task.month || '-')}
        </div>

        <div style="margin-top:18px;padding:18px;border-radius:18px;background:rgba(255,255,255,.82);border:1px solid #eadff0;">
          <div style="font-size:13px;letter-spacing:1.8px;text-transform:uppercase;color:#5a1372;font-weight:800;">Student Snapshot</div>
          <div style="margin-top:10px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 18px;color:#3d3147;">
            <div><strong style="color:#24172d;">Batch Code:</strong> ${show(task.batchCode, 'Not assigned')}</div>
            <div><strong style="color:#24172d;">Lichess ID:</strong> ${show(task.lichessId, 'Not shared')}</div>
            <div><strong style="color:#24172d;">Skill Level:</strong> ${show(feedback.skillLevel)}</div>
            <div><strong style="color:#24172d;">Class Performance:</strong> ${show(feedback.classPerformance)}</div>
            <div><strong style="color:#24172d;">Puzzle Consistency:</strong> ${show(feedback.puzzleConsistency)}</div>
            <div><strong style="color:#24172d;">Overall Status:</strong> ${show(task.mentorStatus || task.taskStatus, 'Completed')}</div>
          </div>
        </div>

        <div style="margin-top:18px;">
          <div style="font-size:13px;letter-spacing:1.8px;text-transform:uppercase;color:#5a1372;font-weight:800;margin-bottom:10px;">Lichess Performance Snapshot</div>
          <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;">
            ${metric('Rating', feedback.studentRating)}
            ${metric('Games Played', feedback.gamesPlayed)}
            ${metric('Wins', feedback.wins)}
            ${metric('Draws', feedback.draws)}
            ${metric('Losses', feedback.losses)}
            ${metric('Rating Change', feedback.ratingChange)}
            ${metric('Puzzle Activity', feedback.puzzleActivity)}
            ${metric('Best Result', feedback.bestResult)}
          </div>
        </div>

        <div style="margin-top:18px;padding:18px;border-radius:18px;background:#ffffff;border:1px solid #eadff0;">
          <div style="font-size:13px;letter-spacing:1.8px;text-transform:uppercase;color:#5a1372;font-weight:800;margin-bottom:14px;">Coach Evaluation</div>
          <div style="margin-bottom:16px;">
            <div style="font-weight:800;color:#24172d;margin-bottom:6px;">Strengths</div>
            <div style="color:#3d3147;">${show(feedback.strengths)}</div>
          </div>
          <div style="margin-bottom:16px;">
            <div style="font-weight:800;color:#24172d;margin-bottom:6px;">Improvement Areas</div>
            <div style="color:#3d3147;">${show(feedback.improvementAreas)}</div>
          </div>
          <div style="margin-bottom:16px;">
            <div style="font-weight:800;color:#24172d;margin-bottom:6px;">Focus Next Month</div>
            <div style="color:#3d3147;">${show(feedback.focusNextMonth)}</div>
          </div>
          <div>
            <div style="font-weight:800;color:#24172d;margin-bottom:6px;">Overall Comment</div>
            <div style="color:#3d3147;">${show(feedback.overallComment)}</div>
          </div>
        </div>

        <div style="margin-top:18px;padding:16px 18px;border-radius:16px;background:rgba(253,231,90,.18);border:1px solid rgba(240,202,97,.42);color:#4f3f12;">
          This report is shared after mentor review and is intended to help families understand the student’s growth areas, effort, and next steps for the coming month.
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
