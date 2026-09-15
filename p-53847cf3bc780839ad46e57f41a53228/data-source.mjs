export const PUBLIC_SHEET='111CAIRE3rBO09LT3w2a543IUUP35iEt4GI5LcjLqd5M';
export const FEED_GID=966065342;
const ARRAY_SECTIONS=['timeline','players','history','results'];
const SCALAR_SECTIONS=['meta','through','snapshotDate'];
const CACHE_KEY='piedmont-public-data-v1';

export function validateData(data){
  if(!data||!/^\d{4}-\d{2}-\d{2}$/.test(data.through)||!data.meta)throw Error('Invalid stats metadata');
  for(const key of ARRAY_SECTIONS)if(!Array.isArray(data[key])||!data[key].length)throw Error(`Missing ${key}`);
  if(data.players.length!==data.meta.players||data.history.length!==data.meta.matches*2)throw Error('Incomplete stats');
  const names=new Set();
  for(const p of data.players){
    if(typeof p.player!=='string'||!p.player.trim()||names.has(p.player))throw Error('Invalid or duplicate player');
    names.add(p.player);
    if(!Number.isFinite(p.elo)||!Number.isFinite(p.changeLastEvent)||!Number.isFinite(p.peakElo)||!Array.isArray(p.points)||p.points.length!==data.timeline.length||p.points.some(n=>n!==null&&!Number.isFinite(n)))throw Error('Invalid ratings');
    for(const k of ['rank','matches','wins','losses','draws','fnmEvents'])if(!Number.isInteger(p[k])||p[k]<0)throw Error('Invalid counts');
    if(!Array.isArray(p.trophies)||p.trophies.length>p.fnmEvents)throw Error('Invalid trophies');
  }
  for(const t of data.timeline)if(typeof t.eventTitle!=='string'||typeof t.eventId!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(t.eventDate)||!Number.isInteger(t.round))throw Error('Invalid timeline');
  for(const h of data.history)if(typeof h.player!=='string'||typeof h.opponent!=='string'||!Number.isFinite(h.ratingChange)||!Number.isFinite(h.ratingAfter)||!Number.isInteger(h.round))throw Error('Invalid match');
  const results=new Set();
  for(const r of data.results){
    const key=JSON.stringify([r.eventId,r.player]);
    if(results.has(key)||!names.has(r.player)||['wins','losses','draws'].some(k=>!Number.isInteger(r[k])||r[k]<0)||r.trophy!==(r.wins>=3&&r.losses===0&&r.draws===0))throw Error('Invalid event result');
    results.add(key);
  }
  if(new Set(data.timeline.map(t=>t.eventId)).size!==data.meta.events)throw Error('Event count mismatch');
  return data;
}

export async function parseFeed(text){
  // Parse Google's fixed response wrapper as data. Never evaluate remote code.
  const match=text.match(/^\/\*O_o\*\/\s*google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/);
  if(!match)throw Error('Unexpected Google Sheets response');
  const response=JSON.parse(match[1]);
  if(response.status!=='ok'||!Array.isArray(response.table?.rows))throw Error('Google Sheets feed unavailable');
  const data={},seen=new Set();let manifest,end;
  for(const row of response.table.rows){
    const [section,position,json]=row.c.map(cell=>cell?.v);
    if(section==null&&json==null)continue;
    const key=JSON.stringify([section,position]);
    if(seen.has(key)||typeof json!=='string'||!Number.isInteger(position)||position<0)throw Error('Invalid feed row');
    seen.add(key);
    const value=JSON.parse(json);
    if(section==='manifest'){if(position!==0||manifest)throw Error('Duplicate manifest');manifest=value;}
    else if(section==='end'){if(position!==0||end)throw Error('Duplicate footer');end=value;}
    else if(ARRAY_SECTIONS.includes(section)){
      if(!data[section])data[section]=[];
      if(position!==data[section].length)throw Error('Missing feed row');
      data[section].push(value);
    }else if(SCALAR_SECTIONS.includes(section)){
      if(position!==0||Object.hasOwn(data,section))throw Error('Duplicate metadata');
      data[section]=value;
    }else throw Error('Unknown feed section');
  }
  if(manifest?.schemaVersion!==1||end?.revision!==manifest.revision||!/^[a-f0-9]{64}$/.test(manifest.revision))throw Error('Incomplete feed revision');
  for(const key of ARRAY_SECTIONS)if(data[key]?.length!==manifest.counts[key])throw Error('Feed row count mismatch');
  const {snapshotDate,...content}=data;
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(content)));
  const digest=Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
  if(digest!==manifest.revision)throw Error('Feed checksum mismatch');
  validateData(data);
  return {data,manifest};
}

export async function loadStats(){
  const url=new URL(`https://docs.google.com/spreadsheets/d/${PUBLIC_SHEET}/gviz/tq`);
  url.search=new URLSearchParams({gid:String(FEED_GID),headers:'1',tqx:'out:json',tq:'select A,B,C where A is not null',_ts:String(Date.now())});
  try{
    const response=await fetch(url,{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw Error(`Google Sheets returned ${response.status}`);
    const feed=await parseFeed(await response.text());
    try{localStorage.setItem(CACHE_KEY,JSON.stringify(feed));}catch{}
    return {...feed,source:'live'};
  }catch(error){
    console.warn('Public stats feed unavailable:',error.message);
    try{
      const cached=JSON.parse(localStorage.getItem(CACHE_KEY));
      validateData(cached?.data);
      return {...cached,source:'saved'};
    }catch{}
    const response=await fetch('data.json',{cache:'no-cache'});
    if(!response.ok)throw Error('No saved stats available');
    return {data:validateData(await response.json()),source:'saved'};
  }
}
