const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const canvas = $('#poster'), ctx = canvas.getContext('2d');
const STORAGE = 'sawyer-top8-draft-v1';
const font = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const images = new Map();
let exampleCards, state, currentPlayer = 0, renderQueued = false, searchVersion = 0, savingTimer, ready = false;
const COLORS = { W: '#d6cba8', U: '#7299b6', B: '#8e819b', R: '#bb7766', G: '#7d9f82' };
const CUT_RANKS = ['1','2','3','3','5','5','5','5'];
const eventFields = ['title','format','date','venue','attendance','heading','footer','layout','ratio','theme','treatment','credits'];
const sampleNames = ['Alex Rivera','Sam Chen','Jordan Lee','Morgan Reed','Taylor Quinn','Jamie Park','Casey Brooks','Riley Stone'];
const sampleDecks = ['Mono-blue Terror','Mono-red Burn','Affinity','Boros Synthesizer','Elves','Orzhov Blade','Dimir Faeries','Jeskai Ephemerate'];
function freshState() {
  return { title:'Friday Night Magic', format:'Pauper', date:'2026-11-13', venue:'Your local game store', attendance:'32', heading:'Top 8', footer:'', layout:'podium', ratio:'wide', theme:'paper', treatment:'smash', credits:'footer', creditsVersion:1, edited:false,
    players: exampleCards.map((card,i) => ({name:sampleNames[i], deck:sampleDecks[i], rank:CUT_RANKS[i], handle:'', record:'', crop:50, card})) };
}
function validState(s) {
  return s && eventFields.every(k=>typeof s[k]==='string'&&s[k].length<=200) &&
    ['podium','grid'].includes(s.layout)&&['wide','square'].includes(s.ratio)&&['midnight','paper'].includes(s.theme)&&['framed','old','full','smash'].includes(s.treatment)&&['cards','footer'].includes(s.credits)&&
    Array.isArray(s.players)&&s.players.length===8&&s.players.every(p=>['name','deck','rank','handle','record'].every(k=>typeof p[k]==='string'&&p[k].length<=100)&&Number.isFinite(p.crop)&&p.crop>=0&&p.crop<=100&&p.card&&typeof p.card.name==='string'&&typeof p.card.artist==='string'&&Array.isArray(p.card.colors)&&validArt(p.card.art));
}
function validArt(url) { return typeof url==='string' && (/^assets\/card-[0-7]\.jpg$/.test(url)||/^https:\/\/cards\.scryfall\.io\//.test(url)); }
function save() {
  state.edited = true;
  clearTimeout(savingTimer);
  savingTimer = setTimeout(()=>{
    try { localStorage.setItem(STORAGE,JSON.stringify(state)); } catch {}
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
  const topH=hero?64:49, dividerH=14, infoH=hero?112:88, footerH=state.credits==='cards'?32:15;
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
  if(state.credits==='cards'){
    ctx.shadowColor='#000';ctx.shadowBlur=2;ctx.shadowOffsetY=1;
    text(`Art: ${p.card.artist}`,x+w*.5,infoY+infoH+16,w<345?10:11,'#fff9ee',w*.79,500,'center');
  }
  ctx.restore();
}
function drawSmashCard(p,x,y,w,h,hero=false) {
  const accent='#d72829', creditH=state.credits==='cards'?20:0;
  const details=[p.handle,p.record].filter(Boolean).join(' · ');
  const bandH=hero?(details?146:116):(details?99:76);
  const slant=hero?34:25, bottom=y+h-creditH;
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
  drawArt(p,x,y,w,h);
  const shade=ctx.createLinearGradient(x,y+h*.4,x,bottom);
  shade.addColorStop(0,'#00000000');shade.addColorStop(1,'#000000d9');
  fill(shade);ctx.fillRect(x,y,w,h);
  // The diagonal nameplate and oversized placements echo tournament Top 8 posters.
  ctx.beginPath();ctx.moveTo(x,bottom-bandH+slant);ctx.lineTo(x+w,bottom-bandH);
  ctx.lineTo(x+w,bottom);ctx.lineTo(x,bottom);ctx.closePath();fill(accent);ctx.fill();
  ctx.shadowColor='#000';ctx.shadowBlur=4;ctx.shadowOffsetX=2;ctx.shadowOffsetY=3;
  text(p.rank,x+16,y+(hero?128:82),hero?122:78,'#fff',w*.42,'italic 900');
  const nameY=bottom-(hero?(details?111:83):(details?72:48));
  text(p.name||'Player name',x+w/2,nameY,hero?48:w<345?31:36,'#fff',w-30,900,'center');
  ctx.shadowBlur=2;ctx.shadowOffsetX=1;ctx.shadowOffsetY=1;
  text(p.deck||'Deck name',x+w/2,nameY+(hero?35:25),hero?26:21,'#fff',w-32,650,'center');
  if(details)text(details,x+w/2,nameY+(hero?66:48),hero?22:17,'#fff',w-32,550,'center');
  ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
  if(creditH){
    fill('#111114');ctx.fillRect(x,bottom,w,creditH);
    text(`Art: ${p.card.artist}`,x+w/2,y+h-6,11,'#c4c4ca',w-20,450,'center');
  }
  ctx.strokeStyle=accent;ctx.lineWidth=4;ctx.strokeRect(x+2,y+2,w-4,h-4);
  ctx.restore();
}
// Planeswalker vector from Mana by Andrew Gioia; provenance in assets/planeswalker-SOURCE.md.
const planeswalkerMark = new Path2D('M15.996 0c0.041 0.076 0.047 0.163 0.063 0.246 0.066 0.441 0.091 0.886 0.125 1.33 0.076 1.183 0.137 2.367 0.211 3.55 0.125 1.934 0.268 3.87 0.548 5.79 0.137 0.906 0.3 1.812 0.577 2.686 0.367 0.027 0.734 0.054 1.1 0.094 0.181-0.535 0.27-1.095 0.363-1.651 0.083-0.519 0.153-1.041 0.217-1.563 0.249-2.039 0.423-4.086 0.611-6.131 0.043-0.421 0.071-0.845 0.14-1.263 0.035 0.090 0.043 0.188 0.058 0.283 0.041 0.286 0.071 0.574 0.102 0.861 0.197 1.912 0.37 3.827 0.616 5.734 0.113 0.875 0.238 1.749 0.405 2.616 0.112 0.566 0.232 1.134 0.434 1.677 0.34 0.104 0.678 0.218 1.005 0.358 0.103-0.235 0.18-0.48 0.252-0.726 0.183-0.638 0.31-1.291 0.42-1.944 0.239-1.41 0.379-2.834 0.566-4.252 0.049-0.323 0.082-0.652 0.184-0.964 0.050 0.134 0.065 0.277 0.088 0.417 0.090 0.64 0.152 1.284 0.216 1.927 0.065 0.699 0.135 1.397 0.187 2.096 0.002-0.008 0.006-0.024 0.008-0.032-0.001 0.098 0.009 0.196 0.019 0.294 0.143 1.685 0.281 3.371 0.406 5.058-0.959 0.363-1.866 0.861-2.695 1.463-1.11 0.806-2.075 1.803-2.876 2.916-0.835 1.16-1.495 2.443-1.969 3.791-0.596 1.696-0.933 3.474-1.114 5.26-0.059 0.548-0.095 1.099-0.151 1.647-0.020 0.146-0.024 0.301-0.094 0.434h-0.035c-0.065-0.099-0.069-0.22-0.087-0.333-0.043-0.364-0.067-0.73-0.1-1.094-0.084-0.983-0.204-1.965-0.388-2.935-0.302-1.587-0.757-3.154-1.468-4.608-0.813-1.668-1.933-3.197-3.336-4.417-1.040-0.905-2.235-1.635-3.525-2.124 0.178-2.348 0.366-4.695 0.585-7.040 0.074-0.762 0.145-1.524 0.249-2.282 0.022-0.138 0.039-0.278 0.080-0.412 0.005 0.001 0.016 0.003 0.022 0.004 0.085 0.274 0.118 0.561 0.161 0.844 0.149 1.096 0.261 2.197 0.417 3.293 0.125 0.878 0.265 1.755 0.48 2.616 0.096 0.374 0.201 0.749 0.354 1.105 0.327-0.141 0.666-0.253 1.006-0.359 0.127-0.338 0.218-0.688 0.3-1.039 0.124-0.545 0.222-1.095 0.31-1.647 0.356-2.277 0.564-4.574 0.796-6.867 0.042-0.412 0.083-0.825 0.137-1.236 0.020-0.13 0.031-0.263 0.073-0.389 0.046 0.287 0.071 0.577 0.1 0.866 0.183 1.947 0.345 3.896 0.567 5.839 0.107 0.923 0.221 1.847 0.385 2.762 0.074 0.386 0.147 0.775 0.279 1.147 0.366-0.033 0.732-0.066 1.099-0.091 0.274-0.862 0.435-1.755 0.572-2.648 0.149-1 0.256-2.005 0.345-3.012 0.152-1.717 0.248-3.437 0.346-5.157 0.048-0.762 0.084-1.525 0.165-2.284 0.021-0.169 0.039-0.34 0.089-0.503z');
function drawSmashBackground(W,H,dark) {
  const size=H*1.2;
  ctx.save();
  ctx.translate(W*.7-size/2,H*.52-size/2);
  ctx.scale(size/32,size/32);
  fill(dark?'#19191f':'#e3e1db');ctx.fill(planeswalkerMark);
  ctx.restore();
}
function drawCard(p,x,y,w,h,hero=false) {
  if(state.treatment==='smash'){drawSmashCard(p,x,y,w,h,hero);return;}
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
  const titleH=framed?45:0, creditH=state.credits==='cards'?21:0;
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
  if(creditH){
    fill('#111b22');ctx.fillRect(ax,y+h-pad-creditH,aw,creditH);
    text(`Art: ${p.card.artist}`,ax+9,y+h-pad-6,small?11:12,'#b6c2cb',aw-18,450);
  }
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
function artCreditLines(width) {
  const artists=[...new Set(state.players.map(p=>p.card.artist.trim()).filter(Boolean))];
  ctx.font=`400 15px ${font}`;
  const lines=[];let line='Art:';
  for(const artist of artists){
    const next=`${line}${line==='Art:'?' ':' · '}${artist}`;
    if(line!=='Art:'&&ctx.measureText(next).width>width){lines.push(line);line=artist;}
    else line=next;
  }
  if(artists.length)lines.push(line);
  return lines;
}
function render() {
  if(!state)return;
  const square=state.ratio==='square';
  const W=square?1600:1920,H=square?1600:1080;
  if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H;}
  canvas.classList.toggle('square',square);
  const smash=state.treatment==='smash',dark=state.theme==='midnight';
  const bg=dark?(smash?'#0b0b0e':'#162330'):'#f2f0e9',fg=dark?'#f7f4ed':'#182231';
  const muted=dark?(smash?'#b6b6bf':'#a9b9c8'):'#65717b',rule=dark?(smash?'#42424a':'#415263'):'#c5c9c7';
  fill(bg);ctx.fillRect(0,0,W,H);
  if(smash)drawSmashBackground(W,H,dark);
  const margin=64, contentW=W-2*margin;
  text(state.title||'Event name',margin,108,57,fg,contentW-290,smash?'italic 900':750);
  text(metadata(),margin,154,24,muted,contentW-40,450);
  text(state.heading,W-margin,104,66,fg,275,smash?'italic 900':800,'right');
  fill(rule);ctx.fillRect(margin,182,contentW,2);
  const creditWidth=520;
  const creditLines=[
    'Magic: The Gathering artwork © Wizards of the Coast',
    ...(state.credits==='footer'?artCreditLines(creditWidth):[]),
    state.treatment==='old'?'Art via Scryfall · Frames via Card Conjurer':'Card data & art via Scryfall'
  ];
  const creditTop=H-41-(creditLines.length-1)*20;
  const footerY=Math.min(H-102,creditTop-30);
  const top=216,bottom=footerY-36, height=bottom-top, gap=square?21:22;
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
  fill(rule);ctx.fillRect(margin,footerY,contentW,2);
  text(state.footer,margin,H-58,24,fg,contentW-creditWidth-32,500);
  creditLines.forEach((line,i)=>text(line,W-margin,creditTop+i*20,15,muted,undefined,400,'right'));
  const entries=state.players.map(p=>getImage(p.card.art));
  const frames=state.treatment==='old'?state.players.map(p=>getImage(oldFramePath(p.card))):[];
  const loading=[...entries,...frames].some(e=>e.status==='loading'),failed=entries.some(e=>e.status==='error'),frameFailed=frames.some(e=>e.status==='error');
  $('#download').disabled=loading;
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
function showPlayers() {
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
  showPlayers();scheduleRender();
}
function updatePlayerSummary(i) {
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
    try{const stored=JSON.parse(localStorage.getItem(STORAGE));if(stored&&stored.creditsVersion!==1){stored.credits='footer';stored.creditsVersion=1;}if(validState(stored)){state=stored;if(state.footer==='Good games. See you next week.')state.footer='';}}catch{}
    syncInputs();
    eventFields.forEach(k=>$('#'+k).addEventListener('input',e=>{state[k]=e.target.value;changed();}));
    $$('.tabs button').forEach((b,i)=>{
      b.addEventListener('click',()=>selectTab(b.id));
      b.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const tabs=$$('.tabs button');const n=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;selectTab(tabs[n].id);tabs[n].focus();}});
    });
    $('#players').addEventListener('input',e=>{const {player,key}=e.target.dataset;if(player===undefined)return;state.players[player][key]=key==='crop'?Number(e.target.value):e.target.value;updatePlayerSummary(player);changed();});
    $('#search-form').addEventListener('submit',e=>{e.preventDefault();const q=$('#card-query').value.trim();if(q)searchCards(q);});
    $('#close-card').addEventListener('click',()=>$('#card-dialog').close());
    $('#card-dialog').addEventListener('close',()=>{searchVersion++;});
    $('#show-examples').addEventListener('click',()=>{searchVersion++;$('#search-status').textContent='';$('#search-button').disabled=false;showResults(exampleCards);});
    $('#download').addEventListener('click',download);
    $$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
  }catch(e){$('#notice').textContent=`Could not load the editor. Please refresh. ${e.message}`;}
}
init();
