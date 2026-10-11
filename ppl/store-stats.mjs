// Only explicit spelling aliases; uncertain decks and distinct variants stay separate.
const aliases = new Map(Object.entries({
  'u terror':'Mono Blue Terror', 'mono blue terror':'Mono Blue Terror',
  'ub terror':'Dimir Terror', 'dimir terror':'Dimir Terror',
  'u fae':'Mono Blue Faeries', 'ub fae':'Dimir Faeries', 'dimir fae':'Dimir Faeries', 'dimir faeries':'Dimir Faeries',
  'mono red madness':'Mono Red Madness', 'madness, red':'Mono Red Madness',
  'mono green elves':'Elves', 'elves':'Elves',
  '5c elves':'Rainbow Elves', 'rainbow elves':'Rainbow Elves',
  'tribe':'Tireless Tribe', 'tireless tribe':'Tireless Tribe'
}));
export function deckName(name) {
  if (!name?.trim()) return null;
  return aliases.get(name.toLowerCase().replaceAll('-', ' ').replace(/\s+/g, ' ').trim()) || name.trim();
}
export function storeStats(data, storeId) {
  const entries = data.results.filter(r => r.storeId === storeId);
  const decks = new Map();
  const history = new Map();
  for (const match of data.history) {
    const key = `${match.eventId}|${match.player}`;
    if (!history.has(key)) history.set(key, []);
    history.get(key).push(match);
  }
  for (const entry of entries) {
    const name = deckName(entry.deck);
    if (!name) continue;
    if (!decks.has(name)) decks.set(name, {name, entries:[], wins:0, losses:0, draws:0});
    const deck = decks.get(name);
    const record = {wins:0, losses:0, draws:0};
    for (const match of history.get(`${entry.eventId}|${entry.player}`) || []) {
      if (match.result === 'Win') record.wins++;
      else if (match.result === 'Loss') record.losses++;
      else if (match.result === 'Draw') record.draws++;
    }
    for (const field of ['wins','losses','draws']) deck[field] += record[field];
    deck.entries.push({...entry, ...record});
  }
  const rows = [...decks.values()].map(deck => {
    const matches = deck.wins + deck.losses + deck.draws;
    return {...deck, matches, share:deck.entries.length / entries.length,
      winRate:matches ? (deck.wins + deck.draws * .5) / matches : null};
  }).sort((a,b) => b.entries.length - a.entries.length || a.name.localeCompare(b.name));
  return {entries:entries.length, known:rows.reduce((sum,d) => sum+d.entries.length,0),
    players:new Set(entries.map(e => e.player)).size, events:new Set(entries.map(e => e.eventId)).size,
    dates:entries.map(e => e.date).sort(), decks:rows};
}
