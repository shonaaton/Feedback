function monthKey(value) {
  if (!value) return '';
  const raw = String(value).trim();
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const iso = raw.match(/^(\d{4})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  return raw;
}

function monthLabel(value) {
  const key = monthKey(value);
  const d = new Date(`${key}-01T00:00:00Z`);
  if (!Number.isNaN(d.getTime())) return d.toLocaleString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  return String(value || '');
}

function buildFeedbackTask(input = {}) {
  const now = new Date().toISOString();
  return {
    taskId: String(input.taskId || '').trim(),
    month: input.month || monthLabel(input.monthKey),
    monthKey: input.monthKey || monthKey(input.month),
    coachId: String(input.coachId || '').trim(),
    coachName: String(input.coachName || '').trim(),
    coachEmail: String(input.coachEmail || '').trim().toLowerCase(),
    mentorEmail: String(input.mentorEmail || '').trim().toLowerCase(),
    studentId: String(input.studentId || '').trim(),
    studentName: String(input.studentName || '').trim(),
    studentEmail: String(input.studentEmail || '').trim().toLowerCase(),
    parentEmail: String(input.parentEmail || '').trim().toLowerCase(),
    lichessId: String(input.lichessId || '').trim(),
    batchCode: String(input.batchCode || '').trim(),
    taskStatus: input.taskStatus || 'Pending',
    submissionStatus: input.submissionStatus || 'Pending',
    mentorStatus: input.mentorStatus || 'Pending',
    assignedOn: input.assignedOn || now,
    submittedOn: input.submittedOn || '',
    reviewedOn: input.reviewedOn || '',
    returnedOn: input.returnedOn || '',
    lastUpdated: input.lastUpdated || now,
    feedback: input.feedback || {}
  };
}

function validateFeedbackTask(input = {}) {
  const task = buildFeedbackTask(input);
  const errors = [];
  if (!task.taskId) errors.push('taskId is required');
  if (!task.monthKey) errors.push('monthKey is required');
  if (!task.coachEmail) errors.push('coachEmail is required');
  if (!task.studentId) errors.push('studentId is required');
  if (!task.studentName) errors.push('studentName is required');
  return { ok: errors.length === 0, errors, task };
}

module.exports = {
  buildFeedbackTask,
  monthKey,
  monthLabel,
  validateFeedbackTask
};
