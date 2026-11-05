/** Calculate an event delta from unrounded endpoints, including playoff rounds. */
export function eventRatingChange(data, player, eventId, endIndex) {
  const start = data.timeline.findIndex(
    (slot) => slot.eventId === eventId && slot.round === 0,
  );
  const end =
    endIndex ?? data.timeline.findLastIndex((slot) => slot.eventId === eventId);
  if (start < 0 || end < 0)
    throw new Error(`Missing timeline for event ${eventId}`);
  return player.points[end] - player.points[start];
}
