const { requireSession } = require('../lib/auth');
const { allowCors, fail, ok, readJsonBody } = require('../lib/http');
const { getDb } = require('../lib/mongo');
const { getTaskById, queueNotification } = require('../lib/portal-data');

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
    puzzleActivity: puzzleGames || '',
    bestResult: bestWin && bestWin.oppRating ? `Win vs ${bestWin.oppRating}` : ''
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

    const user = await fetchJson(`https://lichess.org/api/user/${encodeURIComponent(lichessId)}`);
    const since = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const gamesText = await fetchText(
      `https://lichess.org/api/games/user/${encodeURIComponent(lichessId)}?since=${since}&max=300&perfType=rapid,blitz,classical&finished=true&rated=true`
    );
    const games = parseNdjson(gamesText);
    const currentRating = user?.perfs?.rapid?.rating || user?.perfs?.blitz?.rating || user?.perfs?.classical?.rating || '';
    const data = buildMonthlySnapshot(games, lichessId, currentRating, user?.perfs?.puzzle?.games || '');

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
