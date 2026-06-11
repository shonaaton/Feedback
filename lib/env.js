function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(value).trim();
}

function optionalEnv(name, fallback = '') {
  const value = process.env[name];
  return value == null || value === '' ? fallback : String(value).trim();
}

function intEnv(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

module.exports = {
  intEnv,
  optionalEnv,
  requireEnv
};
