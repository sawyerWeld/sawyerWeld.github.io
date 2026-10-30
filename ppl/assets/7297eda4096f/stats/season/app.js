import { renderTrophy } from '../profiles/trophies.mjs';
import { loadSeason } from './data-source.mjs?v=d6ea6427d4b5';
import { renderEventList } from './event-list.mjs';
const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const percent = (value) => (value == null ? '—' : `${(value * 100).toFixed(1)}%`);
const shortDate = (s) =>
  new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
let data,
  query = '',
  page = 0,
  expanded = null;
const pageSize = 16;
const params = new URLSearchParams(location.search);
expanded = params.get('player');
function saveURL() {
  const u = new URL(location.href);
  u.searchParams.delete('store');
  expanded ? u.searchParams.set('player', expanded) : u.searchParams.delete('player');
  history.replaceState(null, '', u);
}
function trophyHTML(playerId) {
  return data.trophies
    .filter((t) => t.playerId === playerId)
    .sort((a, b) =>
      data.events
        .find((e) => e.id === b.eventId)
        .date.localeCompare(data.events.find((e) => e.id === a.eventId).date),
    )
    .map((t) => {
      const s = data.stores.find((s) => s.id === t.storeId),
        e = data.events.find((e) => e.id === t.eventId);
      return renderTrophy({
        storeId: s.id,
        storeName: s.name,
        date: e.date,
        record: t.eventRecord,
      });
    })
    .join('');
}
function detailHTML(p, columns) {
  return `<tr class="detail" id="detail-${p.playerId}"><td colspan="${columns}"><div class="event-list">${renderEventList(p, data)}</div></td></tr>`;
}
function render() {
  if (!data) return;
  const players = data.standings.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
  page = Math.min(page, Math.max(0, Math.ceil(players.length / pageSize) - 1));
  $('head').innerHTML =
    `<tr><th class="rank" scope="col">Rank</th><th scope="col">Player</th><th class="number" scope="col">Events</th><th class="number" scope="col">Points</th><th class="number" scope="col" title="Wins–losses–draws in rounds 1–3; byes count as wins">W–L–D</th><th class="number" scope="col" title="Average opponent season MW%, with a 33% floor per opponent; byes excluded, repeat opponents counted per match">OMW%</th></tr>`;
  const columns = 6;
  $('rows').innerHTML =
    players
      .slice(page * pageSize, (page + 1) * pageSize)
      .map((p) => {
        const open = expanded === p.playerId;
        return `<tr data-player="${p.playerId}" class="player-row ${open ? 'selected' : ''}"><td class="rank">${p.rank}</td><td class="player"><button class="expand" data-player="${p.playerId}" aria-label="${open ? 'Hide' : 'Show'} events for ${esc(p.name)}" aria-expanded="${open}" ${open ? `aria-controls="detail-${p.playerId}"` : ''}><span class="chevron" aria-hidden="true">${open ? '▾' : '▸'}</span></button><a class="name" href="/ppl/player.html?player=${encodeURIComponent(p.name)}">${esc(p.name)}</a><span class="trophies">${trophyHTML(p.playerId)}</span></td><td class="number">${p.eventsPlayed}</td><td class="number total">${p.points}</td><td class="number season-record">${esc(p.record)}</td><td class="number">${percent(p.opponentMatchWinPercentage)}</td></tr>${open ? detailHTML(p, columns) : ''}`;
      })
      .join('') || `<tr class="empty"><td colspan="${columns}">No players found.</td></tr>`;
  $('count').textContent = players.length
    ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, players.length)} of ${players.length} players`
    : '0 players';
  $('previous').disabled = page === 0;
  $('next').disabled = (page + 1) * pageSize >= players.length;
}
$('rows').addEventListener('click', (e) => {
  if (e.target.closest('a')) return;
  const b = e.target.closest('[data-player]');
  if (!b) return;
  expanded = expanded === b.dataset.player ? null : b.dataset.player;
  render();
  saveURL();
  if (e.detail === 0)
    $('rows')
      .querySelector(`button.expand[data-player="${b.dataset.player}"]`)
      .focus({ preventScroll: true });
});
$('search').addEventListener('input', (e) => {
  query = e.target.value;
  page = 0;
  render();
});
$('previous').addEventListener('click', () => {
  page--;
  render();
});
$('next').addEventListener('click', () => {
  page++;
  render();
});
async function init() {
  saveURL();
  try {
    data = await loadSeason();
    $('dates').textContent =
      `${shortDate(data.season.startDate)} – ${shortDate(data.season.endDate)}, ${data.season.startDate.slice(0, 4)}`;
    const position = data.standings.findIndex((p) => p.playerId === expanded);
    if (position >= 0) page = Math.floor(position / pageSize);
    render();
  } catch (e) {
    $('status').hidden = false;
    $('status').className = 'error';
    $('status').textContent = `${e.message} Reload the page to try again.`;
  }
}
init();
