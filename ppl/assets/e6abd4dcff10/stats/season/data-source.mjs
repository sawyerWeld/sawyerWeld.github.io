// Replace this URL with a public JSON feed when the season sheet is connected.
// The renderer only depends on the version-1 season object, not Sheets columns.
export const DATA_URL = '/season-standings/season.json';

function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateSeason(data) {
  if (data?.schemaVersion !== 1 || !data.season?.id) throw Error('Unsupported season data.');
  const { startDate, endDate } = data.season;
  if (!isDate(startDate) || !isDate(endDate) || startDate > endDate)
    throw Error('Invalid season dates.');
  for (const key of ['standings', 'events', 'stores', 'eventResults', 'trophies'])
    if (!Array.isArray(data[key])) throw Error('Incomplete season data.');
  const players = new Set(data.standings.map((p) => p.playerId)),
    events = new Map(data.events.map((e) => [e.id, e])),
    stores = new Set(data.stores.map((s) => s.id));
  if (
    players.size !== data.standings.length ||
    events.size !== data.events.length ||
    stores.size !== data.stores.length
  )
    throw Error('Duplicate season entries.');
  if (
    [...players].some((id) => !/^[-a-zA-Z0-9]+$/.test(id)) ||
    [...stores].some((id) => !/^\d+$/.test(id))
  )
    throw Error('Invalid identifiers.');
  for (const event of data.events)
    if (
      !isDate(event.date) ||
      event.date < startDate ||
      event.date > endDate ||
      !stores.has(event.storeId)
    )
      throw Error('Invalid season event.');
  const entries = new Map(),
    totals = new Map();
  for (const r of data.eventResults) {
    const key = r.playerId + '|' + r.eventId;
    if (
      entries.has(key) ||
      !players.has(r.playerId) ||
      !events.has(r.eventId) ||
      !stores.has(r.storeId) ||
      events.get(r.eventId)?.storeId !== r.storeId ||
      !Number.isInteger(r.points) ||
      r.points < 0 ||
      r.points > 9 ||
      !Array.isArray(r.rounds)
    )
      throw Error('Invalid event result.');
    entries.set(key, r);
    if (
      new Set(r.rounds.map((x) => x.round)).size !== r.rounds.length ||
      r.rounds.some(
        (x) =>
          ![1, 2, 3].includes(x.round) ||
          !['win', 'loss', 'draw', 'bye'].includes(x.result) ||
          x.points !== { win: 3, loss: 0, draw: 1, bye: 3 }[x.result],
      ) ||
      r.rounds.reduce((n, x) => n + x.points, 0) !== r.points
    )
      throw Error('Round points do not match.');
    totals.set(r.playerId, (totals.get(r.playerId) || 0) + r.points);
  }
  const trophyPairs = new Set(),
    trophyCounts = new Map();
  for (const trophy of data.trophies) {
    const key = trophy.playerId + '|' + trophy.eventId;
    const entry = entries.get(key);
    const record = /^(\d+)-(\d+)-(\d+)$/.exec(trophy.eventRecord);
    if (
      trophyPairs.has(key) ||
      !entry ||
      trophy.storeId !== entry.storeId ||
      trophy.eventRecord !== entry.eventRecord ||
      !record ||
      !record.slice(1).every((value) => Number.isSafeInteger(Number(value))) ||
      Number(record[1]) < 3 ||
      Number(record[2]) !== 0
    )
      throw Error('Invalid season trophy.');
    trophyPairs.add(key);
    trophyCounts.set(trophy.playerId, (trophyCounts.get(trophy.playerId) || 0) + 1);
  }
  for (const p of data.standings)
    if (
      typeof p.name !== 'string' ||
      p.points !== (totals.get(p.playerId) || 0) ||
      !Array.isArray(p.storeIds)
    )
      throw Error('Season totals do not match.');
  for (const p of data.standings)
    if (Object.hasOwn(p, 'trophyCount') && p.trophyCount !== (trophyCounts.get(p.playerId) || 0))
      throw Error('Season trophy totals do not match.');
  return data;
}
export async function loadSeason() {
  const response = await fetch(DATA_URL, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw Error('Could not load season data.');
  return validateSeason(await response.json());
}
