import { renderProfileEventChart } from "./event-chart.mjs";
import { indexResults } from "../combined/chart-data.mjs";
import { renderEloChart } from "../combined/chart.mjs";
import { renderInspection } from "../combined/inspection.mjs";
import { renderProfileSections } from "./profile-view.mjs";
import { createPlayerPicker } from "./player-picker.mjs";
import { validateData } from "../combined/data-source.mjs";
import { readPreferences, savePreferences, preferredValue } from "../preferences.mjs";
import {
  selectPlayer,
  playerRoundChart,
} from "./profile-data.mjs";
import {
  element as $,
  loadLeagueData,
  loadDeckImages,
} from "./ui.mjs";
let data, deckImages, player, resultIndexes, playerPicker;
const params = new URL(location.href).searchParams;
const saved = readPreferences("ppl-player-v1");
let chartView = preferredValue(params, "view", saved.view, ["round", "event"], "round");
function showPlayer(name) {
  player = selectPlayer(data.players, name);
  const url = new URL(location.href);
  url.searchParams.set("player", player.player);
  history.replaceState(null, "", url);
  document.title = `${player.player} · Player profile`;
  playerPicker.setSelected(player.player);
  $("name").textContent = player.player;
  const sections = renderProfileSections(data, player, { deckImages });
  for (const [id, html] of Object.entries(sections)) $(id).innerHTML = html;
  renderChart();
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
    savePreferences("ppl-player-v1", { ...readPreferences("ppl-player-v1"), view });
    renderChart();
  });
}
new ResizeObserver(renderChart).observe($("chart"));
try {
  // Server-rendered profiles reuse their snapshot; static hosts still read Sheets.
  const initialData = $("profile-data");
  if (initialData) {
    data = validateData(JSON.parse(initialData.textContent));
    const initialImages = $("profile-deck-images");
    deckImages = initialImages ? JSON.parse(initialImages.textContent) : {};
  } else {
    [data, deckImages] = await Promise.all([loadLeagueData(), loadDeckImages()]);
  }
  resultIndexes = indexResults(data);
  playerPicker = createPlayerPicker(
    document.querySelector(".player-picker"),
    data.players.map((entry) => entry.player),
    (name) => {
      showPlayer(name);
      savePreferences("ppl-player-v1", { player: player.player, view: chartView });
    },
  );
  // Opening an opponent's link doesn't replace the profile chosen in the picker.
  showPlayer(preferredValue(params, "player", saved.player, data.players.map(p => p.player), null));
} catch (error) {
  $("error").hidden = false;
  $("error").textContent = error.message;
}
