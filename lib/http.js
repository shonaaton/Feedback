function sendJson(res, status, payload) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.status(status).send(JSON.stringify(payload));
}

function ok(res, data, status = 200) {
  return sendJson(res, status, { ok: true, data });
}

function fail(res, status, message, extra = {}) {
  return sendJson(res, status, { ok: false, message, ...extra });
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error('Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
}

function allowCors(req, res) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return true;
  }
  return false;
}

module.exports = {
  allowCors,
  fail,
  ok,
  readJsonBody,
  sendJson
};
