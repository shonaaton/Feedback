const { requireSession } = require('../lib/auth');
const { allowCors, fail, ok, readJsonBody } = require('../lib/http');
const { getDb } = require('../lib/mongo');
const { getTaskById, queueNotification } = require('../lib/portal-data');

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Lichess request failed (${response.status}).`);
  return response.json();
}

module.exports = async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed.');
  try {
    const body = await readJsonBody(req);
    const db = await getDb();
    const session = await requireSession(db, body.sessionToken);
    const task = await getTaskById(db, body.taskId);
    if (!task) return fail(res, 404, 'Task not found.');
    if (session.role === 'coach' && task.coachEmail !== session.email) return fail(res, 403, 'This task is not assigned to this coach.');

    const lichessId = String(body.lichessId || task.lichessId || '').trim();
    if (!lichessId) return fail(res, 400, 'Lichess ID is required.');

    const user = await fetchJson(`https://lichess.org/api/user/${encodeURIComponent(lichessId)}`);
    const data = {
      message: 'Lichess snapshot fetched.',
      studentRating: user?.perfs?.rapid?.rating || user?.perfs?.blitz?.rating || user?.perfs?.classical?.rating || '',
      gamesPlayed: user?.count?.all || 0,
      wins: user?.count?.win || 0,
      draws: user?.count?.draw || 0,
      losses: user?.count?.loss || 0,
      ratingChange: '',
      puzzleActivity: user?.perfs?.puzzle?.games || '',
      bestResult: ''
    };

    await db.collection('lichessSnapshots').insertOne({
      taskId: task.taskId,
      studentId: task.studentId,
      lichessId,
      ...data,
      raw: user,
      createdAt: new Date()
    });
    await queueNotification(db, 'lichess-snapshot-created', { taskId: task.taskId, lichessId });
    return ok(res, data);
  } catch (error) {
    return fail(res, 500, error.message || 'Could not fetch Lichess data.');
  }
};
