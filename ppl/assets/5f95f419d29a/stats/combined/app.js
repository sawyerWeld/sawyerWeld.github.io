import { buildEloChart, indexResults } from "/ppl/assets/056ae0523751/stats/combined/chart-data.mjs";
import { renderEloChart } from "/ppl/assets/056ae0523751/stats/combined/chart.mjs";
import { renderInspection } from "/ppl/assets/056ae0523751/stats/combined/inspection.mjs?v=event-delta-fix";
import { renderLeaderboard as drawLeaderboard } from "/ppl/assets/056ae0523751/stats/combined/leaderboard.mjs";
import { date } from "/ppl/assets/056ae0523751/stats/combined/format.mjs";

const $ = (id) => document.getElementById(id);
const COLORS = [
  "#2167ae",
  "#2f855a",
  "#b45309",
  "#7c57a6",
  "#b54f69",
  "#087e8b",
  "#8b6b32",
  "#52627f",
  "#a83f89",
  "#67933d",
  "#c34e36",
  "#397d99",
  "#7570b3",
  "#8d5642",
  "#4a7263",
];

let store = new URL(location.href).searchParams.get("store") || "all";
const visiblePlayers = () =>
  data.players.filter((p) => store === "all" || p.storeIds.includes(store));
let data,
  selected = new Set(),
  mode = "round",
  inspected = null,
  chartFrame;
let indexes,
  leaderboardPage = 0;
const PAGE_SIZE = 15;
const playerByName = new Map();
const color = (name) =>
  COLORS[data.players.findIndex((p) => p.player === name) % COLORS.length];
function save() {
  try {
    localStorage.setItem(
      "combined-stats-v1",
      JSON.stringify({ players: [...selected] }),
    );
  } catch {}
  const url = new URL(location.href);
  url.searchParams.set("players", JSON.stringify([...selected]));
  url.searchParams.set("view", mode);
  url.searchParams.set("store", store);
  history.replaceState(null, "", url);
}
function setSelection(names) {
  selected = new Set(names.filter((name) => playerByName.has(name)));
  inspected = null;
  save();
  render();
}
function inspect(player, index) {
  inspected = { name: player.player, index };
  renderInspection($("inspection"), data, player, index, mode, indexes);
}
function renderChart() {
  const model = buildEloChart(data, selected, mode, indexes);
  renderEloChart($("chart"), $("chart-wrap"), model, {
    compact: innerWidth <= 760,
    color,
    onInspect: inspect,
  });
}
function renderLeaderboard() {
  drawLeaderboard(
    {
      rows: $("elo-rows"),
      range: $("page-range"),
      previous: $("previous-page"),
      next: $("next-page"),
    },
    {
      players: visiblePlayers(),
      stores: data.stores,
      selected,
      color,
      page: leaderboardPage,
      pageSize: PAGE_SIZE,
    },
  );
}
function render() {
  document
    .querySelectorAll("[data-store]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.store === store),
      ),
    );
  $("event-view").setAttribute("aria-pressed", String(mode === "event"));
  $("round-view").setAttribute("aria-pressed", String(mode === "round"));
  document.querySelectorAll("[data-top]").forEach((button) => {
    const names = visiblePlayers()
      .slice(0, Number(button.dataset.top))
      .map((p) => p.player);
    button.setAttribute(
      "aria-pressed",
      String(
        selected.size === names.length &&
          names.every((name) => selected.has(name)),
      ),
    );
  });
  renderChart();
  renderLeaderboard();
  if (inspected && selected.has(inspected.name))
    inspect(playerByName.get(inspected.name), inspected.index);
  else {
    $("inspection").replaceChildren();
    $("inspection").hidden = true;
  }
}
function applyData(next) {
  data = next;
  if (store !== "all" && !Object.hasOwn(data.stores, store)) store = "all";
  playerByName.clear();
  data.players.forEach((p) => playerByName.set(p.player, p));
  indexes = indexResults(data);
  leaderboardPage = Math.min(
    leaderboardPage,
    Math.max(0, Math.ceil(visiblePlayers().length / PAGE_SIZE) - 1),
  );
}
async function refreshData(initial = false) {
  const button = $("refresh-data");
  button.disabled = true;
  button.textContent = "Refreshing…";
  const preset = data
    ? [5, 10, 15].find(
        (n) =>
          selected.size === n &&
          visiblePlayers()
            .slice(0, n)
            .every((p) => selected.has(p.player)),
      )
    : null;
  try {
    const { loadStats } = await import("/ppl/assets/056ae0523751/stats/combined/data-source.mjs?v=c72f3ac0598c");
    const result = await loadStats();
    applyData(result.data);
    if (!initial) {
      selected = new Set(
        preset
          ? visiblePlayers()
              .slice(0, preset)
              .map((p) => p.player)
          : [...selected].filter((name) => playerByName.has(name)),
      );
      inspected = null;
      render();
    }
    const message =
      result.source === "live"
        ? `Updated. Results through ${date(data.through)}, ${data.through.slice(0, 4)}.`
        : `Update unavailable. Showing saved results through ${date(data.through)}, ${data.through.slice(0, 4)}.`;
    $("data-notice").textContent =
      result.source === "live" ? "" : `Saved data · ${date(data.through)}`;
    $("data-notice").hidden = result.source === "live";
    $("status").textContent = message;
    button.title = message;
    button.dataset.source = result.source;
  } catch (error) {
    $("data-notice").hidden = false;
    $("data-notice").textContent = data
      ? `Refresh failed · ${date(data.through)} data`
      : "Stats unavailable";
    $("status").textContent = "Stats could not be refreshed. Try again.";
    if (initial) throw error;
  } finally {
    button.disabled = false;
    button.textContent = "Refresh";
  }
}
async function init() {
  await refreshData(true);
  const url = new URL(location.href);
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem("combined-stats-v1"));
  } catch {}
  let names = saved?.players;
  if (url.searchParams.has("players"))
    try {
      names = JSON.parse(url.searchParams.get("players"));
    } catch {
      names = null;
    }
  // Keep selections from older links and saved preferences after abbreviating names.
  if (Array.isArray(names))
    names = names
      .filter((name) => typeof name === "string" && name.trim())
      .map((name) => {
        const parts = name.trim().split(/\s+/);
        return (
          parts[0][0].toUpperCase() +
          parts[0].slice(1).toLowerCase() +
          (parts.length > 1 ? " " + parts.at(-1)[0].toUpperCase() : "")
        );
      });
  selected = new Set(
    (Array.isArray(names)
      ? names
      : visiblePlayers()
          .slice(0, 5)
          .map((p) => p.player)
    ).filter((name) => playerByName.has(name)),
  );
  mode = url.searchParams.get("view") === "event" ? "event" : "round";
  selected = new Set(
    [...selected].filter((name) =>
      visiblePlayers().some((p) => p.player === name),
    ),
  );
  if (!selected.size)
    selected = new Set(
      visiblePlayers()
        .slice(0, 5)
        .map((p) => p.player),
    );
  save();
  document.querySelectorAll("[data-store]").forEach((button) =>
    button.addEventListener("click", () => {
      store = button.dataset.store;
      leaderboardPage = 0;
      setSelection(
        visiblePlayers()
          .slice(0, 5)
          .map((p) => p.player),
      );
    }),
  );
  document.querySelectorAll("[data-top]").forEach((button) =>
    button.addEventListener("click", () =>
      setSelection(
        visiblePlayers()
          .slice(0, Number(button.dataset.top))
          .map((p) => p.player),
      ),
    ),
  );
  for (const view of ["event", "round"])
    $(`${view}-view`).addEventListener("click", () => {
      mode = view;
      inspected = null;
      save();
      render();
    });
  $("previous-page").addEventListener("click", () => {
    if (leaderboardPage > 0) {
      leaderboardPage--;
      renderLeaderboard();
    }
  });
  $("next-page").addEventListener("click", () => {
    if ((leaderboardPage + 1) * PAGE_SIZE < visiblePlayers().length) {
      leaderboardPage++;
      renderLeaderboard();
    }
  });
  new ResizeObserver(() => {
    cancelAnimationFrame(chartFrame);
    chartFrame = requestAnimationFrame(renderChart);
  }).observe($("chart-wrap"));
  render();
}
$("refresh-data").addEventListener("click", () => {
  if (data) refreshData();
  else location.reload();
});
init().catch((error) => {
  console.error(error);
  $("inspection").hidden = false;
  $("inspection").textContent =
    "League data could not be loaded. Please reload the page.";
});
