const VALID_ROLES = ['coach', 'mentor', 'admin'];
const VALID_STATUSES = ['active', 'inactive'];

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeRole(role) {
  const value = String(role || '').trim().toLowerCase();
  return VALID_ROLES.includes(value) ? value : 'coach';
}

function normalizeStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  return VALID_STATUSES.includes(value) ? value : 'active';
}

function buildUser(input = {}) {
  const now = new Date();
  return {
    email: normalizeEmail(input.email),
    role: normalizeRole(input.role),
    name: String(input.name || '').trim(),
    status: normalizeStatus(input.status),
    phone: String(input.phone || '').trim(),
    studentId: String(input.studentId || '').trim(),
    coachId: String(input.coachId || '').trim(),
    mentorEmail: normalizeEmail(input.mentorEmail),
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  };
}

function validateUser(input = {}) {
  const errors = [];
  const user = buildUser(input);

  if (!user.email) errors.push('email is required');
  if (!user.name) errors.push('name is required');
  if (!VALID_ROLES.includes(user.role)) errors.push(`role must be one of: ${VALID_ROLES.join(', ')}`);
  if (!VALID_STATUSES.includes(user.status)) errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);

  return {
    ok: errors.length === 0,
    errors,
    user
  };
}

module.exports = {
  VALID_ROLES,
  VALID_STATUSES,
  buildUser,
  normalizeEmail,
  normalizeRole,
  normalizeStatus,
  validateUser
};
