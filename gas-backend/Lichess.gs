function fetchLichessSnapshotForTask(task) {
  if (!task.Lichess_ID && !task.lichessId) {
    throw new Error("No Lichess ID found for this task.");
  }

  var lichessId = task.Lichess_ID || task.lichessId;
  var monthLabel = task.Month || task.month || getCurrentMonthLabel();
  var range = previousMonthWindow(monthLabel);

  var profile = UrlFetchApp.fetch("https://lichess.org/api/user/" + encodeURIComponent(lichessId), {
    muteHttpExceptions: true,
    headers: { Accept: "application/json" }
  });
  if (profile.getResponseCode() >= 400) {
    throw new Error("Could not load Lichess profile for " + lichessId);
  }

  var profileJson = JSON.parse(profile.getContentText());
  var bestPerf = pickHighestPerf(profileJson.perfs || {});

  var games = UrlFetchApp.fetch("https://lichess.org/api/games/user/" + encodeURIComponent(lichessId) + buildGameQuery(range), {
    muteHttpExceptions: true,
    headers: { Accept: "application/x-ndjson" }
  });
  if (games.getResponseCode() >= 400) {
    throw new Error("Could not load Lichess games for " + lichessId);
  }

  var parsedGames = parseNdjson(games.getContentText());
  var summary = summarizeGames(parsedGames, lichessId);

  var puzzleActivity = "";
  if (profileJson.perfs && profileJson.perfs.puzzle && profileJson.perfs.puzzle.games !== undefined) {
    puzzleActivity = String(profileJson.perfs.puzzle.games) + " puzzles";
  }

  return {
    studentRating: bestPerf,
    gamesPlayed: String(summary.gamesPlayed),
    wins: String(summary.wins),
    draws: String(summary.draws),
    losses: String(summary.losses),
    ratingChange: String(summary.ratingChange),
    puzzleActivity: puzzleActivity,
    bestResult: summary.bestResult,
    rawProfile: profileJson,
    rawGames: parsedGames
  };
}

function previousMonthWindow(monthLabel) {
  var parsed = new Date(monthLabel);
  if (isNaN(parsed.getTime())) {
    parsed = new Date();
  }
  var year = parsed.getFullYear();
  var month = parsed.getMonth();
  var start = new Date(year, month - 1, 1, 0, 0, 0);
  var end = new Date(year, month, 0, 23, 59, 59);
  return { since: start.getTime(), until: end.getTime() };
}

function buildGameQuery(range) {
  return "?since=" + range.since +
    "&until=" + range.until +
    "&max=300&moves=false&clocks=false&evals=false&opening=true&tags=true";
}

function parseNdjson(text) {
  return String(text || "")
    .split("\n")
    .filter(function (line) { return line.trim(); })
    .map(function (line) { return JSON.parse(line); });
}

function pickHighestPerf(perfs) {
  var bestName = "";
  var bestRating = 0;
  Object.keys(perfs).forEach(function (name) {
    var perf = perfs[name];
    if (perf && perf.rating && perf.rating > bestRating && name !== "puzzle") {
      bestRating = perf.rating;
      bestName = name;
    }
  });
  return bestRating ? bestRating + " " + capitalizePerf(bestName) : "Unrated";
}

function summarizeGames(games, lichessId) {
  var summary = {
    gamesPlayed: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    ratingChange: 0,
    bestResult: "No notable result found"
  };
  var bestOpponentRating = 0;

  games.forEach(function (game) {
    summary.gamesPlayed += 1;
    var players = game.players || {};
    var white = players.white || {};
    var black = players.black || {};
    var isWhite = white.user && String(white.user.id).toLowerCase() === String(lichessId).toLowerCase();
    var mine = isWhite ? white : black;
    var opponent = isWhite ? black : white;
    if (mine.ratingDiff !== undefined && mine.ratingDiff !== null) {
      summary.ratingChange += Number(mine.ratingDiff || 0);
    }

    if (game.winner === "white") {
      if (isWhite) summary.wins += 1;
      else summary.losses += 1;
    } else if (game.winner === "black") {
      if (isWhite) summary.losses += 1;
      else summary.wins += 1;
    } else {
      summary.draws += 1;
    }

    var opponentRating = Number(opponent.rating || 0);
    if (((game.winner === "white" && isWhite) || (game.winner === "black" && !isWhite)) && opponentRating > bestOpponentRating) {
      bestOpponentRating = opponentRating;
      summary.bestResult = "Win vs " + opponentRating + " rated opponent";
    }
  });

  return summary;
}

function capitalizePerf(name) {
  return String(name || "").charAt(0).toUpperCase() + String(name || "").slice(1);
}

