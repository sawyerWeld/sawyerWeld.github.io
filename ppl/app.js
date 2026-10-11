const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = value => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {month:'short', day:'numeric'});
const fmt = value => Number(value).toFixed(1);
const signed = value => `${value > 0 ? '+' : ''}${fmt(value)}`;
const tone = value => value > 0 ? 'positive' : value < 0 ? 'negative' : '';
let data, player;
function eventSlots(id) { return data.timeline.map((slot,index) => ({...slot,index})).filter(slot => slot.eventId === id); }
function eventChange(id) {
  const slots = eventSlots(id);
  return player.points[slots.at(-1).index] - player.points[slots[0].index];
}
function showPlayer(name) {
  player = data.players.find(p => p.player === name) || data.players[0];
  const url = new URL(location.href);
  url.searchParams.set('player', player.player);
  history.replaceState(null, '', url);
  document.title = `${player.player} · Player profile`;
  $('player').value = player.player;
  $('name').textContent = player.player;
  $('stores').innerHTML = player.storeIds.map(id => `<a href="./store.html?store=${id}">${esc(data.stores[id])}</a>`).join(' · ');
  const stats = [['Elo', fmt(player.elo)], ['Peak', fmt(player.peakElo)], ['Record', `${player.wins}–${player.losses}–${player.draws}`], ['Events', player.eventsPlayed], ['Trophies', player.trophies.length]];
  $('stats').innerHTML = stats.map(([label,value]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join('');
  $('trophies').innerHTML = player.trophies.map(t => `<span class="trophy" tabindex="0" title="${esc(data.stores[t.storeId])} · ${date(t.date)} · ${t.wins}–${t.losses}–${t.draws}">🏆 ${t.storeId === '7679' ? 'AE' : 'DH'} · ${date(t.date)}</span>`).join('');
  const events = data.results.filter(r => r.player === player.player).sort((a,b) => a.date.localeCompare(b.date) || a.eventId.localeCompare(b.eventId));
  $('events').innerHTML = events.map(event => {
    const change = eventChange(event.eventId);
    const matches = data.history.filter(r => r.player === player.player && r.eventId === event.eventId);
    const byes = data.byes.filter(r => r.player === player.player && r.eventId === event.eventId).map(r => ({...r, result:'Bye', opponent:null, ratingChange:0}));
    const rows = [...matches, ...byes].sort((a,b) => a.round - b.round);
    return `<details><summary><strong class="event-date">${date(event.date)}</strong><span class="event-store muted">${esc(data.stores[event.storeId])}</span><span class="deck">${esc(event.deck || '—')}</span><span class="record">${event.wins}–${event.losses}–${event.draws}</span><span class="delta ${tone(change)}">${signed(change)}</span></summary><div class="matches"><table><tbody>${rows.map(r => `<tr><td>${r.round}</td><td>${r.opponent ? `<a href="?player=${encodeURIComponent(r.opponent)}">${esc(r.opponent)}</a>` : '—'}</td><td class="opponent-deck">${esc(data.results.find(entry => entry.eventId === event.eventId && entry.player === r.opponent)?.deck || '—')}</td><td>${esc(r.result)}</td><td class="${tone(r.ratingChange)}">${signed(r.ratingChange)}</td></tr>`).join('')}</tbody></table></div></details>`;
  }).join('');
  renderChart();
}
function renderChart() {
  if (!player) return;
  const svg = $('chart');
  const entries = data.results.filter(r => r.player === player.player).sort((a,b) => a.date.localeCompare(b.date) || a.eventId.localeCompare(b.eventId));
  const points = entries.flatMap(event => {
    const slots = eventSlots(event.eventId), start = slots[0], end = slots.at(-1);
    return [{event, value:player.points[start.index], start:true}, {event,value:player.points[end.index],start:false}];
  });
  const width = Math.max(290, svg.clientWidth), height = 260;
  const left = 42, right = width - 16, top = 14, bottom = height - 30;
  const min = Math.floor((Math.min(...points.map(p => p.value)) - 10) / 25) * 25;
  const max = Math.ceil((Math.max(...points.map(p => p.value)) + 10) / 25) * 25;
  const x = i => left + i / Math.max(1, points.length - 1) * (right - left);
  const y = value => bottom - (value - min) / (max - min) * (bottom - top);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('aria-label', `${player.player} Elo by event, ${date(entries[0].date)} through ${date(entries.at(-1).date)}`);
  const ticks = Array.from({length:5}, (_,i) => min + (max-min) * i/4);
  let content = ticks.map(v => `<line x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}" stroke="#e8edf2"/><text x="${left-8}" y="${y(v)+4}" text-anchor="end">${Math.round(v)}</text>`).join('');
  content += `<path d="${points.map((p,i) => `${i?'L':'M'}${x(i)},${y(p.value)}`).join(' ')}" fill="none" stroke="#2167ae" stroke-width="2"/>`;
  const interval = Math.max(1, Math.ceil(entries.length / (width < 500 ? 3 : 6)));
  points.forEach((p,i) => {
    const label = `${date(p.event.date)} · ${data.stores[p.event.storeId]} · ${p.start ? 'Start' : 'Finish'} · ${fmt(p.value)} Elo${p.start ? '' : ` (${signed(eventChange(p.event.eventId))})`}`;
    content += `<circle cx="${x(i)}" cy="${y(p.value)}" r="${p.start?3:4}" tabindex="0" data-label="${esc(label)}" aria-label="${esc(label)}"><title>${esc(label)}</title></circle>`;
    if (!p.start && ((i-1)/2 % interval === 0 || i === points.length-1)) content += `<text x="${x(i)}" y="${height-7}" text-anchor="${i===points.length-1?'end':'middle'}">${date(p.event.date)}</text>`;
  });
  svg.innerHTML = content;
  $('inspection').textContent = '';
}
for (const type of ['pointerover','focusin','click']) $('chart').addEventListener(type, event => {
  const label = event.target.closest('[data-label]')?.dataset.label;
  if (label) $('inspection').textContent = label;
});
$('player').addEventListener('change', event => showPlayer(event.target.value));
new ResizeObserver(renderChart).observe($('chart'));
try {
  const response = await fetch('../combined-elo/data.json', {cache:'no-store'});
  if (!response.ok) throw Error('Could not load player data.');
  data = await response.json();
  $('player').innerHTML = [...data.players].sort((a,b) => a.player.localeCompare(b.player)).map(p => `<option value="${esc(p.player)}">${esc(p.player)}</option>`).join('');
  showPlayer(new URL(location.href).searchParams.get('player') || 'Sawyer W');
} catch(error) {
  $('error').hidden = false;
  $('error').textContent = error.message;
}
