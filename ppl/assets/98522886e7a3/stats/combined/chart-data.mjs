export function indexResults(data) {
  const matchIndex = new Map();
  const eventIndex = new Map();
  const byeIndex = new Set(
    (data.byes || []).map((r) => `${r.player}|${r.eventId}|${r.round}`),
  );
  const unpairedLossIndex = new Set(
    (data.unpairedLosses || []).map((r) => `${r.player}|${r.eventId}|${r.round}`),
  );
  const attendanceIndex = new Set(
    data.results.map((r) => `${r.player}|${r.eventId}`),
  );
  for (const row of data.history) {
    for (const [map, key] of [
      [matchIndex, `${row.player}|${row.eventId}|${row.round}`],
      [eventIndex, `${row.player}|${row.eventId}`],
    ]) {
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
  }
  return { matchIndex, eventIndex, byeIndex, unpairedLossIndex, attendanceIndex };
}

/** Prepare domain values only: no SVG, browser state, or pixel coordinates. */
export function buildEloChart(
  data,
  selected,
  mode,
  lookups = indexResults(data),
) {
  const { matchIndex, byeIndex, unpairedLossIndex = new Set(), attendanceIndex } = lookups;
  const chosen = data.players.filter((player) => selected.has(player.player));
  const activeEvents = new Set(
    data.results.filter((r) => selected.has(r.player)).map((r) => r.eventId),
  );
  const visibleIndexes = data.timeline
    .map((_, i) => i)
    .filter((i) => activeEvents.has(data.timeline[i].eventId));
  const indexes =
    mode === "round"
      ? visibleIndexes
      : visibleIndexes.filter(
          (i, pos) =>
            pos === 0 ||
            !data.timeline[i + 1] ||
            data.timeline[i + 1].eventId !== data.timeline[i].eventId,
        );
  // Plot each attended event's starting rating and played rounds.
  const series = new Map(
    chosen.map((p) => {
      const samples = indexes.filter((idx) => {
        const t = data.timeline[idx];
        if (
          p.points[idx] == null ||
          !attendanceIndex.has(`${p.player}|${t.eventId}`)
        )
          return false;
        if (mode === "event") return true;
        if (t.round === 0) return true;
        return (
          matchIndex.has(`${p.player}|${t.eventId}|${t.round}`) ||
          byeIndex.has(`${p.player}|${t.eventId}|${t.round}`) ||
          unpairedLossIndex.has(`${p.player}|${t.eventId}|${t.round}`)
        );
      });
      return [p.player, samples];
    }),
  );
  const key = (idx) => {
    const t = data.timeline[idx];
    return mode === "round"
      ? `${t.eventDate}|${String(t.round).padStart(3, "0")}`
      : `${t.eventDate}|${t.eventId}|${t.round === 0 ? "0" : "1"}`;
  };
  const slots = [...new Set([...series.values()].flat().map(key))].sort();
  const positions = new Map(slots.map((slot, pos) => [slot, pos]));
  const position = (idx) => positions.get(key(idx));
  const ratings = [
    1200,
    ...chosen.flatMap((p) => series.get(p.player).map((i) => p.points[i])),
  ];
  const min = Math.floor((Math.min(...ratings) - 15) / 25) * 25;
  const max = Math.ceil((Math.max(...ratings) + 15) / 25) * 25;
  const groups = new Map();
  for (const idx of [...series.values()].flat()) {
    const t = data.timeline[idx],
      groupKey = mode === "round" ? t.eventDate : t.eventId;
    if (!groups.has(groupKey))
      groups.set(groupKey, {
        date: t.eventDate,
        positions: new Set(),
        special: false,
      });
    const group = groups.get(groupKey);
    group.positions.add(position(idx));
    group.special ||= t.eventTitle.includes("Win-a-Box");
  }
  const bands = [...groups.values()]
    .map((g) => ({ ...g, positions: [...g.positions].sort((a, b) => a - b) }))
    .sort((a, b) => a.positions[0] - b.positions[0]);
  const fnmDates = [
    ...new Set(
      data.results
        .filter((result) => result.isFnm)
        .map((result) => result.date),
    ),
  ];
  const players = chosen.map((player) => {
    const samples = series.get(player.player).map((index) => ({
      index,
      position: position(index),
      rating: player.points[index],
      date: data.timeline[index].eventDate,
      round: data.timeline[index].round,
      label: data.timeline[index].label,
    }));
    const attendedDates = new Set(
      data.results
        .filter((result) => result.player === player.player)
        .map((result) => result.date),
    );
    const { segments, endpoint } = buildSegments(
      samples,
      fnmDates,
      attendedDates,
      slots.length - 1,
    );
    return { player, samples, segments, endpoint };
  });
  return { players, bands, slots, min, max, mode };
}

/** Dashed segments hold the previous rating; only solid segments can change it. */
export function buildSegments(samples, fnmDates, attendedDates, rightEdge) {
  const segments = [];
  let previous = null;
  for (const sample of samples) {
    if (previous) {
      const missedWeek = fnmDates.some(
        (day) =>
          day > previous.date && day < sample.date && !attendedDates.has(day),
      );
      let from = previous.position;
      if (missedWeek) {
        from =
          sample.round === 0
            ? sample.position
            : Math.max(previous.position, sample.position - 1);
        if (from === previous.position)
          from = (previous.position + sample.position) / 2;
        segments.push({
          from: previous.position,
          to: from,
          startRating: previous.rating,
          endRating: previous.rating,
          inactive: true,
        });
      }
      if (from !== sample.position || previous.rating !== sample.rating) {
        segments.push({
          from,
          to: sample.position,
          startRating: previous.rating,
          endRating: sample.rating,
          inactive: false,
        });
      }
    }
    previous = sample;
  }
  let endpoint = previous && {
    position: previous.position,
    rating: previous.rating,
  };
  if (
    previous &&
    previous.position < rightEdge &&
    fnmDates.some((day) => day > previous.date && !attendedDates.has(day))
  ) {
    segments.push({
      from: previous.position,
      to: rightEdge,
      startRating: previous.rating,
      endRating: previous.rating,
      inactive: true,
    });
    endpoint.position = rightEdge;
  }
  return { segments, endpoint };
}
