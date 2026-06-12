const crypto = require('crypto');
const { buildFeedbackTask, monthKey, monthLabel } = require('../models/FeedbackTask');

function makeTaskId(studentId, coachEmail, month) {
  const base = `${studentId}|${coachEmail}|${monthKey(month)}`;
  const short = crypto.createHash('md5').update(base).digest('hex').slice(0, 8).toUpperCase();
  return `TASK-${short}`;
}

function buildTaskFromStudent(student, month) {
  const key = monthKey(month);
  return buildFeedbackTask({
    taskId: makeTaskId(student.studentId, student.coachEmail, key),
    month: monthLabel(key),
    monthKey: key,
    coachId: student.coachId,
    coachName: student.coachName,
    coachEmail: student.coachEmail,
    mentorEmail: student.mentorEmail,
    studentId: student.studentId,
    studentName: student.name || student.studentName,
    studentEmail: student.email || student.studentEmail,
    parentEmail: student.parentEmail,
    lichessId: student.lichessId,
    batchCode: student.batchCode,
    taskStatus: 'Pending',
    submissionStatus: 'Pending',
    mentorStatus: 'Pending',
    feedback: {}
  });
}

async function generateMonthlyTasks(db, month, options = {}) {
  const coachEmail = String(options.coachEmail || '').trim().toLowerCase();
  const query = {
    isActive: true,
    status: 'active',
    coachEmail: { $ne: '' }
  };
  if (coachEmail) query.coachEmail = coachEmail;

  const students = await db.collection('students').find(query).toArray();

  const tasks = students.map((student) => buildTaskFromStudent(student, month));
  let created = 0;
  let skipped = 0;

  for (const task of tasks) {
    const existing = await db.collection('feedbackTasks').findOne({
      monthKey: task.monthKey,
      studentId: task.studentId,
      coachEmail: task.coachEmail
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    await db.collection('feedbackTasks').insertOne(task);
    created += 1;
  }

  return {
    month: monthLabel(month),
    monthKey: monthKey(month),
    coachEmail,
    created,
    skipped,
    totalActiveStudents: students.length
  };
}

module.exports = {
  buildTaskFromStudent,
  generateMonthlyTasks,
  makeTaskId
};
