const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const canvas = $('#poster'), ctx = canvas.getContext('2d');
const STORAGE = 'sawyer-top8-draft-v1';
const font = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const images = new Map();
let exampleCards, state, currentPlayer = 0, renderQueued = false, searchVersion = 0, savingTimer, ready = false;
const COLORS = { W: '#d6cba8', U: '#7299b6', B: '#8e819b', R: '#bb7766', G: '#7d9f82' };
const CUT_RANKS = ['1','2','3','3','5','5','5','5'];
const eventFields = ['title','format','date','venue','attendance','heading','footer','layout','ratio','theme','treatment'];
const sampleNames = ['Alex Rivera','Sam Chen','Jordan Lee','Morgan Reed','Taylor Quinn','Jamie Park','Casey Brooks','Riley Stone'];
const sampleDecks = ['Mono-blue Terror','Mono-red Burn','Affinity','Boros Synthesizer','Elves','Orzhov Blade','Dimir Faeries','Jeskai Ephemerate'];
function freshState() {
  return { title:'Friday Night Magic', format:'Pauper', date:'2026-11-13', venue:'Your local game store', attendance:'32', heading:'Top 8', footer:'', layout:'podium', ratio:'wide', theme:'midnight', treatment:'framed', edited:false,
    players: exampleCards.map((card,i) => ({name:sampleNames[i], deck:sampleDecks[i], rank:CUT_RANKS[i], handle:'', record:'', crop:50, card})) };
}
function validState(s) {
  return s && eventFields.every(k=>typeof s[k]==='string'&&s[k].length<=200) &&
    ['podium','grid'].includes(s.layout)&&['wide','square'].includes(s.ratio)&&['midnight','paper'].includes(s.theme)&&['framed','old','full'].includes(s.treatment)&&
    Array.isArray(s.players)&&s.players.length===8&&s.players.every(p=>['name','deck','rank','handle','record'].every(k=>typeof p[k]==='string'&&p[k].length<=100)&&Number.isFinite(p.crop)&&p.crop>=0&&p.crop<=100&&p.card&&typeof p.card.name==='string'&&typeof p.card.artist==='string'&&Array.isArray(p.card.colors)&&validArt(p.card.art));
}
function validArt(url) { return typeof url==='string' && (/^assets\/card-[0-7]\.jpg$/.test(url)||/^https:\/\/cards\.scryfall\.io\//.test(url)); }
function save() {
  state.edited = true;
  clearTimeout(savingTimer);
  savingTimer = setTimeout(()=>{
    try { localStorage.setItem(STORAGE,JSON.stringify(state)); $('#save-status').textContent='Saved locally'; }
    catch { $('#save-status').textContent='Not saved · storage unavailable'; }
  },250);
}
function changed() { save(); scheduleRender(); }
function scheduleRender() { if(!renderQueued) { renderQueued=true; requestAnimationFrame(()=>{renderQueued=false; render();}); } }
function getImage(url) {
  if(images.has(url)) return images.get(url);
  const entry={image:new Image(),status:'loading'}; images.set(url,entry);
  entry.image.crossOrigin='anonymous';
  entry.promise = new Promise(resolve=>{
    let timeout=setTimeout(()=>{entry.status='error';resolve(entry);scheduleRender();},15000);
    entry.image.onload=()=>{clearTimeout(timeout);entry.status='ready';resolve(entry);scheduleRender();};
    entry.image.onerror=()=>{clearTimeout(timeout);entry.status='error';resolve(entry);scheduleRender();};
  });
  entry.image.src=url;
  return entry;
}
function fill(color) { ctx.fillStyle=color; }
function box(x,y,w,h,r,color,stroke) { ctx.beginPath(); ctx.roundRect(x,y,w,h,r); if(color){fill(color);ctx.fill();} if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();} }
function text(str,x,y,size,color,maxWidth,weight=500,align='left',family=font) {
  str=String(str||'');ctx.textAlign=align;ctx.textBaseline='alphabetic';fill(color);
  let n=size;ctx.font=`${weight} ${n}px ${family}`;
  const minimum = size*.65;
  while(maxWidth&&ctx.measureText(str).width>maxWidth&&n>minimum){n--;ctx.font=`${weight} ${n}px ${family}`;}
  if(maxWidth&&ctx.measureText(str).width>maxWidth){while(str.length&&ctx.measureText(str+'…').width>maxWidth)str=str.slice(0,-1);str+='…';}
  ctx.fillText(str,x,y);ctx.textAlign='left';
}
function drawArt(p,x,y,w,h) {
  const e=getImage(p.card.art);
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
  if(e.status==='ready'){
    const im=e.image, scale=Math.max(w/im.naturalWidth,h/im.naturalHeight);
    const dw=im.naturalWidth*scale,dh=im.naturalHeight*scale;
    ctx.drawImage(im,x-(dw-w)/2,y-(dh-h)*p.crop/100,dw,dh);
  }else{
    fill('#26394b');ctx.fillRect(x,y,w,h);
    text(e.status==='error'?'Art unavailable':'Loading art…',x+w/2,y+h/2,20,'#c0ccda',w-24,500,'center');
  }
  ctx.restore();
}
function frameColor(card) { return card.colors.length>1?'#b39a66':COLORS[card.colors[0]]||'#9ba5b0'; }
function oldFramePath(card) {
  const key=card.colors.length>1?'m':({W:'w',U:'u',B:'b',R:'r',G:'g'}[card.colors[0]]||'a');
  return `assets/old-border/${key}.webp`;
}
function drawOldCard(p,x,y,w,h,hero,frame) {
  // Preserve the original frame's title, art bevel, parchment box, and footer.
  // Stretch each vertical section independently to fit the poster's card slots.
  const topH=hero?64:49, dividerH=14, infoH=hero?112:88, footerH=32;
  const artH=h-topH-dividerH-infoH-footerH;
  const artY=y+topH, infoY=artY+artH+dividerH;
  const sourceCuts=[0,208,1138,1257,1868,2100];
  const targetCuts=[y,artY,artY+artH,infoY,infoY+infoH,y+h];
  ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,14);ctx.clip();
  fill('#10191f');ctx.fillRect(x,y,w,h);
  drawArt(p,x+w*.117,artY-1,w*.774,artH+2);
  for(let i=0;i<5;i++){
    ctx.drawImage(frame,0,sourceCuts[i],1500,sourceCuts[i+1]-sourceCuts[i],x,targetCuts[i],w,targetCuts[i+1]-targetCuts[i]);
  }
  const pale=p.card.colors.length>1||p.card.colors[0]==='W';
  const titleColor=pale?'#211d17':'#fff9ee';
  ctx.shadowColor=pale?'#ffffff80':'#000000';ctx.shadowBlur=2;ctx.shadowOffsetX=1;ctx.shadowOffsetY=1;
  text(p.deck||'Deck name',x+w*.112,y+topH*.81,hero?29:23,titleColor,w*.64,700,'left','Georgia, "Times New Roman", serif');
  text(p.rank,x+w*.885,y+topH*.81,hero?30:25,titleColor,w*.1,700,'right','Georgia, "Times New Roman", serif');
  ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
  const tx=x+w*.13, tw=w*.74, hasDetail=Boolean(p.handle||p.record);
  if(hero){
    text(p.name||'Player name',tx,infoY+(hasDetail?52:70),39,'#182231',tw,700,'left','Georgia, "Times New Roman", serif');
    text([p.handle,p.record].filter(Boolean).join(' · '),tx,infoY+86,21,'#35434a',tw,500);
  }else{
    text(p.name||'Player name',tx,infoY+(hasDetail?37:54),w<345?23:27,'#182231',tw,700,'left','Georgia, "Times New Roman", serif');
    if(hasDetail)text([p.handle,p.record].filter(Boolean).join(' · '),tx,infoY+65,w<345?16:19,'#35434a',tw,500);
  }
  ctx.shadowColor='#000';ctx.shadowBlur=2;ctx.shadowOffsetY=1;
  text(`Art: ${p.card.artist}`,x+w*.5,infoY+infoH+16,w<345?10:11,'#fff9ee',w*.79,500,'center');
  ctx.restore();
}
function drawCard(p,x,y,w,h,hero=false) {
  if(state.treatment==='old'){
    const frame=getImage(oldFramePath(p.card));
    if(frame.status==='ready'){drawOldCard(p,x,y,w,h,hero,frame.image);return;}
  }
  const color=frameColor(p.card), framed=state.treatment!=='full';
  const small=w<345, sz=small?24:29, pad=framed?12:0;
  box(x,y,w,h,18,'#10191f');
  if(framed){
    box(x+5,y+5,w-10,h-10,14,color);
    box(x+11,y+11,w-22,h-22,10,'#111b22');
  }
  const ax=x+pad, ay=y+pad, aw=w-pad*2;
  ctx.save();ctx.beginPath();ctx.roundRect(ax,ay,aw,h-pad*2,framed?8:16);ctx.clip();
  const titleH=framed?45:0, creditH=21;
  const infoH=hero?(!framed&&(p.handle||p.record)?147:116):(framed||!p.handle?92:116);
  const artY=ay+titleH, artH=h-pad*2-titleH-infoH-creditH;
  drawArt(p,ax,artY,aw,artH);
  if(framed){
    fill(color);ctx.fillRect(ax,ay,aw,titleH);
    text(p.deck||'Deck name',ax+14,ay+30,small?22:26,'#15222a',aw-68,700);
    text(p.rank,ax+aw-14,ay+32,29,'#15222a',42,800,'right');
  }else{
    box(ax+13,ay+13,hero?70:49,hero?70:49,6,'#15222aeb');
    text(p.rank,ax+(hero?48:37.5),ay+(hero?65:50),hero?49:32,'#fff',hero?58:40,800,'center');
  }
  const infoY=artY+artH;
  fill(framed?'#f0ecdf':'#162330');ctx.fillRect(ax,infoY,aw,infoH);
  const ink=framed?'#182231':'#f4f1e9', muted=framed?'#5c665f':'#b7c6d4';
  fill(color);ctx.fillRect(ax,infoY,aw,3);
  if(hero){
    const details=[p.handle,p.record].filter(Boolean).join(' · ');
    text(p.name||'Player name',ax+20,infoY+(framed&&!details?72:56),42,ink,aw-40,750);
    text(framed?details:(p.deck||'Deck name'),ax+20,infoY+90,24,muted,aw-40,500);
    if(!framed&&details)text(details,ax+20,infoY+122,21,muted,aw-40,500);
  }else{
    text(p.name||'Player name',ax+14,infoY+(framed&&!p.handle&&!p.record?57:38),sz,ink,aw-28,750);
    const detail=framed?p.handle:(p.deck||'Deck name');
    text(detail,ax+14,infoY+68,small?18:21,muted,aw-28-(p.record?60:0),500);
    if(p.record)text(p.record,ax+aw-14,infoY+68,17,muted,58,600,'right');
    if(!framed&&p.handle)text(p.handle,ax+14,infoY+96,small?17:19,muted,aw-28,500);
  }
  fill('#111b22');ctx.fillRect(ax,y+h-pad-creditH,aw,creditH);
  text(`Art: ${p.card.artist}`,ax+9,y+h-pad-6,small?11:12,'#b6c2cb',aw-18,450);
  ctx.restore();
}
function metadata() {
  let date='';
  if(/^\d{4}-\d{2}-\d{2}$/.test(state.date)){
    const d=new Date(`${state.date}T12:00:00`);
    if(!Number.isNaN(+d)) date=d.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  }
  return [state.format.trim(),date,state.venue,state.attendance?`${state.attendance} players`:''].filter(Boolean).join('  ·  ');
}
function render() {
  if(!state)return;
  const square=state.ratio==='square';
  const W=square?1600:1920,H=square?1600:1080;
  if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H;}
  canvas.classList.toggle('square',square);
  const dark=state.theme==='midnight', bg=dark?'#162330':'#f2f0e9', fg=dark?'#f7f4ed':'#182231', muted=dark?'#a9b9c8':'#65717b', rule=dark?'#415263':'#c5c9c7';
  fill(bg);ctx.fillRect(0,0,W,H);
  const margin=64, contentW=W-2*margin;
  text(state.title||'Event name',margin,108,57,fg,contentW-290,750);
  text(metadata(),margin,154,24,muted,contentW-40,450);
  text(state.heading||'Top 8',W-margin,104,66,fg,275,800,'right');
  fill(rule);ctx.fillRect(margin,182,contentW,2);
  const top=216,bottom=H-138, height=bottom-top, gap=square?21:22;
  if(state.layout==='podium'&&!square){
    const heroW=440,rightX=margin+heroW+gap,rightW=contentW-heroW-gap;
    drawCard(state.players[0],margin,top,heroW,height,true);
    const rowH=(height-gap)/2, topW=(rightW-gap*2)/3, bottomW=(rightW-gap*3)/4;
    for(let i=1;i<4;i++)drawCard(state.players[i],rightX+(i-1)*(topW+gap),top,topW,rowH);
    for(let i=4;i<8;i++)drawCard(state.players[i],rightX+(i-4)*(bottomW+gap),top+rowH+gap,bottomW,rowH);
  }else if(state.layout==='podium'&&square){
    const w=(contentW-gap*3)/4,h=(height-gap*2)/3;
    drawCard(state.players[0],margin,top,w*2+gap,h*2+gap,true);
    drawCard(state.players[1],margin+2*(w+gap),top,w,h);
    drawCard(state.players[2],margin+3*(w+gap),top,w,h);
    drawCard(state.players[3],margin+2*(w+gap),top+h+gap,w*2+gap,h);
    for(let i=4;i<8;i++)drawCard(state.players[i],margin+(i-4)*(w+gap),top+2*(h+gap),w,h);
  }else{
    const w=(contentW-gap*3)/4,h=(height-gap)/2;
    state.players.forEach((p,i)=>drawCard(p,margin+(i%4)*(w+gap),top+Math.floor(i/4)*(h+gap),w,h));
  }
  fill(rule);ctx.fillRect(margin,H-102,contentW,2);
  text(state.footer,margin,H-58,24,fg,contentW-460,500);
  text('Magic: The Gathering artwork © Wizards of the Coast',W-margin,H-64,15,muted,440,400,'right');
  text(state.treatment==='old'?'Art via Scryfall · Frames via Card Conjurer':'Card data & art via Scryfall',W-margin,H-41,15,muted,440,400,'right');
  const entries=state.players.map(p=>getImage(p.card.art));
  const frames=state.treatment==='old'?state.players.map(p=>getImage(oldFramePath(p.card))):[];
  const loading=[...entries,...frames].some(e=>e.status==='loading'),failed=entries.some(e=>e.status==='error'),frameFailed=frames.some(e=>e.status==='error');
  $('#download').disabled=loading;
  $('#preview-large').disabled=loading;
  $('#dimensions').textContent=`${W} × ${H}`;
  $('#notice').textContent=loading?'Loading artwork and frames…':[failed?'Some artwork could not load. Choose another card or retry with a refresh. The export will include placeholders.':'',frameFailed?'Some old-border frames could not load; standard frames are shown instead. Refresh to retry.':''].filter(Boolean).join(' ');
  ready=!loading;
}
function selectTab(id) {
  $$('.tabs button').forEach(b=>{const selected=b.id===id;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;$('#'+b.getAttribute('aria-controls')).hidden=!selected;});
}
function make(tag,props={},content) {
  const e=document.createElement(tag);Object.assign(e,props);if(content!==undefined)e.textContent=content;return e;
}
function inputField(label,key,value,index,max=70) {
  const l=make('label',{},label),input=make('input',{value,maxLength:max});input.dataset.key=key;input.dataset.player=index;l.append(input);return l;
}
function placingsMode() {
  if(state.players.every((p,i)=>p.rank===CUT_RANKS[i]))return 'cut';
  if(state.players.every((p,i)=>p.rank===String(i+1)))return 'ranked';
  return 'custom';
}
function showPlayers() {
  $('#placings').value=placingsMode();
  $('#players').replaceChildren();
  state.players.forEach((p,i)=>{
    const d=make('details',{className:'player'});d.dataset.index=i;
    const s=make('summary');
    s.append(make('span',{className:'rank-number'},p.rank),make('img',{className:'player-thumb',src:p.card.art,alt:''}));
    const title=make('span',{className:'player-title'});title.append(make('strong',{},p.name||'Player name'),make('small',{},p.deck||'Deck name'));
    s.append(title,make('span',{className:'chevron','ariaHidden':'true'},'›'));d.append(s);
    const fields=make('div',{className:'player-fields'});
    fields.append(inputField('Name','name',p.name,i,70),inputField('Deck','deck',p.deck,i,70));
    const duo=make('div',{className:'two-col'});duo.append(inputField('Place','rank',p.rank,i,3),inputField('Record','record',p.record,i,15));fields.append(duo,inputField('Handle / team','handle',p.handle,i,60));
    const art=make('button',{className:'art-choice',type:'button'});art.append(make('span',{},p.card.name),make('small',{},'Change art'));art.addEventListener('click',()=>openSearch(i));fields.append(art);
    const crop=make('label',{},'Crop · top ↔ bottom'),slider=make('input',{type:'range',min:0,max:100,step:1,value:p.crop});slider.dataset.player=i;slider.dataset.key='crop';crop.append(slider);fields.append(crop);d.append(fields);$('#players').append(d);
  });
  syncCredits();
}
function syncCredits() {
  $('#credit-list').replaceChildren();
  state.players.forEach(p=>{
    const li=make('li');li.value=Number.parseInt(p.rank)||1;
    li.append(make('strong',{},`${p.name||'Player'} · ${p.deck||'Deck'}`),make('br'),document.createTextNode(`${p.card.name} — ${p.card.artist}`));$('#credit-list').append(li);
  });
}
function syncInputs() {
  eventFields.forEach(k=>$('#'+k).value=state[k]);
  $('#save-status').textContent=state.edited?'Saved locally':'Example';
  showPlayers();scheduleRender();
}
function updatePlayerSummary(i) {
  $('#placings').value=placingsMode();
  const p=state.players[i],d=$(`.player[data-index="${i}"]`);
  $('.rank-number',d).textContent=p.rank;
  $('.player-title strong',d).textContent=p.name||'Player name';
  $('.player-title small',d).textContent=p.deck||'Deck name';
  $('.player-thumb',d).src=p.card.art;
  $('.art-choice span',d).textContent=p.card.name;
  syncCredits();
}
async function api(path) {
  const response=await fetch(`https://api.scryfall.com/${path}`,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});
  if(response.status===404)throw new Error('No cards found. Try a different name or Scryfall query.');
  if(response.status===429)throw new Error('Scryfall is busy. Wait a moment before searching again.');
  if(!response.ok)throw new Error('Card search is unavailable. Try again in a moment.');
  return response.json();
}
function normalizeCards(cards) {
  return cards.flatMap(c=>{
    const faces=c.image_uris?[c]:(c.card_faces||[]);
    return faces.filter(f=>f.image_uris?.art_crop).map(f=>({name:f.name,art:f.image_uris.art_crop,artist:f.artist||c.artist||'Unknown artist',colors:f.colors||c.colors||[],set:c.set_name,url:c.scryfall_uri,id:c.id,oracle:c.oracle_id}));
  });
}
function openSearch(i) {
  currentPlayer=i;searchVersion++;
  $('#card-for').textContent=state.players[i].name||`Player ${i+1}`;
  $('#card-query').value='';$('#search-status').textContent='';$('#search-button').disabled=false;
  showResults(exampleCards);$('#card-dialog').showModal();$('#card-query').focus();
}
function showResults(cards,printings=false) {
  $('#card-results').replaceChildren();
  cards.forEach(card=>{
    const item=make('div',{className:'card-result'}),button=make('button',{type:'button'});
    button.setAttribute('aria-label',`Use ${card.name}, ${card.set}`);
    button.append(make('img',{src:card.art,alt:'',loading:'lazy'}),make('strong',{},card.name),make('small',{},card.set));
    button.addEventListener('click',()=>{
      const p=state.players[currentPlayer];p.card=card;p.crop=50;updatePlayerSummary(currentPlayer);
      $(`input[data-player="${currentPlayer}"][data-key="crop"]`).value=50;
      $('#card-dialog').close();changed();
    });item.append(button);
    if(!printings&&card.oracle){const more=make('button',{type:'button',className:'text-button'},'Other printings');more.addEventListener('click',()=>searchCards(`oracleid:${card.oracle}`,true));item.append(more);}
    $('#card-results').append(item);
  });
}
async function searchCards(query,printings=false) {
  const version=++searchVersion;
  $('#search-status').textContent='Searching…';$('#search-button').disabled=true;
  try {
    const data=await api(`cards/search?${new URLSearchParams({q:query,unique:printings?'art':'cards',order:printings?'released':'name',dir:printings?'desc':'auto'})}`);
    if(version!==searchVersion)return;
    const cards=normalizeCards(data.data).slice(0,36);showResults(cards,printings);
    $('#search-status').textContent=cards.length?`${cards.length}${data.total_cards>cards.length?' shown':''} ${printings?'art versions':'results'}`:'No artwork available for these cards.';
  }catch(e){if(version!==searchVersion)return;$('#card-results').replaceChildren();$('#search-status').textContent=e.name==='TimeoutError'?'Search timed out. Please try again.':e.message==='Failed to fetch'?'Could not reach Scryfall. Check your connection and try again.':e.message;}
  finally {if(version===searchVersion)$('#search-button').disabled=false;}
}
async function download() {
  if(!ready)return;
  $('#download').disabled=true;
  try{
    render();
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not create the PNG.')),'image/png'));
    const url=URL.createObjectURL(blob),a=make('a',{href:url,download:`${(state.title||'tournament').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'tournament'}-top-8.png`});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }catch{ $('#notice').textContent='The image could not be exported. Try reloading or changing the selected artwork.'; }
  finally{$('#download').disabled=false;}
}
async function init() {
  try {
    const r=await fetch('assets/cards.json');if(!r.ok)throw new Error('Example cards could not load.');exampleCards=await r.json();state=freshState();
    try{const stored=JSON.parse(localStorage.getItem(STORAGE));if(validState(stored)){state=stored;if(state.footer==='Good games. See you next week.')state.footer='';}}catch{}
    syncInputs();
    eventFields.forEach(k=>$('#'+k).addEventListener('input',e=>{state[k]=e.target.value;changed();}));
    $$('.tabs button').forEach((b,i)=>{
      b.addEventListener('click',()=>selectTab(b.id));
      b.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const tabs=$$('.tabs button');const n=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;selectTab(tabs[n].id);tabs[n].focus();}});
    });
    $('#players').addEventListener('input',e=>{const {player,key}=e.target.dataset;if(player===undefined)return;state.players[player][key]=key==='crop'?Number(e.target.value):e.target.value;updatePlayerSummary(player);changed();});
    $('#placings').addEventListener('change',e=>{
      if(e.target.value==='custom')return;
      const open=$$('.player').map(p=>p.open);
      state.players.forEach((p,i)=>p.rank=e.target.value==='cut'?CUT_RANKS[i]:String(i+1));
      showPlayers();$$('.player').forEach((p,i)=>p.open=open[i]);changed();
    });
    $('#search-form').addEventListener('submit',e=>{e.preventDefault();const q=$('#card-query').value.trim();if(q)searchCards(q);});
    $('#close-card').addEventListener('click',()=>$('#card-dialog').close());
    $('#card-dialog').addEventListener('close',()=>{searchVersion++;});
    $('#show-examples').addEventListener('click',()=>{searchVersion++;$('#search-status').textContent='';$('#search-button').disabled=false;showResults(exampleCards);});
    $('#download').addEventListener('click',download);
    $('#preview-large').addEventListener('click',()=>{if(!ready)return;try{$('#full-image').src=canvas.toDataURL('image/png');$('#full-dialog').showModal();}catch{$('#notice').textContent='Could not open the full preview. Try refreshing.';}});
    $('#close-full').addEventListener('click',()=>$('#full-dialog').close());
    $('#reset').addEventListener('click',()=>$('#reset-dialog').showModal());
    $('#cancel-reset').addEventListener('click',()=>$('#reset-dialog').close());
    $('#confirm-reset').addEventListener('click',()=>{clearTimeout(savingTimer);state=freshState();try{localStorage.removeItem(STORAGE);}catch{}syncInputs();$('#reset-dialog').close();});
    $$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
  }catch(e){$('#notice').textContent=`Could not load the editor. Please refresh. ${e.message}`;}
}
init();
