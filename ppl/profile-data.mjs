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

// Event records include byes and IDs. Elo's rated-match counters do not.
export function eventRecord(events) {
  return events.reduce(
    (total, event) => ({
      wins: total.wins + event.wins,
      losses: total.losses + event.losses,
      draws: total.draws + event.draws,
    }),
    { wins: 0, losses: 0, draws: 0 },
  );
}
