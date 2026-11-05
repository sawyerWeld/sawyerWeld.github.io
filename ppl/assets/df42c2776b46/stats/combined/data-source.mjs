import { loadLeagueFeed } from '../league-feed.mjs';

function validateUnpairedLosses(data, names, results) {
  const losses = data.unpairedLosses === undefined ? [] : data.unpairedLosses;
  if (!Array.isArray(losses)) throw Error('Invalid unpaired losses');
  const key = row => JSON.stringify([row.eventId, row.round, row.player]);
  const occupied = new Set([...data.history, ...(data.byes || [])].map(key));
  const checkpoints = new Set(data.timeline.map(row => JSON.stringify([row.eventId, row.round])));
  for (const loss of losses) {
    if (!loss || Object.keys(loss).sort().join(',') !== 'eventId,player,round' ||
        !names.has(loss.player) || !Number.isInteger(loss.round) || loss.round < 1 ||
        !results.has(JSON.stringify([loss.eventId, loss.player])) ||
        !checkpoints.has(JSON.stringify([loss.eventId, loss.round])) || occupied.has(key(loss)))
      throw Error('Duplicate or invalid unpaired loss');
    occupied.add(key(loss));
  }
}

const ARRAY_SECTIONS=['timeline','players','history','results'];
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
    if(results.has(key)||!names.has(r.player)||['wins','losses','draws'].some(k=>!Number.isInteger(r[k])||r[k]<0)||r.trophy!==(r.isFnm&&r.wins>=3&&r.losses===0))throw Error('Invalid event result');
    results.add(key);
  }
  if(new Set(data.timeline.map(t=>t.eventId)).size!==data.meta.events)throw Error('Event count mismatch');
  validateUnpairedLosses(data, names, results);
  return data;
}

export async function loadStats(options){
  const feed = await loadLeagueFeed(options);
  return {data:validateData(feed.combined),source:'live'};
}
