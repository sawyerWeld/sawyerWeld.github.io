import {storeStats} from './store-stats.mjs?v=parent-1';
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = v => new Date(v+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
const percent = n => n === null ? '—' : `${(n*100).toFixed(1)}%`;
let data, stats, expanded = null;
function renderDecks() {
  $('decks').innerHTML = stats.decks.map((d,i) => `<tr class="deck-row" data-deck="${i}"><td><button class="deck-toggle" aria-expanded="${expanded===i}">${esc(d.name)}</button></td><td>${d.entries.length}</td><td><span class="bar" style="--share:${d.share*180}px"></span>${percent(d.share)}</td><td>${d.wins}–${d.losses}–${d.draws}</td><td>${percent(d.winRate)}</td></tr>${expanded===i ? `<tr class="deck-detail"><td colspan="5"><table><tbody>${[...d.entries].sort((a,b)=>b.date.localeCompare(a.date)||a.player.localeCompare(b.player)).map(e=>`<tr><td>${date(e.date)}</td><td><a href="./player.html?player=${encodeURIComponent(e.player)}">${esc(e.player)}</a></td><td>${e.wins}–${e.losses}–${e.draws}</td></tr>`).join('')}</tbody></table></td></tr>` : ''}`).join('');
}
function render(id) {
  if (!data.stores[id]) id = Object.keys(data.stores)[0];
  stats = storeStats(data,id); expanded = null;
  $('store').value = id;
  $('name').textContent = data.stores[id];document.title = `${data.stores[id]} · Store profile`;
  $('coverage').textContent = `${date(stats.dates[0])} – ${date(stats.dates.at(-1))} · ${stats.known}/${stats.entries} decks recorded`;
  $('stats').innerHTML = [['Events',stats.events],['Players',stats.players],['Entries',stats.entries],['Decks',stats.decks.length]].map(([label,value])=>`<div><strong>${value}</strong><span>${label}</span></div>`).join('');
  const u = new URL(location.href);u.searchParams.set('store',id);history.replaceState(null,'',u);
  const events = new Map();
  for (const entry of data.results.filter(r => r.storeId === id)) {
    if (!events.has(entry.eventId)) {
      const slot = data.timeline.find(t => t.eventId === entry.eventId);
      events.set(entry.eventId, {date:entry.date, title:slot.eventTitle, players:new Set()});
    }
    events.get(entry.eventId).players.add(entry.player);
  }
  $('store-events').innerHTML = [...events.values()].sort((a,b) => b.date.localeCompare(a.date)).map(e => `<tr><td>${date(e.date)}</td><td>${esc(e.title)}</td><td>${e.players.size}</td></tr>`).join('');
  renderDecks();
}
$('decks').addEventListener('click',e=>{const row=e.target.closest('[data-deck]');if(!row)return;const i=Number(row.dataset.deck);expanded=expanded===i?null:i;renderDecks();$('decks').querySelector(`[data-deck="${i}"] button`).focus({preventScroll:true});});
$('store').addEventListener('change',e=>render(e.target.value));
try {
  const response=await fetch('../combined-elo/data.json',{cache:'no-store'});if(!response.ok)throw Error('Could not load store data.');data=await response.json();
  $('store').innerHTML=Object.entries(data.stores).map(([id,name])=>`<option value="${id}">${esc(name)}</option>`).join('');
  render(new URL(location.href).searchParams.get('store')||'7679');
} catch(e) { $('error').hidden=false;$('error').textContent=e.message; }
