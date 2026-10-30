import { renderTrophy } from "../profiles/trophies.mjs";
import { esc, fmt, delta, signedClass } from "./format.mjs";
function playerTrophies(player, stores) {
  return player.trophies
    .map((trophy) =>
      renderTrophy({
        storeId: trophy.storeId,
        storeName: stores[trophy.storeId],
        date: trophy.date,
        record: `${trophy.wins}–${trophy.losses}–${trophy.draws}`,
      }),
    )
    .join("");
}
export function renderLeaderboard(
  { rows, range, previous, next },
  { players: visible, stores, selected, color, page, pageSize },
) {
  const start = page * pageSize;
  const players = visible.slice(start, start + pageSize);
  rows.innerHTML = players
    .map(
      (p) =>
        `<tr><td>${p.rank}</td><td><span class="swatch" style="background:${selected.has(p.player) ? color(p.player) : "transparent"}"></span>${esc(p.player)}<span class="player-trophies">${playerTrophies(p, stores)}</span></td><td>${fmt(p.elo)}</td><td class="${signedClass(p.changeLastEvent)}">${delta(p.changeLastEvent)}</td><td>${p.totalPoints}</td><td>${p.matches}</td><td>${p.wins}–${p.losses}–${p.draws}</td></tr>`,
    )
    .join("");
  range.textContent = `${start + 1}–${start + players.length} of ${visible.length}`;
  previous.disabled = page === 0;
  next.disabled = start + pageSize >= visible.length;
}
