import { buildEloChart } from "../combined/chart-data.mjs";

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
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || a.eventId.localeCompare(b.eventId),
    );
}

// Use the same rounds shown in event details, including playoffs and unrated results.
export function playerMatches(data, name, eventId) {
  const belongs = (match) =>
    match.player === name && (eventId == null || match.eventId === eventId);
  const byes = data.byes
    .filter(belongs)
    .map((bye) => ({ ...bye, result: "Bye", opponent: null, ratingChange: 0 }));
  return [...data.history.filter(belongs), ...byes].sort(
    (a, b) => a.round - b.round,
  );
}

export function matchRecord(matches) {
  const record = { wins: 0, losses: 0, draws: 0 };
  for (const match of matches) {
    if (match.result === "Win" || match.result === "Bye") record.wins++;
    else if (match.result === "Loss") record.losses++;
    else if (match.result === "Draw" || match.result === "ID") record.draws++;
    else throw Error(`Unknown match result: ${match.result}`);
  }
  return record;
}

// Event-level profiles need one baseline, then one closing rating per event.
export function playerChartPoints(data, player) {
  const events = data.results
    .filter((event) => event.player === player.player)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.eventId.localeCompare(b.eventId),
    );
  const points = [];
  for (const event of events) {
    const slots = data.timeline
      .map((slot, index) => ({ ...slot, index }))
      .filter((slot) => slot.eventId === event.eventId);
    if (!slots.length) continue;
    if (!points.length) {
      points.push({ event, value: player.points[slots[0].index], start: true });
    }
    points.push({
      event,
      value: player.points[slots.at(-1).index],
      start: false,
    });
  }
  return points;
}

// A profile follows one player's results, so absences need no comparison markers.
export function playerRoundChart(data, player, indexes) {
  const model = buildEloChart(data, new Set([player.player]), "round", indexes);
  const series = model.players[0];
  if (!series) return model;
  const retained = series.samples.filter(
    (sample, index) => index === 0 || sample.round !== 0,
  );
  const positions = new Map(
    retained.map((sample, index) => [sample.position, index]),
  );
  const samples = retained.map((sample, position) => ({ ...sample, position }));
  const segments = samples.slice(1).map((sample, index) => ({
    from: samples[index].position,
    to: sample.position,
    startRating: samples[index].rating,
    endRating: sample.rating,
    inactive: false,
  }));
  const last = samples.at(-1);
  return {
    ...model,
    slots: retained.map((sample) => model.slots[sample.position]),
    bands: model.bands
      .map((band) => ({
        ...band,
        positions: band.positions
          .filter((position) => positions.has(position))
          .map((position) => positions.get(position)),
      }))
      .filter((band) => band.positions.length),
    players: [
      {
        ...series,
        samples,
        segments,
        endpoint: last
          ? { position: last.position, rating: last.rating }
          : null,
      },
    ],
  };
}
