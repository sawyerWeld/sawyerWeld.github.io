const DATA_URL = "data/common-ground-cup-4-survivorship.json";
const DECK_DATA_URL = "data/common-ground-cup-4-decks.json";
const COLORS = [
  "#2f6fb0", "#d14a24", "#18864b", "#7a3fe3", "#bf2044", "#137f78",
  "#ad6500", "#3d3abf", "#df478d", "#5d6d82", "#8a5a44", "#2f91bd",
  "#789d27", "#e07b39", "#006d77", "#9b5de5", "#c44536", "#457b9d",
];
const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
}[char]));

function render(data) {
  const snapshots = data.rounds;
  const status = document.querySelector("#data-status");
  if (!data.labels.ready) {
    status.hidden = false;
    status.innerHTML = `<strong>Round paths are live; archetypes are not yet public.</strong>
      ${data.labels.classified} of ${data.labels.total} players are labeled. The chart will separate into archetype bands as decklists or organizer labels are added.`;
  }

  const archetypes = snapshots[0].archetypes.map((item) => item.name);
  const countFor = (snapshot, name) => snapshot.archetypes.find((item) => item.name === name)?.count ?? 0;
  const shareFor = (snapshot, name) => snapshot.archetypes.find((item) => item.name === name)?.share ?? 0;
  const promoted = new Set([
    ...snapshots[0].archetypes.slice(0, 18).map((item) => item.name),
    ...snapshots.at(-1).archetypes.map((item) => item.name),
  ]);
  const visibleNames = archetypes.filter((name) => promoted.has(name))
    .sort((a, b) => shareFor(snapshots[0], a) - shareFor(snapshots[0], b));
  const hiddenCount = archetypes.length - visibleNames.length;
  const series = visibleNames.map((name, index) => ({
    name,
    color: name === "Unclassified" ? "#9aa5ae" : COLORS[index % COLORS.length],
    values: snapshots.map((snapshot) => ({
      count: countFor(snapshot, name),
      share: shareFor(snapshot, name),
    })),
  }));
  if (hiddenCount) {
    series.unshift({
      name: `${hiddenCount} other archetypes`,
      color: "#a5afb8",
      values: snapshots.map((snapshot) => {
        const count = snapshot.survivors - visibleNames.reduce((sum, name) => sum + countFor(snapshot, name), 0);
        return { count, share: snapshot.survivors ? count / snapshot.survivors * 100 : 0 };
      }),
    });
  }

  const width = 1500;
  const height = 840;
  const margin = { left: 250, right: 250, top: 22, bottom: 74 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const step = snapshots.length > 1 ? plotWidth / (snapshots.length - 1) : 0;
  const x = (index) => margin.left + index * step;
  const y = (share) => margin.top + (100 - share) * plotHeight / 100;
  const cumulative = Array(snapshots.length).fill(0);
  const bounds = new Map();

  const bands = series.map((item) => {
    const lower = [...cumulative];
    const upper = item.values.map((value, index) => {
      cumulative[index] += value.share;
      return cumulative[index];
    });
    bounds.set(item.name, { lower, upper });
    const points = [
      ...upper.map((value, index) => `${x(index)},${y(value)}`),
      ...lower.map((value, index) => `${x(index)},${y(value)}`).reverse(),
    ];
    return `<path class="area-band" data-archetype="${esc(item.name)}" fill="${item.color}" d="M${points.join(" L")} Z"><title>${esc(item.name)}</title></path>`;
  }).join("");

  function edgeLabels(stageIndex, side) {
    const active = series.map((item) => {
      const itemBounds = bounds.get(item.name);
      return {
        item,
        desired: y((itemBounds.lower[stageIndex] + itemBounds.upper[stageIndex]) / 2),
        share: item.values[stageIndex].share,
      };
    }).filter((entry) => entry.share > 0).sort((a, b) => a.desired - b.desired);
    const gap = 25;
    active.forEach((entry, index) => {
      entry.labelY = Math.max(entry.desired, index ? active[index - 1].labelY + gap : margin.top + 8);
    });
    for (let index = active.length - 1; index >= 0; index -= 1) {
      const ceiling = index === active.length - 1 ? height - margin.bottom - 8 : active[index + 1].labelY - gap;
      active[index].labelY = Math.min(active[index].labelY, ceiling);
    }
    return active.map(({ item, desired, labelY }, index) => {
      const hitTop = index ? (active[index - 1].labelY + labelY) / 2 : margin.top;
      const hitBottom = index < active.length - 1 ? (labelY + active[index + 1].labelY) / 2 : height - margin.bottom;
      if (side === "left") {
        const labelRight = Math.min(238, 14 + item.name.length * 6.4);
        return `<g class="edge-label-group" data-archetype="${esc(item.name)}" data-stage-index="${stageIndex}">
          <rect class="edge-hit" x="8" y="${hitTop}" width="${labelRight}" height="${hitBottom - hitTop}"/>
          <path class="edge-leader" d="M${margin.left},${desired} L${margin.left - 12},${desired} L${labelRight},${labelY}"/>
          <text class="edge-label" x="10" y="${labelY + 4}">${esc(item.name)}</text></g>`;
      }
      return `<g class="edge-label-group" data-archetype="${esc(item.name)}" data-stage-index="${stageIndex}">
        <rect class="edge-hit" x="${width - margin.right + 12}" y="${hitTop}" width="238" height="${hitBottom - hitTop}"/>
        <path class="edge-leader" d="M${width - margin.right},${desired} L${width - margin.right + 12},${desired} L${width - margin.right + 20},${labelY}"/>
        <text class="edge-label" x="${width - margin.right + 24}" y="${labelY + 4}">${esc(item.name)}</text></g>`;
    }).join("");
  }

  const grid = [0, 100].map((share) => `
    <line class="grid-line" x1="${margin.left}" x2="${width - margin.right}" y1="${y(share)}" y2="${y(share)}"/>
    <text class="axis-label" x="${margin.left - 10}" y="${y(share) + 4}" text-anchor="end">${share}%</text>`).join("");
  const stages = snapshots.map((snapshot, index) => {
    const finalSwiss = snapshot.round === data.event.swissRounds;
    const label = snapshot.round ? `Round ${snapshot.round}${finalSwiss ? " / cut" : ""}` : "Field";
    return `<line class="stage-line ${finalSwiss ? "cut" : ""}" x1="${x(index)}" x2="${x(index)}" y1="${margin.top}" y2="${height - margin.bottom}"/>
      <text class="stage-label" x="${x(index)}" y="${height - 36}" text-anchor="middle">${label}</text>
      <text class="survivor-count" x="${x(index)}" y="${height - 16}" text-anchor="middle">${snapshot.survivors} alive</text>`;
  }).join("");

  const svg = document.querySelector("#survival-chart");
  svg.innerHTML = `${grid}${bands}${stages}${edgeLabels(0, "left")}${edgeLabels(snapshots.length - 1, "right")}
    <line class="hover-rule" x1="0" x2="0" y1="${margin.top}" y2="${height - margin.bottom}"/>`;
  const rule = svg.querySelector(".hover-rule");
  const byName = new Map(series.map((item) => [item.name, item]));
  let selected = null;

  function showValue(item, index) {
    rule.setAttribute("x1", x(index));
    rule.setAttribute("x2", x(index));
    rule.classList.add("visible");
  }

  function clearHover() {
    svg.querySelectorAll(".highlighted").forEach((node) => node.classList.remove("highlighted"));
    svg.classList.remove("chart-hovering");
    if (selected) showValue(selected.item, selected.index);
    else rule.classList.remove("visible");
  }

  function isAlive(player, round) {
    return (player.failureRound == null || player.failureRound > round)
      && (player.censoredRound == null || player.censoredRound >= round);
  }

  function renderAlive(item, index) {
    const snapshot = snapshots[index];
    const isOther = item.name.endsWith(" other archetypes");
    const visibleNameSet = new Set(visibleNames);
    const players = data.players.filter((player) => {
      const archetypeMatches = isOther ? !visibleNameSet.has(player.archetype) : player.archetype === item.name;
      return archetypeMatches && isAlive(player, snapshot.round);
    });
    const rows = players.map((player) => {
      const current = player.rounds.find((round) => round.round === snapshot.round);
      return `<tr><td class="player-name">${esc(player.name)}</td>
        ${isOther ? `<td>${esc(player.archetype)}</td>` : ""}
        <td>${esc(current?.record || "0-0-0")}</td>
        <td>${player.final?.rank ? `#${player.final.rank}` : "—"}</td>
        <td>${esc(player.final?.record || "—")}</td>
        <td>${player.topCut ? "Top 8" : "—"}</td></tr>`;
    }).join("");
    const panel = document.querySelector("#alive-panel");
    panel.innerHTML = `<div class="alive-heading" style="--active-color:${item.color}">
      <div><h3>${esc(item.name)}</h3><p>${snapshot.round ? `After round ${snapshot.round}` : "Starting field"} · ${players.length} players alive</p></div>
      <button class="alive-close" type="button" aria-label="Close">&times;</button></div>
      <div class="alive-table-wrap"><table class="alive-table">
        <thead><tr><th>Player</th>${isOther ? "<th>Archetype</th>" : ""}<th>Record here</th><th>Provisional rank</th><th>Latest record</th><th>Cut</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="${isOther ? 6 : 5}">No players in this slice.</td></tr>`}</tbody>
      </table></div>`;
    panel.classList.add("visible");
    panel.querySelector(".alive-close").addEventListener("click", () => {
      panel.classList.remove("visible");
      panel.innerHTML = `<div class="alive-empty"><strong>Decks alive here</strong><span>Click an archetype at any round to inspect its surviving players.</span></div>`;
      selected = null;
      svg.querySelectorAll(".selected").forEach((node) => node.classList.remove("selected"));
      clearHover();
    });
  }

  svg.addEventListener("pointermove", (event) => {
    const target = event.target.closest(".area-band, .edge-label-group");
    if (!target) return;
    const item = byName.get(target.dataset.archetype);
    let index = Number(target.dataset.stageIndex);
    if (target.classList.contains("area-band")) {
      const rect = svg.getBoundingClientRect();
      const svgX = (event.clientX - rect.left) / rect.width * width;
      index = step ? Math.max(0, Math.min(snapshots.length - 1, Math.round((svgX - margin.left) / step))) : 0;
    }
    svg.querySelectorAll(".highlighted").forEach((node) => node.classList.remove("highlighted"));
    svg.querySelector(`.area-band[data-archetype="${CSS.escape(item.name)}"]`)?.classList.add("highlighted");
    svg.classList.add("chart-hovering");
    showValue(item, index);
  });
  svg.addEventListener("pointerleave", clearHover);
  svg.addEventListener("click", (event) => {
    const target = event.target.closest(".area-band, .edge-label-group");
    if (!target) return;
    const item = byName.get(target.dataset.archetype);
    let index = Number(target.dataset.stageIndex);
    if (target.classList.contains("area-band")) {
      const rect = svg.getBoundingClientRect();
      const svgX = (event.clientX - rect.left) / rect.width * width;
      index = step ? Math.max(0, Math.min(snapshots.length - 1, Math.round((svgX - margin.left) / step))) : 0;
    }
    svg.querySelectorAll(".selected").forEach((node) => node.classList.remove("selected"));
    svg.querySelector(`.area-band[data-archetype="${CSS.escape(item.name)}"]`)?.classList.add("selected");
    selected = { item, index };
    showValue(item, index);
    renderAlive(item, index);
  });
}

function renderDeckAnalysis(payload) {
  const decks = payload.decks;
  const basicLands = new Set([
    "Plains", "Island", "Swamp", "Mountain", "Forest",
    "Snow-Covered Plains", "Snow-Covered Island", "Snow-Covered Swamp",
    "Snow-Covered Mountain", "Snow-Covered Forest",
  ]);
  const typeOrder = ["Land", "Creature", "Sorcery", "Instant", "Artifact", "Enchantment", "Other"];
  const typeLabels = {
    Land: "Lands",
    Creature: "Creatures",
    Artifact: "Artifacts",
    Enchantment: "Enchantments",
    Instant: "Instants",
    Sorcery: "Sorceries",
    Other: "Other",
  };
  const fieldCounts = new Map();
  decks.forEach((deck) => fieldCounts.set(deck.archetype, (fieldCounts.get(deck.archetype) || 0) + 1));
  const archetypes = [...fieldCounts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  const select = document.querySelector("#archetype-select");
  select.innerHTML = archetypes.map(([name, count]) => `<option value="${esc(name)}">${esc(name)} (${count})</option>`).join("");

  function consensus(list, board) {
    const cards = new Map();
    list.forEach((deck) => deck[board].forEach((card) => {
      const item = cards.get(card.name) || { sum: 0, decks: 0, type: card.type || "Other" };
      item.sum += card.quantity;
      item.decks += 1;
      cards.set(card.name, item);
    }));
    return [...cards].map(([name, item]) => ({
      name,
      type: item.type,
      average: item.sum / list.length,
      prevalence: item.decks / list.length * 100,
    })).filter((card) => card.prevalence > 10)
      .sort((left, right) => right.prevalence - left.prevalence
        || right.average - left.average
        || left.name.localeCompare(right.name));
  }

  function renderBoard(list, board) {
    const cards = consensus(list, board);
    return `<div class="consensus-section"><h3>${board === "main" ? "Main deck" : "Sideboard"}</h3>
      ${typeOrder.map((type) => {
    const rows = cards.filter((card) => card.type === type);
    if (!rows.length) return "";
    const average = list.reduce((sum, deck) => sum + deck[board]
      .filter((card) => (card.type || "Other") === type)
      .reduce((total, card) => total + card.quantity, 0), 0) / list.length;
    return `<div class="card-type-group"><div class="card-type-head"><span>${typeLabels[type]}</span><span>${average.toFixed(average < 1 ? 2 : 1)}</span></div>
      ${rows.map((card) => `<div class="card-row"><span class="avg">${card.average.toFixed(card.average < 1 ? 2 : 1)}</span><span>${esc(card.name)}</span><span class="prevalence">${Math.round(card.prevalence)}%</span></div>`).join("")}</div>`;
  }).join("")}</div>`;
  }

  function exactBoard(deck, board) {
    return `<div class="consensus-section"><h3>${board === "main" ? "Main deck" : "Sideboard"}</h3>
      ${typeOrder.map((type) => {
    const rows = deck[board].filter((card) => (card.type || "Other") === type);
    if (!rows.length) return "";
    const total = rows.reduce((sum, card) => sum + card.quantity, 0);
    return `<div class="card-type-group"><div class="card-type-head"><span>${typeLabels[type]}</span><span>${total}</span></div>
      ${rows.map((card) => `<div class="exact-card-row"><span class="avg">${card.quantity}</span><span>${esc(card.name)}</span></div>`).join("")}</div>`;
  }).join("")}</div>`;
  }

  function renderExactList(list, index) {
    const deck = list[index] || list[0];
    const mainTotal = deck.main.reduce((sum, card) => sum + card.quantity, 0);
    const sideTotal = deck.side.reduce((sum, card) => sum + card.quantity, 0);
    document.querySelector("#decklists-meta").textContent = `${mainTotal} main · ${sideTotal} sideboard`;
    document.querySelector("#decklist-grid").innerHTML = ["main", "side"].map((board) => exactBoard(deck, board)).join("");
  }

  function renderExplorer() {
    const list = decks.filter((deck) => deck.archetype === select.value);
    document.querySelector("#consensus").innerHTML = `${renderBoard(list, "main")}
      <div class="sideboard-column">${renderBoard(list, "side")}
        <button class="view-lists-button" id="view-lists" type="button" aria-expanded="false">View lists (${list.length})</button>
      </div>
      <div class="decklists-panel" id="decklists-panel" hidden>
        <div class="decklists-head">
          <label>Registered list<select id="decklist-select">${list.map((deck, index) => `<option value="${index}">${esc(deck.player)}</option>`).join("")}</select></label>
          <span class="decklists-meta" id="decklists-meta"></span>
        </div>
        <div class="decklist-grid" id="decklist-grid"></div>
      </div>`;
    const button = document.querySelector("#view-lists");
    const panel = document.querySelector("#decklists-panel");
    const listSelect = document.querySelector("#decklist-select");
    button.addEventListener("click", () => {
      const open = button.getAttribute("aria-expanded") !== "true";
      button.setAttribute("aria-expanded", String(open));
      button.textContent = `${open ? "Hide lists" : "View lists"} (${list.length})`;
      panel.hidden = !open;
      if (open) renderExactList(list, Number(listSelect.value));
    });
    listSelect.addEventListener("change", () => renderExactList(list, Number(listSelect.value)));
  }
  select.addEventListener("change", renderExplorer);

  const usage = new Map();
  decks.forEach((deck) => deck.main.forEach((card) => {
    if (basicLands.has(card.name)) return;
    const item = usage.get(card.name) || { copies: 0, decks: 0 };
    item.copies += card.quantity;
    item.decks += 1;
    usage.set(card.name, item);
  }));
  document.querySelector("#usage").innerHTML = [...usage]
    .map(([name, item]) => ({ name, ...item }))
    .sort((left, right) => right.copies - left.copies
      || right.decks - left.decks
      || left.name.localeCompare(right.name))
    .slice(0, 40)
    .map((card) => `<div class="usage-row"><span>${esc(card.name)}</span><span class="usage-copies">${card.copies}</span><span class="usage-decks">${card.decks} decks</span></div>`)
    .join("");
  renderExplorer();
}

fetch(DATA_URL)
  .then((response) => {
    if (!response.ok) throw new Error(`Snapshot request failed (${response.status})`);
    return response.json();
  })
  .then(render)
  .catch((error) => {
    document.querySelector(".chart-panel").innerHTML = `<div class="error">Could not load the survivorship snapshot: ${esc(error.message)}</div>`;
  });

fetch(DECK_DATA_URL)
  .then((response) => {
    if (!response.ok) throw new Error(`Deck data request failed (${response.status})`);
    return response.json();
  })
  .then(renderDeckAnalysis)
  .catch((error) => {
    document.querySelector("#consensus").innerHTML = `<div class="error">${esc(error.message)}</div>`;
    document.querySelector("#usage").innerHTML = `<div class="error">${esc(error.message)}</div>`;
  });
