// Replace this URL with a public JSON feed when the season sheet is connected.
// The renderer only depends on the version-1 season object, not Sheets columns.
export const DATA_URL = './season.json';
export function validateSeason(data) {
  if(data?.schemaVersion!==1 || !data.season?.id) throw Error('Unsupported season data.');
  for(const key of ['standings','events','stores','eventResults','trophies']) if(!Array.isArray(data[key])) throw Error('Incomplete season data.');
  const players=new Set(data.standings.map(p=>p.playerId)), events=new Set(data.events.map(e=>e.id)), stores=new Set(data.stores.map(s=>s.id));
  if(players.size!==data.standings.length||events.size!==data.events.length) throw Error('Duplicate season entries.');
  if([...players].some(id=>!/^[-a-zA-Z0-9]+$/.test(id))||[...stores].some(id=>!/^\d+$/.test(id)))throw Error('Invalid identifiers.');
  const pairs=new Set(),totals=new Map();
  for(const r of data.eventResults){
    const key=r.playerId+'|'+r.eventId;
    if(pairs.has(key)||!players.has(r.playerId)||!events.has(r.eventId)||!stores.has(r.storeId)||!Number.isInteger(r.points)||r.points<0||r.points>9||!Array.isArray(r.rounds)) throw Error('Invalid event result.');
    pairs.add(key);
    if(new Set(r.rounds.map(x=>x.round)).size!==r.rounds.length||r.rounds.some(x=>![1,2,3].includes(x.round)||!['win','loss','draw','bye'].includes(x.result)||x.points!==({win:3,loss:0,draw:1,bye:3})[x.result])||r.rounds.reduce((n,x)=>n+x.points,0)!==r.points)throw Error('Round points do not match.');
    totals.set(r.playerId,(totals.get(r.playerId)||0)+r.points);
  }
  for(const p of data.standings) if(typeof p.name!=='string'||p.points!==(totals.get(p.playerId)||0)||!Array.isArray(p.storeIds))throw Error('Season totals do not match.');
  return data;
}
export async function loadSeason(){
  const response=await fetch(DATA_URL,{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Could not load season data.');
  return validateSeason(await response.json());
}
