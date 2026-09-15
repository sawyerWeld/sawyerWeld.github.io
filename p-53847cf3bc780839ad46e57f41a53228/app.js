'use strict';
const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const COLORS = ['#2167ae', '#2f855a', '#b45309', '#7c57a6', '#b54f69', '#087e8b', '#8b6b32', '#52627f', '#a83f89', '#67933d', '#c34e36', '#397d99', '#7570b3', '#8d5642', '#4a7263'];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => Number(n).toFixed(1);
const delta = n => `${n > 0 ? '+' : ''}${fmt(n)}`;
const date = value => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {month:'short', day:'numeric'});
const signedClass = value => value > 0 ? 'positive' : value < 0 ? 'negative' : '';

let data, selected = new Set(), mode = 'round', inspected = null, chartFrame;
let matchIndex, eventIndex, trophyPlayers, leaderboardPage = 0;
const PAGE_SIZE = 15;
const playerByName = new Map();
const color = name => COLORS[data.players.findIndex(p => p.player === name) % COLORS.length];
const s = (tag, attrs = {}, text = '') => {
  const node = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([key,value]) => node.setAttribute(key, value));
  if (text) node.textContent = text;
  return node;
};
function save() {
  try { localStorage.setItem('piedmont-stats-v2', JSON.stringify({players:[...selected], mode})); } catch {}
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
function inspect(p, index) {
  inspected = {name:p.player, index};
  const t = data.timeline[index];
  const entries = mode === 'round'
    ? matchIndex.get(`${p.player}|${t.eventId}|${t.round}`) || []
    : eventIndex.get(`${p.player}|${t.eventId}`) || [];
  const eventName = t.eventTitle.includes('Win-a-Box') ? 'Win-a-Box' : 'FNM';
  const step = t.round === 0 ? 'Event start' : mode === 'event' ? '' : t.round === 6 && eventName === 'Win-a-Box' ? 'Quarterfinal' : `Round ${t.round}`;
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
  $('inspection').hidden = false;
  $('inspection').innerHTML = `<div class="inspection-head"><strong>${esc(p.player)}</strong><span>${date(t.eventDate)} · ${eventName}${step ? ` · ${step}` : ''}</span></div><div class="rating">${fmt(p.points[index])} <span class="${signedClass(change)}">${t.round && entries.length ? `(${delta(change)})` : ''}</span><span class="result-note">${peakNote}</span></div><div>${detail}</div>`;
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
  const scalePlayers = chosen;
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
  const players=trophyPlayers.filter(p=>p.trophies.length>0 && trophyPlayers.findIndex(other=>other.trophies.length===p.trophies.length)+1<=5);
  $('trophy-list').innerHTML=players.map(p=>`<li><span>${esc(p.player)}</span><strong>${p.trophies.length}</strong></li>`).join('');
}
function renderLeaderboard() {
  const start=leaderboardPage*PAGE_SIZE;
  const players=data.players.slice(start,start+PAGE_SIZE);
  $('elo-rows').innerHTML=players.map(p=>`<tr><td>${p.rank}</td><td><span class="swatch" style="background:${selected.has(p.player)?color(p.player):'transparent'}"></span>${esc(p.player)}</td><td>${fmt(p.elo)}</td><td class="${signedClass(p.changeLastEvent)}">${delta(p.changeLastEvent)}</td><td>${p.matches}</td><td>${p.wins}–${p.losses}–${p.draws}</td></tr>`).join('');
  $('page-range').textContent=`${start+1}–${start+players.length} of ${data.players.length}`;
  $('previous-page').disabled=leaderboardPage===0;
  $('next-page').disabled=start+PAGE_SIZE>=data.players.length;
}
function render(){
  $('event-view').setAttribute('aria-pressed',String(mode==='event'));
  $('round-view').setAttribute('aria-pressed',String(mode==='round'));
  document.querySelectorAll('[data-top]').forEach(button=>{
    const names=data.players.slice(0,Number(button.dataset.top)).map(p=>p.player);
    button.setAttribute('aria-pressed',String(selected.size===names.length&&names.every(name=>selected.has(name))));
  });
  renderChart();renderLeaderboard();
  if(inspected&&selected.has(inspected.name))inspect(playerByName.get(inspected.name),inspected.index);
  else { $('inspection').replaceChildren(); $('inspection').hidden=true; }
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
  try{saved=JSON.parse(localStorage.getItem('piedmont-stats-v2'));}catch{}
  let names=saved?.players;
  if(url.searchParams.has('players'))try{names=JSON.parse(url.searchParams.get('players'));}catch{names=null;}
  selected=new Set((Array.isArray(names)?names:data.players.slice(0,5).map(p=>p.player)).filter(name=>playerByName.has(name)));
  mode=(url.searchParams.get('view')||saved?.mode)==='event'?'event':'round';
  document.querySelectorAll('[data-top]').forEach(button=>button.addEventListener('click',()=>setSelection(data.players.slice(0,Number(button.dataset.top)).map(p=>p.player))));
  for(const view of ['event','round'])$(`${view}-view`).addEventListener('click',()=>{mode=view;inspected=null;save();render();});
  $('previous-page').addEventListener('click',()=>{if(leaderboardPage>0){leaderboardPage--;renderLeaderboard();}});
  $('next-page').addEventListener('click',()=>{if((leaderboardPage+1)*PAGE_SIZE<data.players.length){leaderboardPage++;renderLeaderboard();}});
  new ResizeObserver(()=>{cancelAnimationFrame(chartFrame);chartFrame=requestAnimationFrame(renderChart);}).observe($('chart-wrap'));
  render();renderTrophies();
}
init().catch(error=>{console.error(error);$('inspection').hidden=false;$('inspection').textContent='League data could not be loaded. Please reload the page.';});
