import {deckImages} from './deck-images.mjs';
import {metagame,rate} from './metagame-stats.mjs?v=parent-1';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=v=>v===null?'—':`${(v*100).toFixed(1)}%`;
const date=v=>new Date(v+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
function deckLabel(name) {
  const art=deckImages[name];
  return `${art?`<img class="deck-art" src="${esc(art.url)}" alt="" loading="lazy" title="${esc(art.card)} · ${esc(art.artist)}">`:''}<span>${esc(name)}</span>`;
}
let data,stats,expanded=null,visible=[],page=0;
function renderDecks(){
  let rows=[...stats.decks];
  if($('sort').value==='winRate')rows.sort((a,b)=>(b.winRate??-1)-(a.winRate??-1)||b.matches.length-a.matches.length);
  if($('sort').value==='name')rows.sort((a,b)=>a.name.localeCompare(b.name));
  page=Math.min(page,Math.max(0,Math.ceil(rows.length/16)-1));
  $('page-count').textContent=rows.length?`${page*16+1}–${Math.min((page+1)*16,rows.length)} of ${rows.length} archetypes`:'0 archetypes';
  $('previous').disabled=page===0;$('next').disabled=(page+1)*16>=rows.length;
  $('archetypes').innerHTML=rows.slice(page*16,(page+1)*16).map(d=>{const i=stats.decks.indexOf(d);return `<tr class="deck-row" data-deck="${i}"><td><button class="deck-toggle" aria-expanded="${expanded===i}">${deckLabel(d.name)}</button></td><td>${d.entries.length}</td><td><span class="share-bar" style="--share:${d.share*180}px"></span>${pct(d.share)}</td><td>${d.players.size}</td><td>${d.wins}–${d.losses}–${d.draws}</td><td>${pct(d.winRate)}</td></tr>${expanded===i?`<tr class="expanded"><td colspan="6"><div class="scroll"><table><tbody>${[...d.entries].sort((a,b)=>a.date.localeCompare(b.date)||a.player.localeCompare(b.player)).map(e=>`<tr><td>${date(e.date)}</td><td>${esc(data.stores[e.storeId])}</td><td><a href="./player.html?player=${encodeURIComponent(e.player)}">${esc(e.player)}</a></td><td>${esc(e.deck)}</td></tr>`).join('')}</tbody></table></div></td></tr>`:''}`;}).join('')||'<tr><td colspan="6" class="empty">No recorded decks in this range.</td></tr>';
}
function renderMatrix(){
  visible=$('limit').value==='all'?stats.decks:stats.decks.slice(0,Number($('limit').value));
  $('matrix').innerHTML=`<thead><tr><th>Deck / opponent</th><th>Overall WR</th>${visible.map(d=>`<th scope="col">${deckLabel(d.name)}</th>`).join('')}</tr></thead><tbody>${visible.map((d,i)=>`<tr><th scope="row"><span class="deck-label">${deckLabel(d.name)}</span></th><td class="overall"><strong>${pct(d.winRate)}</strong><small>${d.matches.length} matches</small></td>${visible.map((o,j)=>{const cell=stats.matrix.get(d.name)?.get(o.name);if(i===j||!cell)return `<td class="missing" title="${i===j?'Mirror matchup':'No recorded matches'}">—</td>`;const r=rate(cell),n=cell.matches.length;const color=r>.5?'#e1f0e8':r<.5?'#f7e7e6':'#eef2f6';return `<td><button data-row="${i}" data-col="${j}" style="--cell:${color}" aria-label="${esc(d.name)} versus ${esc(o.name)}: ${pct(r)}, ${n} matches">${pct(r)}<small>${n} ${n===1?'match':'matches'}</small></button></td>`;}).join('')}</tr>`).join('')}</tbody>`;
  $('matchup').hidden=true;
}
function render(){
  const options={store:$('store').value,from:$('from').value,to:$('to').value,fnm:$('kind').value==='fnm'};
  stats=metagame(data,options);expanded=null;page=0;
  const url=new URL(location.href);for(const [key,value] of Object.entries(options))value&&value!=='all'?url.searchParams.set(key,String(value)):url.searchParams.delete(key);history.replaceState(null,'',url);
  $('date-error').hidden=!(options.from&&options.to&&options.from>options.to);
  renderDecks();renderMatrix();
}
$('previous').addEventListener('click',()=>{page--;renderDecks();});$('next').addEventListener('click',()=>{page++;renderDecks();});
$('archetypes').addEventListener('click',e=>{const row=e.target.closest('[data-deck]');if(!row)return;const i=Number(row.dataset.deck);expanded=expanded===i?null:i;renderDecks();$('archetypes').querySelector(`[data-deck="${i}"] button`).focus({preventScroll:true});});
$('matrix').addEventListener('click',e=>{const b=e.target.closest('[data-row]');if(!b)return;const a=visible[Number(b.dataset.row)].name,o=visible[Number(b.dataset.col)].name,cell=stats.matrix.get(a).get(o);$('matchup').hidden=false;$('matchup').innerHTML=`<h3>${esc(a)} vs ${esc(o)} · ${cell.wins}–${cell.losses}–${cell.draws}</h3><div class="scroll"><table><tbody>${cell.matches.map(m=>`<tr><td>${date(m.eventDate)}</td><td>${esc(data.stores[m.storeId])}</td><td>R${m.round}</td><td><a href="./player.html?player=${encodeURIComponent(m.player)}">${esc(m.player)}</a></td><td><a href="./player.html?player=${encodeURIComponent(m.opponent)}">${esc(m.opponent)}</a></td><td>${esc(m.result)}</td></tr>`).join('')}</tbody></table></div>`;});
$('filters').addEventListener('change',render);$('filters').addEventListener('submit',e=>e.preventDefault());$('filters').addEventListener('reset',()=>setTimeout(render,0));$('sort').addEventListener('change',()=>{page=0;renderDecks();});$('limit').addEventListener('change',renderMatrix);
try{
 const response=await fetch('../combined-elo/data.json',{cache:'no-store'});if(!response.ok)throw Error('Could not load metagame data.');data=await response.json();
 $('store').innerHTML+=Object.entries(data.stores).map(([id,name])=>`<option value="${id}">${esc(name)}</option>`).join('');
 const p=new URL(location.href).searchParams;const store=p.get('store');$('store').value=data.stores[store]?store:'all';$('from').value=p.get('from')||'';$('to').value=p.get('to')||'';$('kind').value=p.get('fnm')==='true'?'fnm':'all';render();
}catch(e){$('error').hidden=false;$('error').textContent=e.message;}
