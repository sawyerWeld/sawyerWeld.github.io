import { esc, date } from '../combined/format.mjs';

function eventHTML(entry, event, store, player, rules) {
  const counted = !player.countedEventIds || player.countedEventIds.includes(entry.eventId);
  const points = counted
    ? `${entry.points} pts`
    : `<span class="sr-only">Not counted toward season points: </span><s title="Outside best ${rules.eventLimit} events">${entry.points} pts</s>`;
  const rounds = [1, 2, 3].map(number => {
    const round = entry.rounds.find(round => round.round === number);
    const label = round
      ? round.intentionalDraw ? 'ID' : { win: 'W', loss: 'L', draw: 'D', bye: 'Bye' }[round.result]
      : '—';
    return `<span class="round"><small>R${number}</small>${label}</span>`;
  }).join('');
  return `<div class="event"><span class="event-date">${date(event.date)}</span><span class="store-name">${esc(store.name)}</span><div class="rounds">${rounds}</div><span class="event-points">${points}</span><span class="record">${esc(entry.eventRecord)}</span></div>`;
}

function bonusHTML(bonus, stores, season) {
  const acrossYears = season.startDate.slice(0, 4) !== season.endDate.slice(0, 4);
  const month = new Date(`${bonus.month}-01T12:00:00`).toLocaleDateString('en-US', {
    month: 'short', ...(acrossYears ? { year: 'numeric' } : {}),
  });
  const names = bonus.storeIds.map(id => stores.get(id).name).sort((a, b) => a.localeCompare(b));
  return `<div class="event store-bonus"><span class="event-date" title="Monthly store bonus">${month} bonus</span><span class="store-name">${names.map(esc).join(' · ')}</span><span class="event-points">+${bonus.points} ${bonus.points === 1 ? 'pt' : 'pts'}</span></div>`;
}

export function renderEventList(player, data) {
  const events = new Map(data.events.map(event => [event.id, event]));
  const stores = new Map(data.stores.map(store => [store.id, store]));
  const entries = data.eventResults
    .filter(entry => entry.playerId === player.playerId)
    .sort((a, b) => events.get(b.eventId).date.localeCompare(events.get(a.eventId).date));
  const bonuses = new Map(
    (data.rules?.scoring === 'league' ? player.storeBonuses || [] : [])
      .filter(bonus => bonus.points > 0)
      .map(bonus => [bonus.month, bonus]),
  );
  let previousMonth;
  return entries.map(entry => {
    const event = events.get(entry.eventId), month = event.date.slice(0, 7);
    const bonus = month !== previousMonth && bonuses.get(month);
    previousMonth = month;
    return (bonus ? bonusHTML(bonus, stores, data.season) : '') +
      eventHTML(entry, event, stores.get(entry.storeId), player, data.rules);
  }).join('');
}
