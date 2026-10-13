import { renderTrophy } from './trophies.mjs';
import { selectPlayer, playerEvents, eventRecord } from './profile-data.mjs';
import { element as $, escapeHtml as esc, formatDate, loadLeagueData } from './ui.mjs';
const date = formatDate;
const fmt = (value) => Number(value).toFixed(1);
const signed = (value) => `${value > 0 ? '+' : ''}${fmt(value)}`;
const tone = (value) => (value > 0 ? 'positive' : value < 0 ? 'negative' : '');
let data, player;
function eventSlots(id) {
  return data.timeline
    .map((slot, index) => ({ ...slot, index }))
    .filter((slot) => slot.eventId === id);
}
function eventChange(id) {
  const slots = eventSlots(id);
  return player.points[slots.at(-1).index] - player.points[slots[0].index];
}
function showPlayer(name) {
  player = selectPlayer(data.players, name);
  const url = new URL(location.href);
  url.searchParams.set('player', player.player);
  history.replaceState(null, '', url);
  document.title = `${player.player} · Player profile`;
  $('player').value = player.player;
  $('name').textContent = player.player;
  $('stores').innerHTML = player.storeIds
    .map((id) => `<a href="./store.html?store=${id}">${esc(data.stores[id])}</a>`)
    .join(' · ');
  const events = playerEvents(data.results, player.player);
  const record = eventRecord(events);
  const stats = [
    ['Elo', fmt(player.elo)],
    ['Peak', fmt(player.peakElo)],
    ['Record', `${record.wins}–${record.losses}–${record.draws}`],
    ['Events', player.eventsPlayed],
    ['Trophies', player.trophies.length],
  ];
  $('stats').innerHTML = stats
    .map(([label, value]) => `<div><strong>${value}</strong><span>${label}</span></div>`)
    .join('');
  $('trophies').innerHTML = [...player.trophies]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((trophy) =>
      renderTrophy({
        storeId: trophy.storeId,
        storeName: data.stores[trophy.storeId],
        date: trophy.date,
        record: `${trophy.wins}–${trophy.losses}–${trophy.draws}`,
        showDate: true,
      }),
    )
    .join('');
  $('events').innerHTML = events.map(renderEvent).join('');
  renderChart();
}
function renderMatch(match, eventId) {
  const opponent = match.opponent
    ? `<a href="?player=${encodeURIComponent(match.opponent)}">${esc(match.opponent)}</a>`
    : '—';
  const opponentDeck = data.results.find(
    (entry) => entry.eventId === eventId && entry.player === match.opponent,
  )?.deck;
  return `<tr>
    <td>${match.round}</td>
    <td>${opponent}</td>
    <td class="opponent-deck">${esc(opponentDeck || '—')}</td>
    <td>${esc(match.result)}</td>
    <td class="${tone(match.ratingChange)}">${signed(match.ratingChange)}</td>
  </tr>`;
}

function renderEvent(event) {
  const change = eventChange(event.eventId);
  const belongsToEvent = (match) =>
    match.player === player.player && match.eventId === event.eventId;
  const matches = data.history.filter(belongsToEvent);
  const byes = data.byes
    .filter(belongsToEvent)
    .map((bye) => ({ ...bye, result: 'Bye', opponent: null, ratingChange: 0 }));
  const rounds = [...matches, ...byes].sort((a, b) => a.round - b.round);
  return `<details>
    <summary>
      <strong class="event-date">${date(event.date)}</strong>
      <span class="event-store muted">${esc(data.stores[event.storeId])}</span>
      <span class="deck">${esc(event.deck || '—')}</span>
      <span class="record">${event.wins}–${event.losses}–${event.draws}</span>
      <span class="delta ${tone(change)}">${signed(change)}</span>
    </summary>
    <div class="matches"><table><tbody>
      ${rounds.map((match) => renderMatch(match, event.eventId)).join('')}
    </tbody></table></div>
  </details>`;
}

function renderChart() {
  if (!player) return;
  const svg = $('chart');
  const entries = data.results
    .filter((r) => r.player === player.player)
    .sort((a, b) => a.date.localeCompare(b.date) || a.eventId.localeCompare(b.eventId));
  const points = entries.flatMap((event) => {
    const slots = eventSlots(event.eventId),
      start = slots[0],
      end = slots.at(-1);
    return [
      { event, value: player.points[start.index], start: true },
      { event, value: player.points[end.index], start: false },
    ];
  });
  const width = Math.max(290, svg.clientWidth),
    height = 260;
  const left = 42,
    right = width - 16,
    top = 14,
    bottom = height - 30;
  const min = Math.floor((Math.min(...points.map((p) => p.value)) - 10) / 25) * 25;
  const max = Math.ceil((Math.max(...points.map((p) => p.value)) + 10) / 25) * 25;
  const x = (i) => left + (i / Math.max(1, points.length - 1)) * (right - left);
  const y = (value) => bottom - ((value - min) / (max - min)) * (bottom - top);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute(
    'aria-label',
    `${player.player} Elo by event, ${date(entries[0].date)} through ${date(entries.at(-1).date)}`,
  );
  const ticks = Array.from({ length: 5 }, (_, i) => min + ((max - min) * i) / 4);
  let content = ticks
    .map(
      (v) =>
        `<line x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}" stroke="#e8edf2"/><text x="${left - 8}" y="${y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`,
    )
    .join('');
  content += `<path d="${points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ')}" fill="none" stroke="#2167ae" stroke-width="2"/>`;
  const interval = Math.max(1, Math.ceil(entries.length / (width < 500 ? 3 : 6)));
  points.forEach((p, i) => {
    const label = `${date(p.event.date)} · ${data.stores[p.event.storeId]} · ${p.start ? 'Start' : 'Finish'} · ${fmt(p.value)} Elo${p.start ? '' : ` (${signed(eventChange(p.event.eventId))})`}`;
    content += `<circle cx="${x(i)}" cy="${y(p.value)}" r="${p.start ? 3 : 4}" tabindex="0" data-label="${esc(label)}" aria-label="${esc(label)}"><title>${esc(label)}</title></circle>`;
    if (!p.start && (((i - 1) / 2) % interval === 0 || i === points.length - 1))
      content += `<text x="${x(i)}" y="${height - 7}" text-anchor="${i === points.length - 1 ? 'end' : 'middle'}">${date(p.event.date)}</text>`;
  });
  svg.innerHTML = content;
  $('inspection').textContent = '';
}
for (const type of ['pointerover', 'focusin', 'click'])
  $('chart').addEventListener(type, (event) => {
    const label = event.target.closest('[data-label]')?.dataset.label;
    if (label) $('inspection').textContent = label;
  });
$('player').addEventListener('change', (event) => showPlayer(event.target.value));
new ResizeObserver(renderChart).observe($('chart'));
try {
  data = await loadLeagueData();
  $('player').innerHTML = [...data.players]
    .sort((a, b) => a.player.localeCompare(b.player))
    .map((p) => `<option value="${esc(p.player)}">${esc(p.player)}</option>`)
    .join('');
  showPlayer(new URL(location.href).searchParams.get('player'));
} catch (error) {
  $('error').hidden = false;
  $('error').textContent = error.message;
}
