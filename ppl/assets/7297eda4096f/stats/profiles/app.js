import {
  fmt,
  delta as signed,
  signedClass as tone,
} from "../combined/format.mjs";
import { renderProfileEventChart } from "./event-chart.mjs?v=d6ea6427d4b5";
import { indexResults } from "../combined/chart-data.mjs";
import { eventRatingChange } from "../combined/event-rating.mjs";
import { renderEloChart } from "../combined/chart.mjs";
import { renderInspection } from "../combined/inspection.mjs";
import { renderTrophy } from "./trophies.mjs";
import { createPlayerPicker } from "./player-picker.mjs";
import {
  selectPlayer,
  playerEvents,
  playerMatches,
  matchRecord,
  formatMatchResult,
  playerRoundChart,
} from "./profile-data.mjs";
import {
  element as $,
  escapeHtml as esc,
  formatDate,
  loadLeagueData,
} from "./ui.mjs?v=d6ea6427d4b5";
const date = formatDate;
let data, player, resultIndexes, playerPicker;
let chartView =
  new URL(location.href).searchParams.get("view") === "event"
    ? "event"
    : "round";
function eventChange(id) {
  return eventRatingChange(data, player, id);
}
function showPlayer(name) {
  player = selectPlayer(data.players, name);
  const url = new URL(location.href);
  url.searchParams.set("player", player.player);
  history.replaceState(null, "", url);
  document.title = `${player.player} · Player profile`;
  playerPicker.setSelected(player.player);
  $("name").textContent = player.player;
  $("stores").innerHTML = player.storeIds
    .map((id) => `<a href="/ppl/store.html?store=${id}">${esc(data.stores[id])}</a>`)
    .join(" · ");
  const events = playerEvents(data.results, player.player);
  const record = matchRecord(playerMatches(data, player.player));
  const stats = [
    ["Elo", fmt(player.elo)],
    ["Peak", fmt(player.peakElo)],
    ["Record", `${record.wins}–${record.losses}–${record.draws}`],
    ["Events", player.eventsPlayed],
    ["Trophies", player.trophies.length],
  ];
  $("stats").innerHTML = stats
    .map(
      ([label, value]) =>
        `<div><strong>${value}</strong><span>${label}</span></div>`,
    )
    .join("");
  $("trophies").innerHTML = [...player.trophies]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((trophy) =>
      renderTrophy({
        storeId: trophy.storeId,
        storeName: data.stores[trophy.storeId],
        date: trophy.date,
        record: `${trophy.wins}–${trophy.losses}–${trophy.draws}`,
        showDate: true,
      }),
    )
    .join("");
  $("events").innerHTML = events.map(renderEvent).join("");
  renderChart();
}
function renderMatch(match, eventId) {
  const opponent = match.opponent
    ? `<a href="?player=${encodeURIComponent(match.opponent)}">${esc(match.opponent)}</a>`
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
    <td role="cell" class="match-round">${match.round}</td>
    <td role="cell" class="match-opponent">${opponent}</td>
    <td role="cell" class="opponent-deck">${esc(opponentDeck || "—")}</td>
    <td role="cell" class="match-result ${resultColor}"${resultNote}>${resultText}</td>
    <td role="cell" class="match-delta ${tone(match.ratingChange)}">${signed(match.ratingChange)}</td>
  </tr>`;
}

function renderEvent(event) {
  const change = eventChange(event.eventId);
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
      ${rounds.map((match) => renderMatch(match, event.eventId)).join("")}
    </tbody></table></div>
  </details>`;
}

function renderChart() {
  if (!player) return;
  const svg = $("chart");
  for (const view of ["event", "round"]) {
    $(`${view}-view`).setAttribute("aria-pressed", String(chartView === view));
  }
  $("inspection").hidden = false;
  if (chartView === "round") {
    const model = playerRoundChart(data, player, resultIndexes);
    renderEloChart(svg, $("profile-chart-wrap"), model, {
      compact: innerWidth <= 760,
      showEndLabels: false,
      height: svg.getBoundingClientRect().height,
      color: () => "#2167ae",
      onInspect: (selectedPlayer, index) =>
        renderInspection(
          $("inspection"),
          data,
          selectedPlayer,
          index,
          "round",
          resultIndexes,
        ),
    });
    svg.setAttribute("aria-label", `${player.player} Elo by round`);
    $("inspection").replaceChildren();
    return;
  }
  renderProfileEventChart(
    svg,
    $("profile-chart-wrap"),
    $("inspection"),
    data,
    player,
  );
}

for (const type of ["pointerover", "focusin", "click"])
  $("chart").addEventListener(type, (event) => {
    const label = event.target.closest("[data-label]")?.dataset.label;
    if (label) $("inspection").textContent = label;
  });
for (const view of ["event", "round"]) {
  $(`${view}-view`).addEventListener("click", () => {
    chartView = view;
    const url = new URL(location.href);
    url.searchParams.set("view", view);
    history.replaceState(null, "", url);
    renderChart();
  });
}
new ResizeObserver(renderChart).observe($("chart"));
try {
  data = await loadLeagueData();
  resultIndexes = indexResults(data);
  playerPicker = createPlayerPicker(
    document.querySelector(".player-picker"),
    data.players.map((entry) => entry.player),
    showPlayer,
  );
  showPlayer(new URL(location.href).searchParams.get("player"));
} catch (error) {
  $("error").hidden = false;
  $("error").textContent = error.message;
}
