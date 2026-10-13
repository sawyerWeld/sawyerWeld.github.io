export function selectPlayer(players, name) {
  return (
    players.find((player) => player.player === name) ||
    players.find((player) => player.rank === 1) ||
    players[0]
  );
}

export function playerEvents(results, name) {
  return results
    .filter((event) => event.player === name)
    .sort((a, b) => b.date.localeCompare(a.date) || a.eventId.localeCompare(b.eventId));
}

// Use the same rounds shown in event details, including playoffs and unrated results.
export function playerMatches(data, name, eventId) {
  const belongs = (match) =>
    match.player === name && (eventId == null || match.eventId === eventId);
  const byes = data.byes
    .filter(belongs)
    .map((bye) => ({ ...bye, result: 'Bye', opponent: null, ratingChange: 0 }));
  return [...data.history.filter(belongs), ...byes].sort((a, b) => a.round - b.round);
}

export function matchRecord(matches) {
  const record = { wins: 0, losses: 0, draws: 0 };
  for (const match of matches) {
    if (match.result === 'Win' || match.result === 'Bye') record.wins++;
    else if (match.result === 'Loss') record.losses++;
    else if (match.result === 'Draw' || match.result === 'ID') record.draws++;
    else throw Error(`Unknown match result: ${match.result}`);
  }
  return record;
}
