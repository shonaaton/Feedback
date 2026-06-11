function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeBoolean(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (value == null || value === '') return fallback;
  const raw = String(value).trim().toLowerCase();
  return ['true', '1', 'yes', 'y', 'active'].includes(raw);
}

function buildAssignment(input = {}) {
  const now = new Date();
  return {
    studentId: String(input.studentId || '').trim(),
    studentName: String(input.studentName || input.name || '').trim(),
    coachId: String(input.coachId || '').trim(),
    coachName: String(input.coachName || '').trim(),
    coachEmail: normalizeEmail(input.coachEmail),
    mentorEmail: normalizeEmail(input.mentorEmail),
    batchCode: String(input.batchCode || '').trim(),
    lichessId: String(input.lichessId || '').trim(),
    studentEmail: normalizeEmail(input.studentEmail || input.email),
    parentEmail: normalizeEmail(input.parentEmail),
    active: normalizeBoolean(input.active, true),
    source: String(input.source || 'n8n-sync').trim(),
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  };
}

function validateAssignment(input = {}) {
  const assignment = buildAssignment(input);
  const errors = [];
  if (!assignment.studentId) errors.push('studentId is required');
  if (!assignment.coachEmail) errors.push('coachEmail is required');
  if (!assignment.mentorEmail) errors.push('mentorEmail is required');
  return { ok: errors.length === 0, errors, assignment };
}

module.exports = {
  buildAssignment,
  validateAssignment
};
