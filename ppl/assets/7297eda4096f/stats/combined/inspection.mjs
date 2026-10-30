import { eventRatingChange } from "./event-rating.mjs";
import { esc, fmt, delta, date, signedClass } from "./format.mjs";
export function renderInspection(element, data, player, index, mode, indexes) {
  const { matchIndex, eventIndex, byeIndex, unpairedLossIndex = new Set() } = indexes;
  const slot = data.timeline[index];
  const entries =
    mode === "round"
      ? matchIndex.get(`${player.player}|${slot.eventId}|${slot.round}`) || []
      : eventIndex.get(`${player.player}|${slot.eventId}`) || [];
  const eventName = slot.eventTitle.includes("Win-a-Box") ? "Win-a-Box" : "FNM";
  const step =
    slot.round === 0
      ? "Event start"
      : mode === "event"
        ? ""
        : slot.round === 6 && eventName === "Win-a-Box"
          ? "Quarterfinal"
          : `Round ${slot.round}`;
  const record = data.results.find(
    (r) => r.player === player.player && r.eventId === slot.eventId,
  );
  // Use unrounded endpoints for the event total, not the sum of rounded match deltas.
  const change =
    mode === "event" && slot.round > 0
      ? eventRatingChange(data, player, slot.eventId, index)
      : entries.reduce((sum, row) => sum + row.ratingChange, 0);
  const peakNote =
    Math.abs(player.points[index] - player.peakElo) < 0.051
      ? " · Personal best"
      : "";
  let detail = "";
  if (slot.round === 0)
    detail = '<span class="result-note">Rating entering the event.</span>';
  else if (
    mode === "round" &&
    byeIndex.has(`${player.player}|${slot.eventId}|${slot.round}`)
  )
    detail = '<span class="result-note">Bye · Elo unchanged</span>';
  else if (mode === "round" && unpairedLossIndex.has(`${player.player}|${slot.eventId}|${slot.round}`))
    detail = '<span class="result-note">Loss · No opponent recorded · Elo unchanged</span>';
  else if (!entries.length)
    detail =
      '<span class="result-note">No rated match at this point. Rating unchanged.</span>';
  else
    detail = entries
      .map(
        (row) =>
          `<span class="match-detail"><strong>${esc(row.result)}</strong> vs ${esc(row.opponent)} <span class="${signedClass(row.ratingChange)}">${delta(row.ratingChange)}</span></span>`,
      )
      .join("");
  if (mode === "event" && record)
    detail += `<div class="result-note">Official finish: ${record.wins}–${record.losses}${record.draws ? `–${record.draws}` : ""}${record.trophy ? " · Trophy" : ""}${record.deck ? ` · ${esc(record.deck)}` : ""}</div>`;
  element.hidden = false;
  element.innerHTML = `<div class="inspection-head"><strong>${esc(player.player)}</strong><span>${date(slot.eventDate)} · ${esc(slot.storeName)} · ${eventName}${step ? ` · ${step}` : ""}</span></div><div class="rating">${fmt(player.points[index])} <span class="${signedClass(change)}">${slot.round && entries.length ? `(${delta(change)})` : ""}</span><span class="result-note">${peakNote}</span></div><div>${detail}</div>`;
}
