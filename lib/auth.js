const crypto = require('crypto');
const { intEnv, optionalEnv } = require('./env');

const OTP_TTL_MINUTES = intEnv('OTP_TTL_MINUTES', 10);
const SESSION_TTL_HOURS = intEnv('SESSION_TTL_HOURS', 12);
const OTP_BYPASS_CODE = optionalEnv('OTP_BYPASS_CODE', '');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeRole(role) {
  const value = String(role || '').trim().toLowerCase();
  return ['coach', 'mentor', 'admin'].includes(value) ? value : 'coach';
}

function createOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function createToken() {
  return crypto.randomBytes(24).toString('hex');
}

function futureDateMinutes(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function futureDateHours(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

async function findUserByEmail(db, email) {
  return db.collection('users').findOne({
    email: normalizeEmail(email),
    status: { $ne: 'inactive' }
  });
}

async function createOtp(db, { email, role }) {
  const code = createOtpCode();
  await db.collection('otpCodes').insertOne({
    email: normalizeEmail(email),
    role: normalizeRole(role),
    code,
    expiresAt: futureDateMinutes(OTP_TTL_MINUTES),
    usedAt: null,
    createdAt: new Date()
  });
  return { code };
}

async function verifyOtpAndCreateSession(db, { email, role, code }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedRole = normalizeRole(role);
  const otp = await db.collection('otpCodes').findOne(
    {
      email: normalizedEmail,
      role: normalizedRole,
      usedAt: null
    },
    { sort: { createdAt: -1 } }
  );
  if (!otp) throw new Error('No OTP request found for this email and role.');
  if (new Date(otp.expiresAt).getTime() < Date.now()) throw new Error('OTP has expired. Please request a new one.');

  const inputCode = String(code || '').trim();
  const bypass = OTP_BYPASS_CODE && inputCode === OTP_BYPASS_CODE;
  if (!bypass && inputCode !== String(otp.code || '').trim()) throw new Error('Incorrect OTP code.');

  const session = {
    sessionToken: createToken(),
    email: normalizedEmail,
    role: normalizedRole,
    expiresAt: futureDateHours(SESSION_TTL_HOURS),
    createdAt: new Date(),
    lastSeenAt: new Date()
  };
  await db.collection('otpCodes').updateOne({ _id: otp._id }, { $set: { usedAt: new Date() } });
  await db.collection('sessions').insertOne(session);
  return session;
}

async function requireSession(db, sessionToken) {
  const token = String(sessionToken || '').trim();
  if (!token) throw new Error('Missing session token. Please login again.');
  const session = await db.collection('sessions').findOne({ sessionToken: token });
  if (!session) throw new Error('Session not found. Please login again.');
  if (new Date(session.expiresAt).getTime() < Date.now()) throw new Error('Session expired. Please login again.');
  await db.collection('sessions').updateOne({ _id: session._id }, { $set: { lastSeenAt: new Date() } });
  return session;
}

module.exports = {
  createOtp,
  findUserByEmail,
  normalizeEmail,
  normalizeRole,
  requireSession,
  verifyOtpAndCreateSession
};
