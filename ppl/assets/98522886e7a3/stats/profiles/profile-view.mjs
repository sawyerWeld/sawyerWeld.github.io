import {
  fmt,
  delta as signed,
  signedClass as tone,
  esc,
  date,
} from "../combined/format.mjs";
import { eventRatingChange } from "../combined/event-rating.mjs";
import { renderTrophies } from "./trophies.mjs";
import { playerDeckStats } from "./deck-stats.mjs";
import { renderDeckStats } from "./deck-stats-view.mjs";
import {
  playerEvents,
  playerMatches,
  matchRecord,
  formatMatchResult,
} from "./profile-data.mjs";

// Shared by the browser and server so profile details use identical markup.
export function renderProfileSections(data, player, { assetBase, deckImages = {}, now } = {}) {
  const record = matchRecord(playerMatches(data, player.player));
  const stats = [
    ["Elo", fmt(player.elo)],
    ["Peak", fmt(player.peakElo)],
    ["Record", `${record.wins}–${record.losses}–${record.draws}`],
    ["Events", player.eventsPlayed],
    ["Trophies", player.trophies.length],
  ];
  return {
    "deck-stats": renderDeckStats(playerDeckStats(data, player.player, { now }), player.player, deckImages),
    stores: player.storeIds
      .map((id) => `<a href="/ppl/store.html?store=${esc(encodeURIComponent(id))}">${esc(data.stores[id])}</a>`)
      .join(" · "),
    stats: stats
      .map(([label, value]) => `<div><strong>${esc(value)}</strong><span>${label}</span></div>`)
      .join(""),
    trophies: renderTrophies(
      player.trophies.map((trophy) => ({
        eventId: trophy.eventId,
        storeId: trophy.storeId,
        storeName: data.stores[trophy.storeId],
        date: trophy.date,
        record: `${trophy.wins}–${trophy.losses}–${trophy.draws}`,
        showDate: true,
      })),
      { assetBase },
    ),
    events: playerEvents(data.results, player.player)
      .map((event) => renderEvent(data, player, event))
      .join(""),
  };
}

function renderMatch(data, match, eventId) {
  const opponent = match.opponent
    ? `<a href="?player=${esc(encodeURIComponent(match.opponent))}">${esc(match.opponent)}</a>`
    : match.unpairedLoss ? "No opponent" : "—";
  const opponentDeck = data.results.find(
    (entry) => entry.eventId === eventId && entry.player === match.opponent,
  )?.deck;
  const result = formatMatchResult(match);
  const resultColor = match.result === "Win" ? "positive" : match.result === "Loss" ? "negative" : "";
  const resultText = result.score
    ? `<span class="sr-only">${esc(result.label)} </span>${esc(result.score)}`
    : esc(result.label);
  const resultNote = match.unpairedLoss
    ? ' title="Official loss with no opponent recorded; Elo unchanged."'
    : match.scoreInferred
      ? ' title="Draw; the complete game score was not recorded."'
      : "";
  return `<tr role="row">
    <td role="cell" class="match-round">${esc(match.round)}</td>
    <td role="cell" class="match-opponent">${opponent}</td>
    <td role="cell" class="opponent-deck">${esc(opponentDeck || "—")}</td>
    <td role="cell" class="match-result ${resultColor}"${resultNote}>${resultText}</td>
    <td role="cell" class="match-delta ${tone(match.ratingChange)}">${signed(match.ratingChange)}</td>
  </tr>`;
}

function renderEvent(data, player, event) {
  const change = eventRatingChange(data, player, event.eventId);
  const rounds = playerMatches(data, player.player, event.eventId);
  const record = matchRecord(rounds);
  return `<details>
    <summary>
      <span class="event-identity">
        <strong class="event-date">${date(event.date)}</strong>
        <span class="event-store muted">${esc(data.stores[event.storeId])}</span>
      </span>
      <span class="deck">${esc(event.deck || "—")}</span>
      <span class="record">${record.wins}–${record.losses}–${record.draws}</span>
      <span class="delta ${tone(change)}">${signed(change)}</span>
    </summary>
    <div class="matches"><table role="table" aria-label="${date(event.date)} matches"><tbody role="rowgroup">
      ${rounds.map((match) => renderMatch(data, match, event.eventId)).join("")}
    </tbody></table></div>
  </details>`;
}
