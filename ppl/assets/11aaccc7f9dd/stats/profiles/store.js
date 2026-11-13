import { element as $, escapeHtml as esc, formatDate, loadLeagueData } from './ui.mjs';
import { readPreferences, savePreferences, preferredStore } from '../preferences.mjs';
const date = (value) => formatDate(value, true);
let data;
function render(id) {
  if (!data.stores[id]) id = Object.keys(data.stores)[0];
  $('store').value = id;
  $('name').textContent = data.stores[id];
  for (const summary of document.querySelectorAll('.store-summary')) {
    summary.hidden = summary.dataset.storeId !== id;
  }
  document.title = `${data.stores[id]} · Store profile`;
  const u = new URL(location.href);
  u.searchParams.set('store', id);
  history.replaceState(null, '', u);
  const events = new Map();
  const entries = data.results.filter((r) => r.storeId === id);
  for (const entry of entries) {
    if (!events.has(entry.eventId)) {
      const slot = data.timeline.find((t) => t.eventId === entry.eventId);
      events.set(entry.eventId, { date: entry.date, title: slot.eventTitle, players: new Set() });
    }
    events.get(entry.eventId).players.add(entry.player);
  }
  $('store-events').innerHTML = [...events.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(
      (e) => `<tr><td>${date(e.date)}</td><td>${esc(e.title)}</td><td>${e.players.size}</td></tr>`,
    )
    .join('');
}
$('store').addEventListener('change', (e) => {
  render(e.target.value);
  savePreferences('ppl-store-v1', { store: $('store').value });
});
try {
  data = await loadLeagueData();
  $('store').innerHTML = Object.entries(data.stores)
    .sort(([, a], [, b]) => a.localeCompare(b))
    .map(([id, name]) => `<option value="${id}">${esc(name)}</option>`)
    .join('');
  render(preferredStore(new URL(location.href).searchParams,
    readPreferences('ppl-store-v1').store, data.stores,
    Object.hasOwn(data.stores, '7679') ? '7679' : $('store').options[0].value));
} catch (e) {
  $('error').hidden = false;
  $('error').textContent = e.message;
}
