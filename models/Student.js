const ACTIVE_STATUSES = ['active', 'inactive', 'paused', 'trial'];

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  return ACTIVE_STATUSES.includes(value) ? value : 'active';
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value == null || value === '') return fallback;
  const raw = String(value).trim().toLowerCase();
  return ['true', '1', 'yes', 'y', 'active'].includes(raw);
}

function buildStudent(input = {}) {
  const now = new Date();
  const status = normalizeStatus(input.status || input.Status);
  return {
    studentId: String(input.studentId || input.Student_ID || '').trim(),
    name: String(input.name || input.studentName || input.Student_Name || '').trim(),
    email: normalizeEmail(input.email || input.studentEmail || input.Student_Email),
    parentEmail: normalizeEmail(input.parentEmail),
    lichessId: String(input.lichessId || input.Lichess_ID || '').trim(),
    batchCode: String(input.batchCode || input['Batch Code'] || input.Batch_Code || '').trim(),
    coachId: String(input.coachId || input.Assigned_Coach_ID || '').trim(),
    coachName: String(input.coachName || input.Select_Coach || '').trim(),
    coachEmail: normalizeEmail(input.coachEmail),
    mentorEmail: normalizeEmail(input.mentorEmail),
    anonymousAddress: normalizeEmail(input.anonymousAddress || input.Anonymous_Address),
    status,
    isActive: normalizeBoolean(input.isActive, status === 'active'),
    joinedAt: input.joinedAt || null,
    leftAt: input.leftAt || null,
    source: String(input.source || 'n8n-sync').trim(),
    sourceRow: {
      selectCoach: String(input.Select_Coach || '').trim(),
      assignedCoachId: String(input.Assigned_Coach_ID || '').trim(),
      status: String(input.Status || input.status || '').trim(),
      anonymousAddress: normalizeEmail(input.Anonymous_Address)
    },
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  };
}

function validateStudent(input = {}) {
  const student = buildStudent(input);
  const errors = [];
  if (!student.studentId) errors.push('studentId is required');
  if (!student.name) errors.push('name is required');
  return { ok: errors.length === 0, errors, student };
}

function validateTaskReadyStudent(input = {}) {
  const student = buildStudent(input);
  const errors = [];
  if (!student.studentId) errors.push('studentId is required');
  if (!student.name) errors.push('name is required');
  if (!student.coachId) errors.push('coachId is required');
  if (!student.coachName) errors.push('coachName is required');
  if (!student.coachEmail) errors.push('coachEmail is required');
  if (!student.mentorEmail) errors.push('mentorEmail is required');
  return { ok: errors.length === 0, errors, student };
}

module.exports = {
  ACTIVE_STATUSES,
  buildStudent,
  normalizeStatus,
  validateStudent,
  validateTaskReadyStudent
};
