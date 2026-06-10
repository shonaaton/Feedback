const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;

function sendJson(res, status, payload) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.status(status).send(JSON.stringify(payload));
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function parseBody(raw, contentType) {
  if (!raw) return {};
  if ((contentType || '').includes('application/json')) {
    try { return JSON.parse(raw); } catch (error) { return {}; }
  }
  const params = new URLSearchParams(raw);
  const out = {};
  for (const [key, value] of params.entries()) out[key] = value;
  return out;
}

async function forwardGet(req, res) {
  const target = new URL(APPS_SCRIPT_URL);
  Object.keys(req.query || {}).forEach(key => {
    const value = req.query[key];
    if (Array.isArray(value)) value.forEach(v => target.searchParams.append(key, v));
    else if (value !== undefined && value !== null) target.searchParams.set(key, value);
  });

  const response = await fetch(target.toString(), { method: 'GET', redirect: 'follow' });
  const text = await response.text();
  res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(response.status).send(text);
}

async function forwardPost(req, res) {
  const raw = await collectBody(req);
  const body = parseBody(raw, req.headers['content-type']);
  const params = new URLSearchParams();
  Object.keys(body || {}).forEach(key => {
    const value = body[key];
    if (value === undefined || value === null) return;
    if (typeof value === 'object') params.set(key, JSON.stringify(value));
    else params.set(key, String(value));
  });

  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: params,
    redirect: 'follow'
  });
  const text = await response.text();
  res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(response.status).send(text);
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, { ok: true });
  if (!APPS_SCRIPT_URL) {
    return sendJson(res, 500, {
      ok: false,
      message: 'APPS_SCRIPT_URL is missing in Vercel Environment Variables.'
    });
  }

  try {
    if (req.method === 'GET') return await forwardGet(req, res);
    if (req.method === 'POST') return await forwardPost(req, res);
    return sendJson(res, 405, { ok: false, message: 'Method not allowed.' });
  } catch (error) {
    return sendJson(res, 500, { ok: false, message: error.message || 'Proxy failed.' });
  }
};
