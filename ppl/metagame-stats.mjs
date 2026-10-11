export const archetype = entry => entry?.archetype || entry?.deck || null;
export const rate = record => {
  const n = record.wins + record.losses + record.draws;
  return n ? (record.wins + record.draws / 2) / n : null;
};
const record = () => ({wins:0, losses:0, draws:0, matches:[]});
function add(target, match) {
  target[({Win:'wins', Loss:'losses', Draw:'draws'})[match.result]]++;
  target.matches.push(match);
}
export function metagame(data, {store='all', from='', to='', fnm=false}={}) {
  const entries = data.results.filter(e => (store==='all'||e.storeId===store) && (!from||e.date>=from) && (!to||e.date<=to) && (!fnm||e.isFnm));
  const lookup = new Map(entries.map(e => [`${e.eventId}|${e.player}`, e]));
  const decks = new Map(), matrix = new Map(), unique = new Set();
  let unknown = 0;
  for (const entry of entries) {
    const name = archetype(entry);
    if (!name) { unknown++; continue; }
    if (!decks.has(name)) decks.set(name, {name, entries:[], players:new Set(), ...record()});
    const deck = decks.get(name);deck.entries.push(entry);deck.players.add(entry.player);
  }
  for (const match of data.history) {
    const entry = lookup.get(`${match.eventId}|${match.player}`);
    if (!entry || !['Win','Loss','Draw'].includes(match.result)) continue;
    unique.add(JSON.stringify([match.eventId,match.round,[match.player,match.opponent].sort()]));
    const name = archetype(entry);
    if (!name) continue;
    const opponent = archetype(lookup.get(`${match.eventId}|${match.opponent}`));
    const detail = {...match, storeId:entry.storeId, deck:name, opponentDeck:opponent};
    add(decks.get(name), detail);
    if (opponent) {
      if (!matrix.has(name)) matrix.set(name,new Map());
      if (!matrix.get(name).has(opponent)) matrix.get(name).set(opponent,record());
      add(matrix.get(name).get(opponent),detail);
    }
  }
  const rows = [...decks.values()].map(d => ({...d, share:d.entries.length/entries.length, winRate:rate(d)}))
    .sort((a,b)=>b.entries.length-a.entries.length||a.name.localeCompare(b.name));
  return {entries,unknown,decks:rows,matrix,events:new Set(entries.map(e=>e.eventId)).size,matches:unique.size};
}
