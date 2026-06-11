const { createOtp, findUserByEmail, normalizeEmail, normalizeRole } = require('../../lib/auth');
const { optionalEnv } = require('../../lib/env');
const { allowCors, fail, ok, readJsonBody } = require('../../lib/http');
const { getDb } = require('../../lib/mongo');

module.exports = async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed.');
  try {
    const body = await readJsonBody(req);
    const email = normalizeEmail(body.email);
    const role = normalizeRole(body.role);
    if (!email) return fail(res, 400, 'Email is required.');

    const db = await getDb();
    const user = await findUserByEmail(db, email);
    if (!user) return fail(res, 404, 'This email is not registered in the portal.');

    const otp = await createOtp(db, { email, role: user.role || role });
    const webhook = optionalEnv('N8N_OTP_WEBHOOK_URL');
    if (webhook) {
      const response = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: user.role || role, name: user.name || '', code: otp.code })
      });
      if (!response.ok) {
        const raw = await response.text().catch(() => '');
        throw new Error(`OTP email workflow failed (${response.status}). ${raw || 'Check the n8n webhook.'}`.trim());
      }
    }

    return ok(res, {
      sent: true,
      role: user.role || role,
      devCode: optionalEnv('NODE_ENV') === 'development' ? otp.code : undefined
    });
  } catch (error) {
    return fail(res, 500, error.message || 'Could not request OTP.');
  }
};
