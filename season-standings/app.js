import {loadSeason} from './data-source.mjs';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shortDate=s=>new Date(s+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
let data,query='',page=0,expanded=null;
const pageSize=16;
const params=new URLSearchParams(location.search);expanded=params.get('player');
function saveURL(){const u=new URL(location.href);u.searchParams.delete('store');expanded?u.searchParams.set('player',expanded):u.searchParams.delete('player');history.replaceState(null,'',u);}
function trophyHTML(playerId){
  return data.trophies.filter(t=>t.playerId===playerId).map(t=>{
    const s=data.stores.find(s=>s.id===t.storeId),e=data.events.find(e=>e.id===t.eventId);
    const title=`${s.name} · ${shortDate(e.date)} · ${t.eventRecord}`;
    let icon=`🏆 <span>${s.id==='7679'?'AE':s.id==='15582'?'DH':esc(s.name)}</span>`;
    if(s.logoUrl){const url=new URL(s.logoUrl,location.href);if(['http:','https:'].includes(url.protocol))icon=`<img src="${esc(url.href)}" alt="${esc(s.name)}">`;}
    return `<span class="award" tabindex="0" aria-label="${esc(title)}">${icon}<span class="tip" role="tooltip">${esc(title)}</span></span>`;
  }).join('');
}
function detailHTML(p,columns){
  const entries=data.eventResults.filter(r=>r.playerId===p.playerId).sort((a,b)=>data.events.find(e=>e.id===a.eventId).date.localeCompare(data.events.find(e=>e.id===b.eventId).date));
  return `<tr class="detail" id="detail-${p.playerId}"><td colspan="${columns}"><div class="event-list">${entries.map(r=>{
    const e=data.events.find(e=>e.id===r.eventId),s=data.stores.find(s=>s.id===r.storeId);
    return `<div class="event"><span class="event-date">${shortDate(e.date)}</span><span class="store-name">${esc(s.name)}</span><div class="rounds">${[1,2,3].map(n=>{const x=r.rounds.find(x=>x.round===n);const label=x?(x.intentionalDraw?'ID':({win:'W',loss:'L',draw:'D',bye:'Bye'})[x.result]):'—';return `<span class="round"><small>R${n}</small>${label}</span>`;}).join('')}</div><span class="event-points">${r.points} pts</span><span class="record">${esc(r.eventRecord)}</span></div>`;
  }).join('')}</div></td></tr>`;
}
function render(){
  if(!data)return;
  const players=data.standings.filter(p=>p.name.toLowerCase().includes(query.toLowerCase()));
  page=Math.min(page,Math.max(0,Math.ceil(players.length/pageSize)-1));
  $('head').innerHTML=`<tr><th class="rank" scope="col">Rank</th><th scope="col">Player</th><th class="number" scope="col">Events</th><th class="number" scope="col">Points</th></tr>`;
  const columns=4;
  $('rows').innerHTML=players.slice(page*pageSize,(page+1)*pageSize).map(p=>{
    const open=expanded===p.playerId;
    return `<tr data-player="${p.playerId}" class="player-row ${open?'selected':''}"><td class="rank">${p.rank}</td><td class="player"><button class="name" data-player="${p.playerId}" aria-expanded="${open}" ${open?`aria-controls="detail-${p.playerId}"`:''}><span class="chevron" aria-hidden="true">${open?'▾':'▸'}</span>${esc(p.name)}</button>${trophyHTML(p.playerId)}</td><td class="number">${p.eventsPlayed}</td><td class="number total">${p.points}</td></tr>${open?detailHTML(p,columns):''}`;
  }).join('')||`<tr class="empty"><td colspan="${columns}">No players found.</td></tr>`;
  $('count').textContent=players.length?`${page*pageSize+1}–${Math.min((page+1)*pageSize,players.length)} of ${players.length} players`:'0 players';
  $('previous').disabled=page===0;$('next').disabled=(page+1)*pageSize>=players.length;
}
$('rows').addEventListener('click',e=>{const b=e.target.closest('[data-player]');if(!b)return;expanded=expanded===b.dataset.player?null:b.dataset.player;render();saveURL();$('rows').querySelector(`button.name[data-player="${b.dataset.player}"]`).focus({preventScroll:true});});
$('search').addEventListener('input',e=>{query=e.target.value;page=0;render();});
$('previous').addEventListener('click',()=>{page--;render();});$('next').addEventListener('click',()=>{page++;render();});
async function init(){
  saveURL();
  try{
    data=await loadSeason();
    $('dates').textContent=`${shortDate(data.season.startDate)} – ${shortDate(data.season.endDate)}, ${data.season.startDate.slice(0,4)}`;
    const position=data.standings.findIndex(p=>p.playerId===expanded);
    if(position>=0)page=Math.floor(position/pageSize);
    render();
  }catch(e){
    $('status').hidden=false;
    $('status').className='error';
    $('status').textContent=`${e.message} Reload the page to try again.`;
  }
}
init();
