import { archetype, rate } from "./metagame-stats.mjs";

const easternDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const resultField = { Win: "wins", Loss: "losses", Draw: "draws" };
const record = () => ({ wins: 0, losses: 0, draws: 0 });
const period = () => ({
  eventCount: 0,
  matchRecord: record(),
  gameRecord: record(),
  scoredMatches: 0,
  missingGameScores: 0,
});

function recentWindow(now) {
  const parts = Object.fromEntries(
    easternDate.formatToParts(now).map(({ type, value }) => [type, value]),
  );
  const to = `${parts.year}-${parts.month}-${parts.day}`;
  // Calendar arithmetic after finding the Eastern date avoids DST-length days.
  const start = new Date(`${to}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 29);
  return { from: start.toISOString().slice(0, 10), to };
}

function addMatch(stats, match) {
  stats.matchRecord[resultField[match.result]]++;
  const games = [match.gamesWon, match.gamesLost, match.gamesDrawn];
  const scored = !match.scoreInferred &&
    games.every(value => Number.isInteger(value) && value >= 0) &&
    games.reduce((sum, value) => sum + value, 0) > 0;
  if (scored) {
    stats.gameRecord.wins += match.gamesWon;
    stats.gameRecord.losses += match.gamesLost;
    stats.gameRecord.draws += match.gamesDrawn;
    stats.scoredMatches++;
  } else {
    stats.missingGameScores++;
  }
}

const finish = stats => ({
  ...stats,
  mw: rate(stats.matchRecord),
  gw: rate(stats.gameRecord),
});

export function playerDeckStats(data, playerName, { now = new Date() } = {}) {
  const { from, to } = recentWindow(now);
  const playerNames = data.players === undefined
    ? null : new Set(data.players.map(player => player.player));
  const decks = new Map();
  const events = new Map();
  for (const entry of data.results) {
    if (entry.player !== playerName || entry.date > to) continue;
    const name = archetype(entry) || "Unknown";
    if (!decks.has(name)) {
      decks.set(name, { archetype: name, all: period(), recent: null, latest: entry.date });
    }
    const deck = decks.get(name);
    const recent = entry.date >= from;
    deck.all.eventCount++;
    if (entry.date > deck.latest) deck.latest = entry.date;
    if (recent) {
      if (!deck.recent) deck.recent = period();
      deck.recent.eventCount++;
    }
    events.set(entry.eventId, { deck, recent });
  }

  // History includes played playoff rounds; standings totals include byes/IDs.
  for (const match of data.history) {
    if (match.player !== playerName || match.unpairedLoss ||
        !Object.hasOwn(resultField, match.result)) continue;
    // Historical registration placeholders remain in history, but aren't played opponents.
    if (playerNames && !playerNames.has(match.opponent)) continue;
    const event = events.get(match.eventId);
    if (!event) continue;
    addMatch(event.deck.all, match);
    if (event.recent) addMatch(event.deck.recent, match);
  }

  const rows = [...decks.values()]
    .sort((a, b) => b.all.eventCount - a.all.eventCount ||
      b.latest.localeCompare(a.latest) || a.archetype.localeCompare(b.archetype))
    .map(deck => ({
      archetype: deck.archetype,
      all: finish(deck.all),
      recent: deck.recent ? finish(deck.recent) : null,
    }));
  return { from, to, rows };
}
