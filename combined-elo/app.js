'use strict';
const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const COLORS = ['#2167ae', '#2f855a', '#b45309', '#7c57a6', '#b54f69', '#087e8b', '#8b6b32', '#52627f', '#a83f89', '#67933d', '#c34e36', '#397d99', '#7570b3', '#8d5642', '#4a7263'];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => Number(n).toFixed(1);
const delta = n => `${n > 0 ? '+' : ''}${fmt(n)}`;
const date = value => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {month:'short', day:'numeric'});
const signedClass = value => value > 0 ? 'positive' : value < 0 ? 'negative' : '';

let store = new URL(location.href).searchParams.get('store') || 'all';
const visiblePlayers = () => data.players.filter(p => store === 'all' || p.storeIds.includes(store));
let data, selected = new Set(), mode = 'round', inspected = null, chartFrame;
let matchIndex, eventIndex, byeIndex, attendanceIndex, trophyPlayers, leaderboardPage = 0;
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
  try { localStorage.setItem('combined-stats-v1', JSON.stringify({players:[...selected], mode})); } catch {}
  const url = new URL(location.href);
  url.searchParams.set('players', JSON.stringify([...selected]));
  url.searchParams.set('view', mode);
  url.searchParams.set('store', store);
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
  else if(mode==='round' && byeIndex.has(`${p.player}|${t.eventId}|${t.round}`))detail='<span class="result-note">Bye · Elo unchanged</span>';
  else if (!entries.length) detail = '<span class="result-note">No rated match at this point. Rating unchanged.</span>';
  else detail = entries.map(row => `<span class="match-detail"><strong>${esc(row.result)}</strong> vs ${esc(row.opponent)} <span class="${signedClass(row.ratingChange)}">${delta(row.ratingChange)}</span></span>`).join('');
  if (mode === 'event' && record) detail += `<div class="result-note">Official finish: ${record.wins}–${record.losses}${record.draws ? `–${record.draws}` : ''}${record.trophy ? ' · Trophy' : ''}${record.deck ? ` · ${esc(record.deck)}` : ''}</div>`;
  $('inspection').hidden = false;
  $('inspection').innerHTML = `<div class="inspection-head"><strong>${esc(p.player)}</strong><span>${date(t.eventDate)} · ${esc(t.storeName)} · ${eventName}${step ? ` · ${step}` : ''}</span></div><div class="rating">${fmt(p.points[index])} <span class="${signedClass(change)}">${t.round && entries.length ? `(${delta(change)})` : ''}</span><span class="result-note">${peakNote}</span></div><div>${detail}</div>`;
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
  const activeEvents = new Set(data.results.filter(r => selected.has(r.player)).map(r => r.eventId));
  const visibleIndexes = data.timeline.map((_,i) => i).filter(i => activeEvents.has(data.timeline[i].eventId));
  const indexes = mode === 'round' ? visibleIndexes : visibleIndexes.filter((i,pos) => pos === 0 || !data.timeline[i+1] || data.timeline[i+1].eventId !== data.timeline[i].eventId);
  // Plot each attended event's starting rating and played rounds.
  const series = new Map(chosen.map(p => {
    const samples = indexes.filter(idx => {
      const t = data.timeline[idx];
      if(p.points[idx] == null || !attendanceIndex.has(`${p.player}|${t.eventId}`))return false;
      if(mode === 'event')return true;
      if(t.round === 0)return true;
      return matchIndex.has(`${p.player}|${t.eventId}|${t.round}`) || byeIndex.has(`${p.player}|${t.eventId}|${t.round}`);
    });
    return [p.player,samples];
  }));
  const key = idx => {
    const t=data.timeline[idx];
    return mode==='round' ? `${t.eventDate}|${String(t.round).padStart(3,'0')}` : `${t.eventDate}|${t.eventId}|${t.round===0?'0':'1'}`;
  };
  const slots=[...new Set([...series.values()].flat().map(key))].sort();
  const positions=new Map(slots.map((slot,pos)=>[slot,pos]));
  const position = idx => positions.get(key(idx));
  const ratings = [1200, ...chosen.flatMap(p => series.get(p.player).map(i => p.points[i]))];
  const min = Math.floor((Math.min(...ratings)-15)/25)*25;
  const max = Math.ceil((Math.max(...ratings)+15)/25)*25;
  const x = pos => margin.left + pos / Math.max(1,slots.length-1) * plotW;
  const y = value => margin.top + (max-value)/(max-min)*plotH;
  const groups=new Map();
  for(const idx of [...series.values()].flat()){
    const t=data.timeline[idx], groupKey=mode==='round'?t.eventDate:t.eventId;
    if(!groups.has(groupKey))groups.set(groupKey,{date:t.eventDate,positions:new Set(),special:false});
    const group=groups.get(groupKey);
    group.positions.add(position(idx));
    group.special ||= t.eventTitle.includes('Win-a-Box');
  }
  const bands=[...groups.values()].map(g=>({...g,positions:[...g.positions].sort((a,b)=>a-b)})).sort((a,b)=>a.positions[0]-b.positions[0]);
  for(const band of bands){
    if(!band.special)continue;
    const first=band.positions[0],last=band.positions.at(-1);
    const padding=mode==='event'?plotW/Math.max(1,slots.length-1)*.35:0;
    const start=x(first)-padding,end=x(last)+padding;
    svg.append(s('rect',{x:start,y:margin.top-6,width:end-start,height:plotH+6,fill:'#eef3f8'}));
    svg.append(s('text',{x:(start+end)/2,y:24,'text-anchor':'middle',class:'axis-label'},'Win-a-Box'));
  }
  const increment = max-min > 200 ? 50 : 25;
  for (let value=Math.ceil(min/increment)*increment;value<=max;value+=increment) {
    svg.append(s('line',{x1:margin.left,x2:width-margin.right,y1:y(value),y2:y(value),class:value===1200?'grid-line baseline':'grid-line'}));
    svg.append(s('text',{x:margin.left-10,y:y(value)+4,'text-anchor':'end',class:'axis-label'},String(value)));
  }
  if ((1200-Math.ceil(min/increment)*increment)%increment !== 0) svg.append(s('line',{x1:margin.left,x2:width-margin.right,y1:y(1200),y2:y(1200),class:'baseline'}));
  const small = width < 520;
  bands.forEach((band,e) => {
    const first=band.positions[0],last=band.positions.at(-1);
    const pos=mode==='event'?last:(first+last)/2;
    const labelY=height-24+(small && e%2 ? 14 : 0);
    const labelEvery=Math.max(1,Math.ceil(bands.length/(plotW/65)));
    if(e%labelEvery===0||e===bands.length-1)svg.append(s('text',{x:x(pos),y:labelY,'text-anchor':'middle',class:'axis-label'},date(band.date)));
    if(mode==='round')svg.append(s('line',{x1:x(first),x2:x(first),y1:margin.top,y2:height-margin.bottom,stroke:'#d9e1ea','stroke-dasharray':'2 5'}));
  });
  const fnmDates=[...new Set(data.results.filter(r=>r.isFnm).map(r=>r.date))];
  const labels=[];
  for(const p of chosen) {
    const attendedDates=new Set(data.results.filter(r=>r.player===p.player).map(r=>r.date));
    let previous=null; const points=[];
    series.get(p.player).forEach(idx => {
      const pos=position(idx);
      const rating=p.points[idx]; if(rating==null)return;
      const t=data.timeline[idx];
      if(previous){
        const missedWeek=fnmDates.some(day=>day>previous.date&&day<t.eventDate&&!attendedDates.has(day));
        let fromX=previous.x;
        if(missedWeek){
          // Hold the old rating through the absence; only a played match changes it.
          fromX=t.round===0?x(pos):x(Math.max(previous.pos,pos-1));
          if(fromX===previous.x)fromX=x((previous.pos+pos)/2);
          svg.append(s('path',{d:`M${previous.x},${previous.y} L${fromX},${previous.y}`,stroke:color(p.player),class:'series-line','stroke-dasharray':'4 5',opacity:'.55'}));
        }
        if(fromX!==x(pos)||previous.y!==y(rating))svg.append(s('path',{d:`M${fromX},${previous.y} L${x(pos)},${y(rating)}`,stroke:color(p.player),class:'series-line'}));
      }
      previous={x:x(pos),y:y(rating),date:t.eventDate,pos};
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
    if(previous){
      const missedLaterWeek=fnmDates.some(day=>day>previous.date&&!attendedDates.has(day));
      if(missedLaterWeek&&previous.pos<slots.length-1){
        const edge=x(slots.length-1);
        svg.append(s('path',{d:`M${previous.x},${previous.y} L${edge},${previous.y}`,stroke:color(p.player),class:'series-line','stroke-dasharray':'4 5',opacity:'.55'}));
        previous.x=edge;
      }
      labels.push({p,x:previous.x,y:previous.y,targetY:previous.y});
    }
  }
  if(endpoints){
    labels.sort((a,b)=>a.y-b.y);
    for(let i=1;i<labels.length;i++)labels[i].y=Math.max(labels[i].y,labels[i-1].y+42);
    const labelX=width-margin.right+22;
    const centered=labels.length?labels.reduce((sum,l)=>sum+l.targetY-l.y,0)/labels.length:0;
    const shift=labels.length?Math.max(margin.top+13-labels[0].y,Math.min(centered,height-margin.bottom-14-labels.at(-1).y)):0;
    for(const label of labels){
      label.y+=shift;
      svg.append(s('path',{d:`M${label.x+5},${label.targetY} L${labelX-10},${label.y} L${labelX-5},${label.y}`,stroke:color(label.p.player),fill:'none','stroke-width':1,opacity:.5}));
      svg.append(s('text',{x:labelX,y:label.y-3,fill:color(label.p.player),class:'end-label'},label.p.player));
      svg.append(s('text',{x:labelX,y:label.y+11,class:'axis-label'},fmt(label.p.elo)));
    }
  }
  if(!chosen.length)svg.append(s('text',{x:width/2,y:height/2,'text-anchor':'middle',class:'axis-label'},'Choose players to explore their ratings.'));
}
function renderTrophies() {
  const eligible=trophyPlayers.filter(p=>store==='all'||p.storeIds.includes(store));
  const players=eligible.filter(p=>p.trophies.length>0 && eligible.findIndex(other=>other.trophies.length===p.trophies.length)+1<=5);
  $('trophy-list').innerHTML=players.map(p=>`<li><span>${esc(p.player)}</span><strong>${p.trophies.length}</strong></li>`).join('');
}
function renderLeaderboard() {
  const start=leaderboardPage*PAGE_SIZE;
  const visible=visiblePlayers();
  const players=visible.slice(start,start+PAGE_SIZE);
  $('elo-rows').innerHTML=players.map(p=>`<tr><td>${p.rank}</td><td><span class="swatch" style="background:${selected.has(p.player)?color(p.player):'transparent'}"></span>${esc(p.player)}${p.trophies.length ? `<span role="img" aria-label="${p.trophies.length} ${p.trophies.length===1?'trophy':'trophies'}" title="${esc(p.trophies.map(t=>date(t.date)).join(', '))}" style="margin-left:.6em;white-space:nowrap">${'🏆'.repeat(p.trophies.length)}</span>` : ''}</td><td>${fmt(p.elo)}</td><td class="${signedClass(p.changeLastEvent)}">${delta(p.changeLastEvent)}</td><td>${p.totalPoints}</td><td>${p.matches}</td><td>${p.wins}–${p.losses}–${p.draws}</td></tr>`).join('');
  $('page-range').textContent=`${start+1}–${start+players.length} of ${visible.length}`;
  $('previous-page').disabled=leaderboardPage===0;
  $('next-page').disabled=start+PAGE_SIZE>=visible.length;
}
function render(){
  document.querySelectorAll('[data-store]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.store===store)));
  $('event-view').setAttribute('aria-pressed',String(mode==='event'));
  $('round-view').setAttribute('aria-pressed',String(mode==='round'));
  document.querySelectorAll('[data-top]').forEach(button=>{
    const names=visiblePlayers().slice(0,Number(button.dataset.top)).map(p=>p.player);
    button.setAttribute('aria-pressed',String(selected.size===names.length&&names.every(name=>selected.has(name))));
  });
  renderChart();renderLeaderboard();
  if(inspected&&selected.has(inspected.name))inspect(playerByName.get(inspected.name),inspected.index);
  else { $('inspection').replaceChildren(); $('inspection').hidden=true; }
}
function applyData(next){
  data=next;
  if(store!=='all'&&!Object.hasOwn(data.stores,store))store='all';
  playerByName.clear();
  data.players.forEach(p=>playerByName.set(p.player,p));
  matchIndex=new Map();eventIndex=new Map();
  byeIndex=new Set((data.byes||[]).map(r=>`${r.player}|${r.eventId}|${r.round}`));
  attendanceIndex=new Set(data.results.map(r=>`${r.player}|${r.eventId}`));
  for(const row of data.history){
    for(const [map,key] of [[matchIndex,`${row.player}|${row.eventId}|${row.round}`],[eventIndex,`${row.player}|${row.eventId}`]]){
      if(!map.has(key))map.set(key,[]);map.get(key).push(row);
    }
  }
  trophyPlayers=data.players.filter(p=>p.fnmEvents).sort((a,b)=>b.trophies.length-a.trophies.length||a.player.localeCompare(b.player));
  leaderboardPage=Math.min(leaderboardPage,Math.max(0,Math.ceil(visiblePlayers().length/PAGE_SIZE)-1));
}
async function refreshData(initial=false){
  const button=$('refresh-data');button.disabled=true;button.textContent='Refreshing…';
  const preset=data?[5,10,15].find(n=>selected.size===n&&visiblePlayers().slice(0,n).every(p=>selected.has(p.player))):null;
  try{
    const {loadStats}=await import('./data-source.mjs?v=9221c79298e8');
    const result=await loadStats();
    applyData(result.data);
    if(!initial){
      selected=new Set(preset?visiblePlayers().slice(0,preset).map(p=>p.player):[...selected].filter(name=>playerByName.has(name)));
      inspected=null;render();renderTrophies();
    }
    const message=result.source==='live'?`Updated. Results through ${date(data.through)}, ${data.through.slice(0,4)}.`:`Update unavailable. Showing saved results through ${date(data.through)}, ${data.through.slice(0,4)}.`;
    $('data-notice').textContent=result.source==='live'?'':`Saved data · ${date(data.through)}`;
    $('data-notice').hidden=result.source==='live';
    $('status').textContent=message;button.title=message;button.dataset.source=result.source;
  }catch(error){
    $('data-notice').hidden=false;$('data-notice').textContent=data?`Refresh failed · ${date(data.through)} data`:'Stats unavailable';
    $('status').textContent='Stats could not be refreshed. Try again.';
    if(initial)throw error;
  }finally{button.disabled=false;button.textContent='Refresh';}
}
async function init(){
  await refreshData(true);
  const url=new URL(location.href);let saved;
  try{saved=JSON.parse(localStorage.getItem('combined-stats-v1'));}catch{}
  let names=saved?.players;
  if(url.searchParams.has('players'))try{names=JSON.parse(url.searchParams.get('players'));}catch{names=null;}
  // Keep selections from older links and saved preferences after abbreviating names.
  if(Array.isArray(names))names=names.filter(name=>typeof name==='string'&&name.trim()).map(name=>{
    const parts=name.trim().split(/\s+/);
    return parts[0][0].toUpperCase()+parts[0].slice(1).toLowerCase()+(parts.length>1?' '+parts.at(-1)[0].toUpperCase():'');
  });
  selected=new Set((Array.isArray(names)?names:visiblePlayers().slice(0,5).map(p=>p.player)).filter(name=>playerByName.has(name)));
  mode=(url.searchParams.get('view')||saved?.mode)==='event'?'event':'round';
  selected=new Set([...selected].filter(name=>visiblePlayers().some(p=>p.player===name)));
  if(!selected.size)selected=new Set(visiblePlayers().slice(0,5).map(p=>p.player));
  save();
  document.querySelectorAll('[data-store]').forEach(button=>button.addEventListener('click',()=>{
    store=button.dataset.store;leaderboardPage=0;
    setSelection(visiblePlayers().slice(0,5).map(p=>p.player));renderTrophies();
  }));
  document.querySelectorAll('[data-top]').forEach(button=>button.addEventListener('click',()=>setSelection(visiblePlayers().slice(0,Number(button.dataset.top)).map(p=>p.player))));
  for(const view of ['event','round'])$(`${view}-view`).addEventListener('click',()=>{mode=view;inspected=null;save();render();});
  $('previous-page').addEventListener('click',()=>{if(leaderboardPage>0){leaderboardPage--;renderLeaderboard();}});
  $('next-page').addEventListener('click',()=>{if((leaderboardPage+1)*PAGE_SIZE<visiblePlayers().length){leaderboardPage++;renderLeaderboard();}});
  new ResizeObserver(()=>{cancelAnimationFrame(chartFrame);chartFrame=requestAnimationFrame(renderChart);}).observe($('chart-wrap'));
  render();renderTrophies();
}
$('refresh-data').addEventListener('click',()=>{if(data)refreshData();else location.reload();});
init().catch(error=>{console.error(error);$('inspection').hidden=false;$('inspection').textContent='League data could not be loaded. Please reload the page.';});
