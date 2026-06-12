const { normalizeEmail, normalizeRole, verifyOtpAndCreateSession } = require('../../lib/auth');
const { allowCors, fail, ok, readJsonBody } = require('../../lib/http');
const { getDb } = require('../../lib/mongo');

module.exports = async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed.');
  try {
    const body = await readJsonBody(req);
    const email = normalizeEmail(body.email);
    const role = normalizeRole(body.role);
    const code = String(body.code || '').trim();
    if (!email || !code) return fail(res, 400, 'Email and OTP code are required.');
    const db = await getDb();
    const session = await verifyOtpAndCreateSession(db, { email, role, code });
    return ok(res, {
      sessionToken: session.sessionToken,
      email: session.email,
      role: session.role,
      name: session.name || '',
      expiresAt: session.expiresAt
    });
  } catch (error) {
    return fail(res, 401, error.message || 'OTP verification failed.');
  }
};
