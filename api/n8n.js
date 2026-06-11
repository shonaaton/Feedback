const N8N_BASE_URL = process.env.N8N_BASE_URL;

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

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, { ok: true });
  if (!N8N_BASE_URL) return sendJson(res, 400, { ok: false, message: 'N8N_BASE_URL is not configured in Vercel.' });

  const endpoint = String(req.query.endpoint || '').replace(/^\/+|\/+$/g, '');
  if (!endpoint) return sendJson(res, 400, { ok: false, message: 'Missing endpoint query, e.g. /api/n8n?endpoint=eca-feedback-launch-month' });

  const base = N8N_BASE_URL.replace(/\/+$/g, '');
  const url = new URL(`${base}/${endpoint}`);
  Object.keys(req.query || {}).forEach(key => {
    if (key !== 'endpoint') url.searchParams.set(key, req.query[key]);
  });

  try {
    const init = { method: req.method, redirect: 'follow' };
    if (req.method !== 'GET') {
      init.headers = { 'Content-Type': req.headers['content-type'] || 'application/json' };
      init.body = await collectBody(req);
    }
    const response = await fetch(url.toString(), init);
    const text = await response.text();
    if (!text.trim()) {
      return sendJson(res, response.ok ? 502 : response.status, {
        ok: false,
        message: `n8n returned an empty response for ${endpoint}. Check the Respond to Webhook node in that workflow.`
      });
    }
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json; charset=utf-8');
    res.status(response.status).send(text);
  } catch (error) {
    sendJson(res, 500, { ok: false, message: error.message || 'n8n proxy failed.' });
  }
};
