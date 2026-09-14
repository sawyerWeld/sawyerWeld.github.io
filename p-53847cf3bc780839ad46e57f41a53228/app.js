'use strict';
const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const COLORS = ['#2167ae', '#2f855a', '#b45309', '#7c57a6', '#b54f69', '#087e8b', '#8b6b32', '#52627f'];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => Number(n).toFixed(1);
const delta = n => `${n > 0 ? '+' : ''}${fmt(n)}`;
const date = value => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {month:'short', day:'numeric'});
const signedClass = value => value > 0 ? 'positive' : value < 0 ? 'negative' : '';
const cup = '<svg class="cup" viewBox="0 0 20 20" aria-hidden="true"><path d="M6 3h8v5a4 4 0 0 1-8 0V3Zm0 1H3v2a4 4 0 0 0 4 4m7-6h3v2a4 4 0 0 1-4 4m-3 2v4m-3 1h6"/></svg>';
let data, selected = new Set(), mode = 'event', inspected = null, chartFrame;
let matchIndex, eventIndex, trophyPlayers;
const playerByName = new Map();
const color = name => COLORS[data.players.findIndex(p => p.player === name) % COLORS.length];
const s = (tag, attrs = {}, text = '') => {
  const node = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([key,value]) => node.setAttribute(key, value));
  if (text) node.textContent = text;
  return node;
};
function save() {
  try { localStorage.setItem('piedmont-stats-v1', JSON.stringify({players:[...selected], mode})); } catch {}
  const url = new URL(location.href);
  url.searchParams.set('players', JSON.stringify([...selected]));
  url.searchParams.set('view', mode);
  history.replaceState(null, '', url);
}
function setSelection(names) {
  selected = new Set(names.filter(name => playerByName.has(name)));
  inspected = null;
  save(); render();
}
function toggle(name) {
  const names = new Set(selected);
  names.has(name) ? names.delete(name) : names.add(name);
  setSelection([...names]);
}
function renderPlayers() {
  const query = $('player-search').value.trim().toLocaleLowerCase();
  const list = $('player-list');
  list.replaceChildren();
  const players = data.players.filter(p => p.player.toLocaleLowerCase().includes(query));
  if (!players.length) list.innerHTML = '<p class="empty">No matching players.</p>';
  for (const p of players) {
    const row = document.createElement('label');
    row.className = `player-option${selected.has(p.player) ? ' selected' : ''}`;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.checked = selected.has(p.player);
    checkbox.setAttribute('aria-label', `Compare ${p.player}`);
    checkbox.addEventListener('change', () => {
      toggle(p.player);
      // Restore keyboard focus after rebuilding the selectable list.
      [...list.querySelectorAll('input')].find(input => input.getAttribute('aria-label') === `Compare ${p.player}`)?.focus({preventScroll:true});
    });
    const name = document.createElement('span'); name.className = 'player-name'; name.textContent = p.player;
    const rating = document.createElement('span'); rating.className = 'player-rating';
    rating.innerHTML = `${fmt(p.elo)}<small class="${signedClass(p.changeLastEvent)}">${delta(p.changeLastEvent)}</small>`;
    row.append(checkbox, name, rating); list.append(row);
  }
  $('selected-count').textContent = `${selected.size} selected`;
}
function renderLegend() {
  $('legend').replaceChildren();
  for (const p of data.players.filter(p => selected.has(p.player))) {
    const button = document.createElement('button');
    button.innerHTML = `<span class="swatch" style="background:${color(p.player)}"></span>${esc(p.player)}<span class="remove" aria-hidden="true">×</span>`;
    button.setAttribute('aria-label', `Remove ${p.player} from chart`);
    button.addEventListener('click', () => toggle(p.player)); $('legend').append(button);
  }
}
function inspect(p, index) {
  inspected = {name:p.player, index};
  const t = data.timeline[index];
  const entries = mode === 'round'
    ? matchIndex.get(`${p.player}|${t.eventId}|${t.round}`) || []
    : eventIndex.get(`${p.player}|${t.eventId}`) || [];
  const eventName = t.eventTitle.includes('Win-a-Box') ? 'Win-a-Box' : 'FNM';
  const step = t.round === 0 ? 'Event start' : mode === 'event' ? 'Event end' : t.round === 6 && eventName === 'Win-a-Box' ? 'Quarterfinal' : `Round ${t.round}`;
  const record = data.results.find(r => r.player === p.player && r.eventId === t.eventId);
  const eventStart = data.timeline.findIndex(slot => slot.eventId === t.eventId && slot.round === 0);
  // Use unrounded endpoints for the event total, not the sum of rounded match deltas.
  const change = mode === 'event' && t.round > 0
    ? p.points[index] - p.points[eventStart]
    : entries.reduce((sum, row) => sum + row.ratingChange, 0);
  const peakNote = Math.abs(p.points[index] - p.peakElo) < .051 ? ' · Personal best' : '';
  let detail = '';
  if (t.round === 0) detail = '<span class="result-note">Rating entering the event.</span>';
  else if (!entries.length) detail = '<span class="result-note">No rated match at this point. Rating unchanged.</span>';
  else detail = entries.map(row => `<span class="match-detail"><strong>${esc(row.result)}</strong> vs ${esc(row.opponent)} <span class="${signedClass(row.ratingChange)}">${delta(row.ratingChange)}</span></span>`).join('');
  if (mode === 'event' && record) detail += `<div class="result-note">Official finish: ${record.wins}–${record.losses}${record.draws ? `–${record.draws}` : ''}${record.trophy ? ' · Trophy' : ''}${record.deck ? ` · ${esc(record.deck)}` : ''}</div>`;
  $('inspection').innerHTML = `<div class="inspection-head"><strong>${esc(p.player)}</strong><span>${date(t.eventDate)} · ${eventName} · ${step}</span></div><div class="rating">${fmt(p.points[index])} <span class="${signedClass(change)}">${t.round && entries.length ? `(${delta(change)})` : ''}</span><span class="result-note">${peakNote}</span></div><div>${detail}</div>`;
}
function renderChart() {
  const svg = $('chart'); svg.replaceChildren();
  const width = Math.max(300, $('chart-wrap').clientWidth - (innerWidth <= 760 ? 8 : 24));
  const height = innerWidth <= 760 ? 365 : 420;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const chosen = data.players.filter(p => selected.has(p.player));
  const endpoints = width > 610 && chosen.length <= 6;
  const margin = {left:43, right:endpoints ? 115 : 22, top:47, bottom:51};
  const plotW = width - margin.left - margin.right, plotH = height - margin.top - margin.bottom;
  const indexes = mode === 'round' ? data.timeline.map((_,i) => i) : data.timeline.map((t,i) => i).filter(i => i === 0 || !data.timeline[i+1] || data.timeline[i+1].eventId !== data.timeline[i].eventId);
  const scalePlayers = $('background').checked ? data.players : chosen;
  const ratings = [1200, ...scalePlayers.flatMap(p => p.points.filter(v => v != null))];
  const min = Math.floor((Math.min(...ratings)-15)/25)*25;
  const max = Math.ceil((Math.max(...ratings)+15)/25)*25;
  const x = pos => margin.left + pos / (indexes.length-1) * plotW;
  const y = value => margin.top + (max-value)/(max-min)*plotH;
  const events = [...new Set(data.timeline.map(t => t.eventId))];
  const byEventPositions = events.map(id => indexes.map((idx,pos) => data.timeline[idx].eventId === id ? pos : -1).filter(pos => pos >= 0));
  // A narrow event band anchors the special tournament in both views.
  events.forEach((id,e) => {
    const positions = byEventPositions[e];
    if (!positions.length) return;
    const pos = positions.at(-1), t = data.timeline[indexes[pos]];
    if (t.eventTitle.includes('Win-a-Box')) {
      const start = mode === 'event' ? x(pos)-plotW/(indexes.length-1)*.35 : x(positions[0]);
      const end = mode === 'event' ? x(pos)+plotW/(indexes.length-1)*.35 : x(pos);
      svg.append(s('rect', {x:start,y:margin.top-6,width:end-start,height:plotH+6,fill:'#eef3f8'}));
      svg.append(s('text',{x:(start+end)/2,y:24,'text-anchor':'middle',class:'axis-label'},'Win-a-Box'));
    }
  });
  const increment = max-min > 200 ? 50 : 25;
  for (let value=Math.ceil(min/increment)*increment;value<=max;value+=increment) {
    svg.append(s('line',{x1:margin.left,x2:width-margin.right,y1:y(value),y2:y(value),class:value===1200?'grid-line baseline':'grid-line'}));
    svg.append(s('text',{x:margin.left-10,y:y(value)+4,'text-anchor':'end',class:'axis-label'},String(value)));
  }
  if ((1200-Math.ceil(min/increment)*increment)%increment !== 0) svg.append(s('line',{x1:margin.left,x2:width-margin.right,y1:y(1200),y2:y(1200),class:'baseline'}));
  const small = width < 520;
  events.forEach((id,e) => {
    const positions=byEventPositions[e]; if (!positions.length) return;
    const pos = mode === 'event' ? positions.at(-1) : (positions[0]+positions.at(-1))/2;
    const t = data.timeline[indexes[positions.at(-1)]];
    const labelY = height-24+(small && e%2 ? 14 : 0);
    svg.append(s('text',{x:x(pos),y:labelY,'text-anchor':'middle',class:'axis-label'},date(t.eventDate)));
    if (mode==='round') svg.append(s('line',{x1:x(positions[0]),x2:x(positions[0]),y1:margin.top,y2:height-margin.bottom,stroke:'#d9e1ea','stroke-dasharray':'2 5'}));
  });
  if ($('background').checked) for(const p of data.players) {
    let d=''; indexes.forEach((idx,pos) => {if(p.points[idx]!=null)d+=`${d?'L':'M'}${x(pos)},${y(p.points[idx])} `;});
    svg.append(s('path',{d,class:'league-line'}));
  }
  const labels=[];
  for(const p of chosen) {
    let previous=null; const points=[];
    indexes.forEach((idx,pos) => {
      const rating=p.points[idx]; if(rating==null)return;
      const t=data.timeline[idx];
      const active=(eventIndex.get(`${p.player}|${t.eventId}`)||[]).length>0;
      if(previous) svg.append(s('path',{d:`M${previous.x},${previous.y} L${x(pos)},${y(rating)}`,stroke:color(p.player),class:'series-line',...(active?{}:{'stroke-dasharray':'4 5',opacity:'.55'})}));
      previous={x:x(pos),y:y(rating)};
      const matches=matchIndex.get(`${p.player}|${t.eventId}|${t.round}`)||[];
      if(!active || (mode==='round' && t.round!==0 && !matches.length))return;
      const point=s('circle',{cx:x(pos),cy:y(rating),r:mode==='round'?3.1:4,fill:color(p.player),class:'point',tabindex:points.length===0?'0':'-1',role:'button','aria-label':`${p.player}, ${date(t.eventDate)}, ${t.label}, Elo ${fmt(rating)}`});
      point.append(s('title',{},`${p.player} · ${date(t.eventDate)} · ${fmt(rating)}`));
      const open=()=>inspect(p,idx);
      point.addEventListener('pointerenter',open); point.addEventListener('focus',open);point.addEventListener('click',open);
      point.addEventListener('keydown',event=>{
        const at=points.indexOf(point);
        let next=event.key==='ArrowRight'?at+1:event.key==='ArrowLeft'?at-1:event.key==='Home'?0:event.key==='End'?points.length-1:null;
        if(next!=null){event.preventDefault();next=Math.max(0,Math.min(points.length-1,next));point.setAttribute('tabindex','-1');points[next].setAttribute('tabindex','0');points[next].focus();}
        if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}
      });
      points.push(point); svg.append(point);
    });
    if(previous)labels.push({p,x:previous.x,y:previous.y,targetY:previous.y});
  }
  if(endpoints){
    labels.sort((a,b)=>a.y-b.y);
    for(let i=1;i<labels.length;i++)labels[i].y=Math.max(labels[i].y,labels[i-1].y+27);
    const overflow=labels.length?Math.max(0,labels.at(-1).y-(height-margin.bottom)):0;
    for(const label of labels){
      label.y-=overflow;
      svg.append(s('path',{d:`M${label.x+5},${label.targetY} L${label.x+12},${label.y} L${label.x+17},${label.y}`,stroke:color(label.p.player),fill:'none','stroke-width':1,opacity:.5}));
      svg.append(s('text',{x:label.x+22,y:label.y-3,fill:color(label.p.player),class:'end-label'},label.p.player.split(' ')[0]));
      svg.append(s('text',{x:label.x+22,y:label.y+11,class:'axis-label'},fmt(label.p.elo)));
    }
  }
  if(!chosen.length)svg.append(s('text',{x:width/2,y:height/2,'text-anchor':'middle',class:'axis-label'},'Choose players to explore their ratings.'));
}
function renderTrophies() {
  const query=$('trophy-search').value.trim().toLocaleLowerCase();
  const all=$('show-zero').checked;
  const players=trophyPlayers.filter(p=>(all||p.trophies.length)&&p.player.toLocaleLowerCase().includes(query));
  $('trophy-rows').replaceChildren();
  for(const p of players){
    const rank=trophyPlayers.findIndex(other=>other.trophies.length===p.trophies.length)+1;
    const rate=p.trophies.length/p.fnmEvents*100;
    const finishes=p.trophies.slice().reverse();
    const row=document.createElement('tr');
    row.innerHTML=`<td>${p.trophies.length?rank:'—'}</td><td><button class="trophy-name player-link">${esc(p.player)} <span aria-hidden="true">↗</span></button>${finishes.length?`<details class="finish-details"><summary>${finishes.length===1?'1 finish':`${finishes.length} finishes`} · latest ${date(finishes[0].date)}</summary><ul>${finishes.map(r=>`<li>${date(r.date)} · <span>${r.wins}–0</span>${r.deck?` · ${esc(r.deck)}`:''}</li>`).join('')}</ul></details>`:''}</td><td>${p.trophies.length}<span class="trophy-marks">${cup.repeat(p.trophies.length)}</span></td><td>${p.fnmEvents}</td><td>${Number(rate.toFixed(1))}%<div class="rate-track" aria-hidden="true"><div class="rate-fill" style="width:${rate}%"></div></div></td>`;
    row.querySelector('button').setAttribute('aria-label',`View ${p.player}'s Elo`);
    row.querySelector('button').addEventListener('click',()=>{
      setSelection([p.player]);$('elo').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
      $('event-view').focus({preventScroll:true});
    });
    $('trophy-rows').append(row);
  }
  if(!players.length)$('trophy-rows').innerHTML='<tr><td colspan="5" class="empty">No matching players in this view.</td></tr>';
}
function render(){
  $('event-view').setAttribute('aria-pressed',String(mode==='event'));
  $('round-view').setAttribute('aria-pressed',String(mode==='round'));
  renderPlayers();renderLegend();renderChart();
  if(inspected&&selected.has(inspected.name))inspect(playerByName.get(inspected.name),inspected.index);
  else $('inspection').innerHTML='<p>Select a point for event results. Use arrow keys to move along a player’s history.</p>';
}
async function init(){
  const response=await fetch('data.json');if(!response.ok)throw new Error('Could not load league results');data=await response.json();
  data.players.forEach(p=>playerByName.set(p.player,p));
  matchIndex=new Map();eventIndex=new Map();
  for(const row of data.history){
    for(const [map,key] of [[matchIndex,`${row.player}|${row.eventId}|${row.round}`],[eventIndex,`${row.player}|${row.eventId}`]]){
      if(!map.has(key))map.set(key,[]);map.get(key).push(row);
    }
  }
  trophyPlayers=data.players.filter(p=>p.fnmEvents).sort((a,b)=>b.trophies.length-a.trophies.length||a.player.localeCompare(b.player));
  const url=new URL(location.href);let saved;
  try{saved=JSON.parse(localStorage.getItem('piedmont-stats-v1'));}catch{}
  let names=saved?.players;
  if(url.searchParams.has('players'))try{names=JSON.parse(url.searchParams.get('players'));}catch{names=null;}
  selected=new Set((Array.isArray(names)?names:data.players.slice(0,3).map(p=>p.player)).filter(name=>playerByName.has(name)));
  mode=(url.searchParams.get('view')||saved?.mode)==='round'?'round':'event';
  const trophies=data.results.filter(r=>r.trophy).length;
  const fnms=new Set(data.results.map(r=>r.eventId)).size;
  $('summary').innerHTML=`<span><strong>${data.meta.players}</strong> rated players</span><span><strong>${data.meta.matches}</strong> rated matches</span><span><strong>${fnms}</strong> FNMs</span><span><strong>${trophies}</strong> trophies</span><span class="through">Results through <strong style="font-size:12px">${date(data.through)}, ${data.through.slice(0,4)}</strong></span>`;
  $('trophy-total').innerHTML=`<strong>${trophies}</strong> trophies · ${trophyPlayers.filter(p=>p.trophies.length).length} players`;
  $('coverage').textContent=`${date(data.results[0].date)} – ${date(data.through)}, ${data.through.slice(0,4)} · Dragon’s Hoard`;
  $('snapshot').textContent=`${date(data.snapshotDate)}, ${data.snapshotDate.slice(0,4)}`;
  $('player-search').addEventListener('input',renderPlayers);$('trophy-search').addEventListener('input',renderTrophies);$('show-zero').addEventListener('change',renderTrophies);
  $('top-three').addEventListener('click',()=>setSelection(data.players.slice(0,3).map(p=>p.player)));
  $('trophy-preset').addEventListener('click',()=>setSelection(trophyPlayers.filter(p=>p.trophies.length===trophyPlayers[0].trophies.length).map(p=>p.player)));
  $('clear').addEventListener('click',()=>setSelection([]));$('background').addEventListener('change',renderChart);
  for(const view of ['event','round'])$(`${view}-view`).addEventListener('click',()=>{mode=view;inspected=null;save();render();});
  $('share').addEventListener('click',async()=>{
    save();try{await navigator.clipboard.writeText(location.href);$('share').textContent='Link copied';$('status').textContent='Comparison link copied';setTimeout(()=>$('share').textContent='Copy comparison link',2000);}catch{window.prompt('Copy this comparison link',location.href);}
  });
  new ResizeObserver(()=>{cancelAnimationFrame(chartFrame);chartFrame=requestAnimationFrame(renderChart);}).observe($('chart-wrap'));
  render();renderTrophies();
}
init().catch(error=>{console.error(error);$('summary').textContent='League data could not be loaded. Please reload the page.';});
