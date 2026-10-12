const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = v => new Date(v+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
let data;
function render(id) {
  if (!data.stores[id]) id = Object.keys(data.stores)[0];
  $('store').value = id;
  $('name').textContent = data.stores[id];document.title = `${data.stores[id]} · Store profile`;
  const u = new URL(location.href);u.searchParams.set('store',id);history.replaceState(null,'',u);
  const events = new Map();
  const entries = data.results.filter(r => r.storeId === id);
  for (const entry of entries) {
    if (!events.has(entry.eventId)) {
      const slot = data.timeline.find(t => t.eventId === entry.eventId);
      events.set(entry.eventId, {date:entry.date, title:slot.eventTitle, players:new Set()});
    }
    events.get(entry.eventId).players.add(entry.player);
  }
  $('store-events').innerHTML = [...events.values()].sort((a,b) => b.date.localeCompare(a.date)).map(e => `<tr><td>${date(e.date)}</td><td>${esc(e.title)}</td><td>${e.players.size}</td></tr>`).join('');
  $('stats').innerHTML = [['Events',events.size],['Players',new Set(entries.map(e => e.player)).size],['Entries',entries.length]].map(([label,value])=>`<div><strong>${value}</strong><span>${label}</span></div>`).join('');
}
$('store').addEventListener('change',e=>render(e.target.value));
try {
  const response=await fetch('../combined-elo/data.json',{cache:'no-store'});if(!response.ok)throw Error('Could not load store data.');data=await response.json();
  $('store').innerHTML=Object.entries(data.stores).map(([id,name])=>`<option value="${id}">${esc(name)}</option>`).join('');
  render(new URL(location.href).searchParams.get('store')||'7679');
} catch(e) { $('error').hidden=false;$('error').textContent=e.message; }
