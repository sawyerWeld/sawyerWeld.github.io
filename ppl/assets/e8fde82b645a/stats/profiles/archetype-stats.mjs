import { archetype, rate } from "./metagame-stats.mjs";

const resultField = { Win: "wins", Loss: "losses", Draw: "draws" };
const record = () => ({ wins: 0, losses: 0, draws: 0 });
const matchCount = row => row.matchRecord.wins + row.matchRecord.losses + row.matchRecord.draws;
const stats = () => ({
  matchRecord: record(),
  gameRecord: record(),
  scoredMatches: 0,
  missingGameScores: 0,
});
const entryKey = (eventId, player) => JSON.stringify([eventId, player]);

function hasExactScore(match) {
  const games = [match.gamesWon, match.gamesLost, match.gamesDrawn];
  return !match.scoreInferred &&
    games.every(value => Number.isInteger(value) && value >= 0) &&
    games.reduce((sum, value) => sum + value, 0) > 0;
}

function addMatch(target, match, exact) {
  target.matchRecord[resultField[match.result]]++;
  if (exact) {
    target.gameRecord.wins += match.gamesWon;
    target.gameRecord.losses += match.gamesLost;
    target.gameRecord.draws += match.gamesDrawn;
    target.scoredMatches++;
  } else {
    target.missingGameScores++;
  }
}

export function archetypeProfile(data, name, {
  store = "all", from = "", to = "", fnm = false,
} = {}) {
  const field = data.results.filter(entry =>
    (store === "all" || entry.storeId === store) &&
    (!from || entry.date >= from) && (!to || entry.date <= to) &&
    (!fnm || entry.isFnm));
  const entries = field.filter(entry => archetype(entry) === name)
    .sort((a, b) => b.date.localeCompare(a.date) ||
      a.eventId.localeCompare(b.eventId) || a.player.localeCompare(b.player));
  if (!entries.length) return null;

  const lookup = new Map(field.map(entry => [entryKey(entry.eventId, entry.player), entry]));
  const playerNames = data.players === undefined
    ? null : new Set(data.players.map(player => player.player));
  const total = stats();
  const pilotStats = new Map();
  const opponentStats = new Map();
  for (const entry of entries) {
    if (!pilotStats.has(entry.player)) {
      pilotStats.set(entry.player, {
        name: entry.player, eventCount: 0, ...stats(),
        latestDate: entry.date, firstDate: entry.date,
      });
    }
    const pilot = pilotStats.get(entry.player);
    pilot.eventCount++;
    if (entry.date > pilot.latestDate) pilot.latestDate = entry.date;
    if (entry.date < pilot.firstDate) pilot.firstDate = entry.date;
  }

  for (const match of data.history) {
    if (match.unpairedLoss || !Object.hasOwn(resultField, match.result)) continue;
    // Legacy registration placeholders remain in history without a real player profile.
    if (playerNames && !playerNames.has(match.opponent)) continue;
    const entry = lookup.get(entryKey(match.eventId, match.player));
    if (!entry || archetype(entry) !== name) continue;
    const exact = hasExactScore(match);
    addMatch(total, match, exact);
    addMatch(pilotStats.get(match.player), match, exact);
    const opponent = archetype(lookup.get(entryKey(match.eventId, match.opponent))) || "Unknown";
    if (!opponentStats.has(opponent)) opponentStats.set(opponent, record());
    opponentStats.get(opponent)[resultField[match.result]]++;
  }

  // Mirrors contribute both player perspectives to totals and remain visible in the table.
  const matchups = [...opponentStats].map(([opponent, matchRecord]) => ({
    name: opponent,
    matchRecord,
    mw: rate(matchRecord),
    matchCount: matchRecord.wins + matchRecord.losses + matchRecord.draws,
    isMirror: opponent === name,
  })).sort((a, b) => b.matchCount - a.matchCount || a.name.localeCompare(b.name));
  const rankedMatchups = matchups.filter(row =>
    !row.isMirror && row.name !== "Unknown" && row.matchCount >= 5);
  const matchupTiebreak = (a, b) => b.matchCount - a.matchCount || a.name.localeCompare(b.name);
  const pilots = [...pilotStats.values()].map(pilot => ({
    name: pilot.name,
    eventCount: pilot.eventCount,
    matchRecord: pilot.matchRecord,
    gameRecord: pilot.gameRecord,
    mw: rate(pilot.matchRecord),
    gw: rate(pilot.gameRecord),
    latestDate: pilot.latestDate,
    firstDate: pilot.firstDate,
  })).sort((a, b) => a.name.localeCompare(b.name));

  return {
    name,
    entries,
    entryCount: entries.length,
    playerCount: pilots.length,
    trophyCount: entries.filter(entry => entry.trophy === true).length,
    fieldShare: entries.length / field.length,
    ...total,
    mw: rate(total.matchRecord),
    gw: rate(total.gameRecord),
    matchups,
    pilots,
    bestPilots: pilots.filter(pilot => pilot.eventCount >= 2 && matchCount(pilot) >= 5)
      .sort((a, b) => b.mw - a.mw || matchCount(b) - matchCount(a) || a.name.localeCompare(b.name)),
    dedicatedPilots: [...pilots].sort((a, b) =>
      b.eventCount - a.eventCount || a.name.localeCompare(b.name)),
    bestMatchups: rankedMatchups.filter(row => row.mw > 0.5)
      .sort((a, b) => b.mw - a.mw || matchupTiebreak(a, b)).slice(0, 3),
    worstMatchups: rankedMatchups.filter(row => row.mw < 0.5)
      .sort((a, b) => a.mw - b.mw || matchupTiebreak(a, b)).slice(0, 3),
  };
}
