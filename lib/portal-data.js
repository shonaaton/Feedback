const { ObjectId } = require('mongodb');
const { normalizeEmail } = require('./auth');

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

function longMonthLabel(value) {
  const key = monthKey(value);
  if (!key) return '';
  const d = new Date(`${key}-01T00:00:00Z`);
  if (!Number.isNaN(d.getTime())) return d.toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return String(value || '');
}

function normalizeTask(task) {
  return {
    taskId: String(task.taskId || task._id || ''),
    month: task.month || monthLabel(task.monthKey),
    monthKey: task.monthKey || monthKey(task.month),
    coachId: task.coachId || '',
    coachName: task.coachName || '',
    coachEmail: normalizeEmail(task.coachEmail),
    mentorEmail: normalizeEmail(task.mentorEmail),
    studentId: task.studentId || '',
    studentName: task.studentName || '',
    studentEmail: normalizeEmail(task.studentEmail),
    parentEmail: normalizeEmail(task.parentEmail),
    lichessId: task.lichessId || '',
    batchCode: task.batchCode || '',
    taskStatus: task.taskStatus || 'Pending',
    submissionStatus: task.submissionStatus || 'Pending',
    mentorStatus: task.mentorStatus || 'Pending',
    assignedOn: task.assignedOn || '',
    submittedOn: task.submittedOn || '',
    reviewedOn: task.reviewedOn || '',
    returnedOn: task.returnedOn || '',
    lastUpdated: task.lastUpdated || '',
    feedback: task.feedback || {},
    legacy: false
  };
}

function normalizeLegacyTask(task) {
  const id = String(task.submissionId || task.taskId || task._id || '').trim();
  const feedback = task.feedback && typeof task.feedback === 'object' ? task.feedback : {
    studentRating: task.studentRating,
    gamesPlayed: task.gamesPlayed,
    wins: task.wins,
    draws: task.draws,
    losses: task.losses,
    ratingChange: task.ratingChange,
    puzzleActivity: task.puzzleActivity,
    bestResult: task.bestResult,
    puzzleConsistency: task.puzzleConsistency,
    skillLevel: task.skillLevel,
    classPerformance: task.classPerformance,
    strengths: task.strengths || task.coachComment,
    improvementAreas: task.improvementAreas,
    focusNextMonth: task.focusNextMonth,
    overallComment: task.overallComment || task.coachComment,
    mentorRemark: task.mentorRemark,
    mentorNotes: task.mentorNotes || task.coachPrivateNotes
  };
  return {
    taskId: `LEGACY:${id}`,
    month: task.month || monthLabel(task.monthKey),
    monthKey: task.monthKey || monthKey(task.month),
    coachId: task.coachId || '',
    coachName: task.coachName || '',
    coachEmail: normalizeEmail(task.coachEmail),
    mentorEmail: normalizeEmail(task.mentorEmail),
    studentId: task.studentId || '',
    studentName: task.studentName || '',
    studentEmail: normalizeEmail(task.studentEmail),
    parentEmail: normalizeEmail(task.parentEmail),
    lichessId: task.lichessId || '',
    batchCode: task.batchCode || '',
    taskStatus: task.taskStatus || task.mentorStatus || 'Approved',
    submissionStatus: task.submissionStatus || 'Submitted',
    mentorStatus: task.mentorStatus || 'Approved',
    assignedOn: task.assignedOn || '',
    submittedOn: task.submittedOn || '',
    reviewedOn: task.reviewedOn || '',
    returnedOn: task.returnedOn || '',
    lastUpdated: task.lastUpdated || '',
    feedback,
    legacy: true
  };
}

function isReturned(task) {
  return String(task.mentorStatus || '').toLowerCase() === 'returned' || String(task.taskStatus || '').toLowerCase() === 'returned';
}

function isApproved(task) {
  return String(task.mentorStatus || '').toLowerCase() === 'approved' || String(task.taskStatus || '').toLowerCase() === 'approved';
}

function isSubmitted(task) {
  return String(task.submissionStatus || '').toLowerCase() === 'submitted' || isApproved(task);
}

function isOpenCoachTask(task) {
  return !isSubmitted(task) || isReturned(task);
}

function isCoachPending(task) {
  return !isSubmitted(task) && !isReturned(task);
}

function coachSummary(tasks) {
  return {
    active: tasks.filter(isOpenCoachTask).length,
    submitted: tasks.filter((task) => String(task.submissionStatus || '').toLowerCase() === 'submitted').length,
    pending: tasks.filter(isCoachPending).length,
    returned: tasks.filter(isReturned).length,
    approved: tasks.filter(isApproved).length,
    overdue: tasks.filter((task) => !!task.isOverdue).length
  };
}

function mentorSummary(tasks) {
  return {
    active: tasks.filter((task) => !isApproved(task)).length,
    submitted: tasks.filter((task) => String(task.submissionStatus || '').toLowerCase() === 'submitted').length,
    pending: tasks.filter((task) => {
      const mentorStatus = String(task.mentorStatus || 'pending').toLowerCase();
      return mentorStatus === 'pending';
    }).length,
    returned: tasks.filter(isReturned).length,
    approved: tasks.filter(isApproved).length,
    overdue: tasks.filter((task) => !!task.isOverdue).length
  };
}

async function getAvailableMonths(db) {
  const taskMonthKeys = await db.collection('feedbackTasks').distinct('monthKey');
  const historyMonthKeys = await db.collection('feedbackHistory').distinct('monthKey');
  const historyMonthLabels = await db.collection('feedbackHistory').distinct('month');
  const months = [
    ...taskMonthKeys,
    ...historyMonthKeys,
    ...historyMonthLabels.map(monthKey)
  ];
  const sorted = [...new Set(months.filter(Boolean))].sort();
  const labels = sorted.length ? sorted.map(monthLabel) : [monthLabel(new Date())];
  return { months: labels, defaultMonth: labels[labels.length - 1] };
}

function monthQuery(month) {
  const key = monthKey(month);
  if (!key) return {};
  const short = monthLabel(key);
  const long = longMonthLabel(key);
  const raw = String(month || '').trim();
  return {
    $or: [
      { monthKey: key },
      { month: short },
      { month: long },
      ...(raw ? [{ month: raw }] : [])
    ]
  };
}

async function getTasksByMonth(db, month) {
  const docs = await db.collection('feedbackTasks').find(monthQuery(month)).sort({ studentName: 1 }).toArray();
  return docs.map(normalizeTask);
}

async function getLegacyTasksByMonth(db, month) {
  const docs = await db.collection('feedbackHistory').find(monthQuery(month)).sort({ studentName: 1 }).toArray();
  return docs.map(normalizeLegacyTask);
}

async function getCoachDashboard(db, { month, coachEmail }) {
  const tasks = [
    ...(await getTasksByMonth(db, month)),
    ...(await getLegacyTasksByMonth(db, month))
  ].filter((task) => task.coachEmail === normalizeEmail(coachEmail));
  return {
    coachEmail: normalizeEmail(coachEmail),
    month: monthLabel(month),
    summary: coachSummary(tasks),
    tasks: tasks.filter(isOpenCoachTask),
    submittedTasks: tasks.filter((task) => !isOpenCoachTask(task))
  };
}

async function getMentorDashboard(db, { month, mentorEmail, isAdmin = false }) {
  const tasks = (await getTasksByMonth(db, month)).filter((task) => {
    if (isAdmin) return true;
    return !task.mentorEmail || task.mentorEmail === normalizeEmail(mentorEmail);
  });
  return {
    mentorName: isAdmin ? 'Admin' : mentorEmail,
    month: monthLabel(month),
    summary: mentorSummary(tasks),
    tasks: tasks.filter((task) => !isApproved(task)),
    completedTasks: tasks.filter(isApproved)
  };
}

async function getApprovedDashboard(db, { month, mentorEmail, isAdmin = false }) {
  const data = await getMentorDashboard(db, { month, mentorEmail, isAdmin });
  const legacyTasks = (await getLegacyTasksByMonth(db, month)).filter((task) => {
    if (isAdmin) return true;
    return !task.mentorEmail || task.mentorEmail === normalizeEmail(mentorEmail);
  });
  const tasks = [...data.completedTasks, ...legacyTasks];
  return { month: data.month, summary: mentorSummary(tasks), tasks };
}

async function getTaskById(db, taskId) {
  const id = String(taskId || '').trim();
  if (!id) return null;
  if (id.startsWith('LEGACY:')) {
    const legacyId = id.slice(7);
    const task = await db.collection('feedbackHistory').findOne({
      $or: [{ submissionId: legacyId }, { taskId: legacyId }, ...(ObjectId.isValid(legacyId) ? [{ _id: new ObjectId(legacyId) }] : [])]
    });
    return task ? normalizeLegacyTask(task) : null;
  }
  const task = await db.collection('feedbackTasks').findOne({
    $or: [{ taskId: id }, ...(ObjectId.isValid(id) ? [{ _id: new ObjectId(id) }] : [])]
  });
  return task ? normalizeTask(task) : null;
}

async function getTaskHistory(db, task) {
  const studentId = String(task.studentId || '').trim();
  const lichessId = String(task.lichessId || '').trim().toLowerCase();
  const portalRecords = task.legacy ? [] : await db.collection('feedbackSubmissions').find({
    $or: [{ taskId: task.taskId }, ...(studentId ? [{ studentId }] : []), ...(lichessId ? [{ lichessId }] : [])]
  }).sort({ createdAt: -1 }).toArray();
  const legacyRows = await db.collection('feedbackHistory').find({
    $or: [...(studentId ? [{ studentId }] : []), ...(lichessId ? [{ lichessId }] : [])]
  }).toArray();
  legacyRows.sort((a, b) => {
    const left = monthKey(a.monthKey || a.month || '');
    const right = monthKey(b.monthKey || b.month || '');
    return right.localeCompare(left);
  });
  return { legacyRows, portalRecords };
}

function extractFeedback(payload) {
  return { ...(payload.feedback || {}) };
}

async function submitFeedback(db, task, payload, actor) {
  const now = new Date().toISOString();
  const feedback = extractFeedback(payload);
  const submissionStatus = payload.mode === 'draft' ? 'Draft' : 'Submitted';
  await db.collection('feedbackSubmissions').updateOne(
    { taskId: task.taskId },
    {
      $set: {
        studentId: task.studentId,
        studentName: task.studentName,
        coachEmail: task.coachEmail,
        mentorEmail: task.mentorEmail,
        month: task.month,
        monthKey: task.monthKey,
        lichessId: task.lichessId,
        feedback,
        submissionStatus,
        mentorStatus: 'Pending',
        createdBy: actor.email,
        updatedAt: new Date()
      },
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true }
  );
  await db.collection('feedbackTasks').updateOne(
    { taskId: task.taskId },
    {
      $set: {
        feedback,
        taskStatus: submissionStatus,
        submissionStatus,
        mentorStatus: 'Pending',
        submittedOn: submissionStatus === 'Submitted' ? now : task.submittedOn || '',
        lastUpdated: now
      }
    }
  );
  return getTaskById(db, task.taskId);
}

async function saveMentorReview(db, task, payload, actor) {
  const now = new Date().toISOString();
  const feedback = extractFeedback(payload);
  await db.collection('feedbackSubmissions').updateOne(
    { taskId: task.taskId },
    {
      $set: {
        studentId: task.studentId,
        studentName: task.studentName,
        coachEmail: task.coachEmail,
        mentorEmail: task.mentorEmail,
        month: task.month,
        monthKey: task.monthKey,
        lichessId: task.lichessId,
        feedback,
        submissionStatus: task.submissionStatus || 'Submitted',
        mentorStatus: task.mentorStatus || 'Pending',
        createdBy: actor.email,
        updatedAt: new Date()
      },
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true }
  );
  await db.collection('feedbackTasks').updateOne(
    { taskId: task.taskId },
    {
      $set: {
        feedback,
        lastUpdated: now
      }
    }
  );
  return getTaskById(db, task.taskId);
}

async function mentorUpdate(db, task, payload, actor) {
  const now = new Date().toISOString();
  const feedback = extractFeedback(payload);
  const mentorStatus = payload.mentorStatus === 'Returned' ? 'Returned' : 'Approved';
  await db.collection('feedbackSubmissions').updateOne(
    { taskId: task.taskId },
    {
      $set: {
        studentId: task.studentId,
        studentName: task.studentName,
        coachEmail: task.coachEmail,
        mentorEmail: task.mentorEmail,
        month: task.month,
        monthKey: task.monthKey,
        lichessId: task.lichessId,
        feedback,
        submissionStatus: task.submissionStatus || 'Submitted',
        mentorStatus,
        createdBy: actor.email,
        updatedAt: new Date()
      },
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true }
  );
  await db.collection('feedbackTasks').updateOne(
    { taskId: task.taskId },
    {
      $set: {
        feedback,
        taskStatus: mentorStatus,
        mentorStatus,
        reviewedOn: mentorStatus === 'Approved' ? now : '',
        returnedOn: mentorStatus === 'Returned' ? now : '',
        lastUpdated: now
      }
    }
  );
  return getTaskById(db, task.taskId);
}

async function queueNotification(db, type, payload) {
  await db.collection('notificationJobs').insertOne({
    type,
    status: 'queued',
    payload,
    createdAt: new Date()
  });
}

module.exports = {
  getApprovedDashboard,
  getAvailableMonths,
  getCoachDashboard,
  getMentorDashboard,
  saveMentorReview,
  getTaskById,
  getTaskHistory,
  mentorUpdate,
  queueNotification,
  submitFeedback
};
