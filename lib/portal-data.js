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
    feedback: task.feedback || {}
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

function summary(tasks) {
  return {
    active: tasks.filter(isOpenCoachTask).length,
    submitted: tasks.filter((task) => String(task.submissionStatus || '').toLowerCase() === 'submitted').length,
    pending: tasks.filter((task) => String(task.mentorStatus || 'pending').toLowerCase() === 'pending').length,
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

async function getTasksByMonth(db, month) {
  const key = monthKey(month);
  const docs = await db.collection('feedbackTasks').find(key ? { monthKey: key } : {}).sort({ studentName: 1 }).toArray();
  return docs.map(normalizeTask);
}

async function getCoachDashboard(db, { month, coachEmail }) {
  const tasks = (await getTasksByMonth(db, month)).filter((task) => task.coachEmail === normalizeEmail(coachEmail));
  return {
    coachEmail: normalizeEmail(coachEmail),
    month: monthLabel(month),
    summary: summary(tasks),
    tasks: tasks.filter(isOpenCoachTask),
    submittedTasks: tasks.filter((task) => !isOpenCoachTask(task))
  };
}

async function getMentorDashboard(db, { month, mentorEmail }) {
  const tasks = (await getTasksByMonth(db, month)).filter((task) => !task.mentorEmail || task.mentorEmail === normalizeEmail(mentorEmail));
  return {
    mentorName: mentorEmail,
    month: monthLabel(month),
    summary: summary(tasks),
    tasks: tasks.filter((task) => !isApproved(task)),
    completedTasks: tasks.filter(isApproved)
  };
}

async function getApprovedDashboard(db, { month, mentorEmail }) {
  const data = await getMentorDashboard(db, { month, mentorEmail });
  return { month: data.month, summary: summary(data.completedTasks), tasks: data.completedTasks };
}

async function getTaskById(db, taskId) {
  const id = String(taskId || '').trim();
  if (!id) return null;
  const task = await db.collection('feedbackTasks').findOne({
    $or: [{ taskId: id }, ...(ObjectId.isValid(id) ? [{ _id: new ObjectId(id) }] : [])]
  });
  return task ? normalizeTask(task) : null;
}

async function getTaskHistory(db, task) {
  const studentId = String(task.studentId || '').trim();
  const lichessId = String(task.lichessId || '').trim().toLowerCase();
  const portalRecords = await db.collection('feedbackSubmissions').find({
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
  await db.collection('feedbackSubmissions').insertOne({
    taskId: task.taskId,
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
    createdAt: new Date()
  });
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

async function mentorUpdate(db, task, payload, actor) {
  const now = new Date().toISOString();
  const feedback = extractFeedback(payload);
  const mentorStatus = payload.mentorStatus === 'Returned' ? 'Returned' : 'Approved';
  await db.collection('feedbackSubmissions').insertOne({
    taskId: task.taskId,
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
    createdAt: new Date()
  });
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
  getTaskById,
  getTaskHistory,
  mentorUpdate,
  queueNotification,
  submitFeedback
};
