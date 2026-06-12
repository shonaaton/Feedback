const { requireSession } = require('../lib/auth');
const { allowCors, fail, ok, readJsonBody } = require('../lib/http');
const { getDb } = require('../lib/mongo');
const { getTaskById, queueNotification } = require('../lib/portal-data');
const N8N_BASE_URL = process.env.N8N_BASE_URL;

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Lichess request failed (${response.status}).`);
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { Accept: 'application/x-ndjson,application/json,text/plain' } });
  if (!response.ok) throw new Error(`Lichess request failed (${response.status}).`);
  return response.text();
}

async function fetchViaN8n(payload) {
  if (!N8N_BASE_URL) return null;
  const url = `${String(N8N_BASE_URL).replace(/\/+$/g, '')}/eca-feedback-lichess-v2`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  if (!text.trim()) {
    throw new Error('The n8n Lichess workflow returned an empty response.');
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`The n8n Lichess workflow returned invalid JSON: ${text.slice(0, 200)}`);
  }
  if (!response.ok || parsed.ok === false) {
    throw new Error(parsed.message || `n8n Lichess workflow failed (${response.status}).`);
  }
  return parsed.data || parsed;
}

async function safeFetchGames(lichessId, since) {
  try {
    const gamesText = await fetchText(
      `https://lichess.org/api/games/user/${encodeURIComponent(lichessId)}?since=${since}&max=300&perfType=rapid,blitz,classical,bullet&finished=true&rated=true`
    );
    return parseNdjson(gamesText);
  } catch (error) {
    return [];
  }
}

function parseNdjson(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function getPlayerEntry(game, lichessId) {
  const id = String(lichessId || '').trim().toLowerCase();
  const white = game?.players?.white?.user?.name ? String(game.players.white.user.name).trim().toLowerCase() : '';
  const black = game?.players?.black?.user?.name ? String(game.players.black.user.name).trim().toLowerCase() : '';
  if (white === id) return { color: 'white', self: game.players.white, opp: game.players.black };
  if (black === id) return { color: 'black', self: game.players.black, opp: game.players.white };
  return null;
}

function buildMonthlySnapshot(games, lichessId, currentRating, puzzleGames) {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let ratingChange = 0;
  let bestWin = null;

  for (const game of games) {
    const player = getPlayerEntry(game, lichessId);
    if (!player) continue;
    const selfRatingDiff = Number(player.self?.ratingDiff || 0);
    ratingChange += selfRatingDiff;
    const selfRating = Number(player.self?.rating || 0);
    const oppRating = Number(player.opp?.rating || 0);
    const winner = String(game.winner || '').toLowerCase();
    const isDraw = !winner;
    const won = winner === player.color;
    const lost = !!winner && winner !== player.color;

    if (won) {
      wins += 1;
      if (!bestWin || oppRating > bestWin.oppRating) {
        bestWin = { oppRating, selfRating };
      }
    } else if (lost) {
      losses += 1;
    } else if (isDraw) {
      draws += 1;
    }
  }

  return {
    message: 'Lichess snapshot fetched for the last 30 days.',
    studentRating: currentRating || '',
    gamesPlayed: wins + draws + losses,
    wins,
    draws,
    losses,
    ratingChange: ratingChange ? String(ratingChange > 0 ? `+${ratingChange}` : ratingChange) : '0',
    puzzleActivity: puzzleGames || 'No puzzle activity recorded this month.',
    bestResult: bestWin && bestWin.oppRating ? `Win vs ${bestWin.oppRating}` : 'No rated game activity this month.'
  };
}

function normalizeSnapshotData(raw = {}) {
  const gamesPlayed = String(raw.gamesPlayed ?? '').trim();
  const wins = String(raw.wins ?? '').trim();
  const draws = String(raw.draws ?? '').trim();
  const losses = String(raw.losses ?? '').trim();
  const noGames = !Number(gamesPlayed || 0) && !Number(wins || 0) && !Number(draws || 0) && !Number(losses || 0);

  return {
    message: raw.message || (noGames
      ? 'No Lichess activity was found for the selected month. This has been marked clearly in the feedback.'
      : 'Lichess snapshot fetched successfully.'),
    studentRating: String(raw.studentRating ?? '').trim() || 'No active rating this month',
    gamesPlayed: gamesPlayed || '0',
    wins: wins || '0',
    draws: draws || '0',
    losses: losses || '0',
    ratingChange: String(raw.ratingChange ?? '').trim() || (noGames ? 'No activity' : '0'),
    puzzleActivity: String(raw.puzzleActivity ?? '').trim() || 'No activity received this month.',
    bestResult: String(raw.bestResult ?? '').trim() || 'No activity received this month.'
  };
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

    let games = [];
    let user = null;
    let data = null;

    try {
      data = await fetchViaN8n({
        taskId: task.taskId,
        month: task.month,
        monthKey: task.monthKey,
        studentId: task.studentId,
        studentName: task.studentName,
        lichessId
      });
      data = normalizeSnapshotData(data);
    } catch (n8nError) {
      user = await fetchJson(`https://lichess.org/api/user/${encodeURIComponent(lichessId)}`);
      const since = Date.now() - (30 * 24 * 60 * 60 * 1000);
      games = await safeFetchGames(lichessId, since);
      const currentRating = user?.perfs?.rapid?.rating || user?.perfs?.blitz?.rating || user?.perfs?.classical?.rating || '';
      data = normalizeSnapshotData(buildMonthlySnapshot(games, lichessId, currentRating, user?.perfs?.puzzle?.games || ''));
      if (!games.length) {
        data.message = 'No Lichess activity was found for the selected month. The feedback has been marked as no activity.';
      }
    }

    await db.collection('lichessSnapshots').updateOne(
      { studentId: task.studentId, monthKey: task.monthKey },
      {
        $set: {
          taskId: task.taskId,
          studentId: task.studentId,
          lichessId,
          month: task.month,
          monthKey: task.monthKey,
          ...data,
          games,
          raw: user,
          updatedAt: new Date()
        },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );
    await queueNotification(db, 'lichess-snapshot-created', { taskId: task.taskId, lichessId });
    return ok(res, data);
  } catch (error) {
    return fail(res, 500, error.message || 'Could not fetch Lichess data.');
  }
};
