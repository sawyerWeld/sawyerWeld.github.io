import { loadLeagueFeed } from '../league-feed.mjs';

function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateScoringRules(rules) {
  if (!rules) return 'all-events';
  if (!Object.hasOwn(rules, 'scoring')) {
    if (rules.eventLimit == null) {
      if (Object.hasOwn(rules, 'monthlyStoreBonus') || Object.hasOwn(rules, 'eventSelection'))
        throw Error('Unsupported season scoring rules.');
      return 'all-events';
    }
    if (rules.eventLimit !== 10 || rules.eventSelection !== 'highest-points' ||
        Object.hasOwn(rules, 'monthlyStoreBonus'))
      throw Error('Unsupported capped season scoring rules.');
    return 'best-ten';
  }
  if (rules.scoring !== 'league') throw Error('Unsupported season scoring.');
  const tiebreakers = ['eventsPlayed', 'opponentMatchWinPercentage', 'trophyCount'];
  if (
    rules.eventLimit !== 10 ||
    (rules.eventSelection !== undefined && rules.eventSelection !== 'highest-points') ||
    rules.monthlyStoreBonus?.pointsPerAdditionalStore !== 1 ||
    rules.monthlyStoreBonus?.scope !== 'all-season-events' ||
    !Array.isArray(rules.tiebreakers) ||
    rules.tiebreakers.length !== tiebreakers.length ||
    rules.tiebreakers.some((value, index) => value !== tiebreakers[index])
  )
    throw Error('Unsupported league scoring rules.');
  return 'league';
}

function validateCountedEventPoints(player, entries, rules) {
  const countedIds = player.countedEventIds;
  const resultsByEvent = new Map(entries.map((entry) => [entry.eventId, entry]));
  if (
    !Array.isArray(countedIds) ||
    countedIds.length !== Math.min(rules.eventLimit, entries.length) ||
    new Set(countedIds).size !== countedIds.length ||
    countedIds.some((id) => !resultsByEvent.has(id))
  )
    throw Error('Invalid counted season events.');

  const countedPoints = countedIds.reduce((sum, id) => sum + resultsByEvent.get(id).points, 0);
  const bestPoints = entries
    .map((entry) => entry.points)
    .sort((a, b) => b - a)
    .slice(0, rules.eventLimit)
    .reduce((sum, points) => sum + points, 0);
  if (countedPoints !== bestPoints || player.eventPoints !== countedPoints)
    throw Error('Season event points do not match.');
  return countedPoints;
}

function validateCappedPoints(player, entries, rules) {
  const countedPoints = validateCountedEventPoints(player, entries, rules);
  if (Object.hasOwn(player, 'storeBonusPoints') || Object.hasOwn(player, 'storeBonuses') ||
      player.points !== countedPoints || player.eventsPlayed !== entries.length)
    throw Error('Capped season totals do not match.');
}

function validateLeaguePoints(player, entries, events, rules) {
  const countedPoints = validateCountedEventPoints(player, entries, rules);
  // Bonuses use every attended event, including results outside the best ten.
  const monthlyStores = new Map();
  for (const entry of entries) {
    const month = events.get(entry.eventId).date.slice(0, 7);
    if (!monthlyStores.has(month)) monthlyStores.set(month, new Set());
    monthlyStores.get(month).add(entry.storeId);
  }
  if (!Array.isArray(player.storeBonuses) || player.storeBonuses.length !== monthlyStores.size)
    throw Error('Invalid monthly store bonuses.');

  const seenMonths = new Set();
  let storeBonusPoints = 0;
  for (const bonus of player.storeBonuses) {
    const stores = monthlyStores.get(bonus?.month);
    if (
      !stores ||
      seenMonths.has(bonus.month) ||
      !Array.isArray(bonus.storeIds) ||
      bonus.storeIds.length !== stores.size ||
      new Set(bonus.storeIds).size !== stores.size ||
      bonus.storeIds.some((id) => !stores.has(id))
    )
      throw Error('Invalid monthly store bonuses.');
    const points = Math.max(0, stores.size - 1) * rules.monthlyStoreBonus.pointsPerAdditionalStore;
    if (bonus.points !== points) throw Error('Monthly store bonus points do not match.');
    seenMonths.add(bonus.month);
    storeBonusPoints += points;
  }
  if (
    player.storeBonusPoints !== storeBonusPoints ||
    player.points !== countedPoints + storeBonusPoints ||
    player.eventsPlayed !== entries.length
  )
    throw Error('League season totals do not match.');
}

export function validateSeason(data) {
  if (data?.schemaVersion !== 1 || !data.season?.id) throw Error('Unsupported season data.');
  const { startDate, endDate } = data.season;
  if (!isDate(startDate) || !isDate(endDate) || startDate > endDate)
    throw Error('Invalid season dates.');
  for (const key of ['standings', 'events', 'stores', 'eventResults', 'trophies'])
    if (!Array.isArray(data[key])) throw Error('Incomplete season data.');
  const scoring = validateScoringRules(data.rules);
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
    playerEntries = new Map([...players].map((id) => [id, []]));
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
          (x.unpairedLoss !== undefined &&
            (x.unpairedLoss !== true || x.result !== 'loss' || x.opponentId !== null || x.intentionalDraw)) ||
          x.points !== { win: 3, loss: 0, draw: 1, bye: 3 }[x.result],
      ) ||
      r.rounds.reduce((n, x) => n + x.points, 0) !== r.points
    )
      throw Error('Round points do not match.');
    playerEntries.get(r.playerId).push(r);
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
  for (const p of data.standings) {
    if (typeof p.name !== 'string' || !Array.isArray(p.storeIds))
      throw Error('Invalid season player.');
    const results = playerEntries.get(p.playerId);
    if (scoring === 'league') validateLeaguePoints(p, results, events, data.rules);
    else if (scoring === 'best-ten') validateCappedPoints(p, results, data.rules);
    else if (p.points !== results.reduce((sum, result) => sum + result.points, 0))
      throw Error('Season totals do not match.');
  }
  for (const p of data.standings)
    if (Object.hasOwn(p, 'trophyCount') && p.trophyCount !== (trophyCounts.get(p.playerId) || 0))
      throw Error('Season trophy totals do not match.');
  return data;
}
export async function loadSeason() {
  return validateSeason((await loadLeagueFeed()).season);
}
