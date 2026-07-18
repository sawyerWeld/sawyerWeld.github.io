const DATA_URL = "data/paupergenesis-2026-survivorship.json";
const EVENT_DATA_URL = "data/paupergenesis-2026.json";
const COMPARISON_DATA_URL = "data/paupergenesis-2026-comparison.json";
const VARIANCE_DATA_URL = "data/genesis-geddon-variance.json";
const COLORS = [
  "#2f6fb0", "#d14a24", "#18864b", "#7a3fe3", "#bf2044", "#137f78", "#ad6500",
  "#3d3abf", "#df478d", "#5d6d82", "#8a5a44", "#2f91bd", "#789d27", "#e07b39",
  "#006d77", "#9b5de5", "#c44536", "#457b9d", "#6a994e", "#bc6c25", "#8d3b72", "#277da1",
];
const MANA_FILL = {
  W: "#d9c466",
  U: "#2f80b7",
  B: "#5d4a72",
  R: "#c74a3a",
  G: "#3f8c5a",
  C: "#8d99a5",
};
const IDENTITY_FILL = {
  WU: "#7899ad",
  UB: "#53628a",
  BR: "#8e4d52",
  RG: "#71834f",
  BG: "#496b59",
  WR: "#b47749",
  WG: "#82985d",
  UR: "#68699a",
  UG: "#438080",
  WB: "#78677d",
  UBR: "#66576f",
  BRG: "#6d6849",
  WUR: "#81728a",
  URG: "#50766e",
  WRG: "#8b8050",
  WBR: "#806161",
};
const MANA_BY_ARCHETYPE = {
  "Mono Red Madness": ["R"], "Mono Blue Terror": ["U"], "Grixis Affinity": ["U", "B", "R"],
  "Dimir Faeries": ["U", "B"], "Elves": ["G"], "Mono Red Rally": ["R"],
  "Rakdos Madness Burn": ["B", "R"], "Jund Wildfire": ["B", "R", "G"], "Spy Combo": ["B", "G"],
  "Jeskai Ephemerate": ["W", "U", "R"], "Dimir Terror": ["U", "B"], "White Weenie": ["W"],
  "Monster Tron": ["U", "G"], "Azorius Familiars": ["W", "U"], "Golgari Gardens": ["B", "G"],
  "Tireless Tribe": ["W", "R"], "Pizza Combo": ["U", "R", "G"], "Cawgate": ["W", "U"],
  "Gruul Ponza": ["R", "G"], "Naya Gates": ["W", "R", "G"], "Mardu Synthesizer": ["W", "B", "R"],
  "Gruul Tokens": ["R", "G"], "Boros Synthesizer": ["W", "R"], "Golgari Pestilence": ["B", "G"],
  "Gruul Elves": ["R", "G"], "Gruul Storm": ["R", "G"], "Mono Black Sacrifice": ["B"],
  "Altar Tron": ["U", "B", "R", "G"], "Bogles": ["W", "G"], "Flicker Tron": ["U", "B", "R"],
  "Gruul Monsters": ["R", "G"], "Izzet Skred": ["U", "R"], "Mono Blue Faeries": ["U"],
  "Turbofog": ["B", "G"], "Walls": ["U", "B", "R", "G"], "Azorius Ephemerate": ["W", "U"],
  "Boros Eidolons": ["W", "R"], "Dimir Affinity": ["U", "B"], "Dimir Control": ["U", "B"],
  "Grixis Control": ["U", "B", "R"], "Jeskai Synthesizer": ["W", "U", "R"],
  "Jund Pestilence": ["B", "R", "G"], "Jund Reanimator": ["B", "R", "G"],
  "Mardu Blade": ["W", "B", "R"], "Mono Black Devotion": ["B"], "Mono Black Pestilence": ["B"],
  "Mono Blue Persistent Petitioners": ["U"], "Mono Green Infect": ["G"], "Mono Red Axe": ["R"],
  "Mono White": ["W"], "Orzhov Blade": ["W", "B"], "Selesnya Gates": ["W", "G"],
  "Selesnya Slivers": ["W", "G"], "Simic": ["U", "G"], "Simic Turbofog": ["U", "G"],
  "Sultai Persistent Petitioners": ["U", "B", "G"], "Sultai Poison Storm": ["U", "B", "G"],
  "U B R G Control": ["U", "B", "R", "G"], "W U B R G Control": ["W", "U", "B", "R", "G"],
};

const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
}[char]));

function render(data, eventData, comparisonData) {
  const snapshots = data.rounds;
  const archetypes = snapshots[0].archetypes.map((item) => item.name);
  const shareFor = (snapshot, name) => snapshot.archetypes.find((item) => item.name === name)?.share ?? 0;
  const countFor = (snapshot, name) => snapshot.archetypes.find((item) => item.name === name)?.count ?? 0;
  const promoted = new Set([
    ...snapshots[0].archetypes.slice(0, 20).map((item) => item.name),
    ...snapshots.at(-1).archetypes.map((item) => item.name),
  ]);
  const visibleNames = archetypes
    .filter((name) => promoted.has(name))
    .sort((a, b) => shareFor(snapshots[0], a) - shareFor(snapshots[0], b));
  const otherArchetypeCount = archetypes.length - visibleNames.length;
  const otherName = `${otherArchetypeCount} other archetypes`;
  const colorByName = new Map(visibleNames.map((name, index) => [name, COLORS[index]]));
  const series = visibleNames.map((name) => ({
    name,
    mana: MANA_BY_ARCHETYPE[name] || [],
    color: MANA_FILL[MANA_BY_ARCHETYPE[name]?.[0]] || colorByName.get(name),
    values: snapshots.map((snapshot) => ({
      count: countFor(snapshot, name),
      share: shareFor(snapshot, name),
    })),
  }));
  series.unshift({
    name: otherName,
    mana: [],
    color: "#a5afb8",
    values: snapshots.map((snapshot) => {
      const count = snapshot.survivors - visibleNames.reduce((sum, name) => sum + countFor(snapshot, name), 0);
      return { count, share: snapshot.survivors ? count / snapshot.survivors * 100 : 0 };
    }),
  });
  series.forEach((item) => {
    const manaColors = item.mana.map((symbol) => MANA_FILL[symbol]);
    const identity = item.mana.join("");
    item.fill = IDENTITY_FILL[identity] || manaColors[0] || item.color;
    item.color = item.fill;
    item.legendFill = item.fill;
  });

  const width = 1500, height = 840;
  const margin = { left: 250, right: 250, top: 22, bottom: 70 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const step = plotWidth / (snapshots.length - 1);
  const x = (index) => margin.left + index * step;
  const y = (share) => margin.top + (100 - share) * plotHeight / 100;
  const cumulative = Array(snapshots.length).fill(0);
  const boundsByName = new Map();
  const bands = series.map((item) => {
    const lower = [...cumulative];
    const upper = item.values.map((value, index) => {
      cumulative[index] += value.share;
      return cumulative[index];
    });
    boundsByName.set(item.name, { lower, upper });
    const points = [
      ...upper.map((value, index) => `${x(index)},${y(value)}`),
      ...lower.map((value, index) => `${x(index)},${y(value)}`).reverse(),
    ];
    return `<path class="area-band" data-archetype="${esc(item.name)}" fill="${item.fill}" d="M${points.join(" L")} Z">
      <title>${esc(item.name)}</title>
    </path>`;
  }).join("");
  const pipImages = (name, startX, labelY) => (MANA_BY_ARCHETYPE[name] || []).map((mana, index) =>
    `<image class="edge-pip" href="mana/${mana}.svg" x="${startX + index * 16}" y="${labelY - 7}" width="14" height="14" />`
  ).join("");
  const edgeLabels = (stageIndex, side) => {
    const active = series.map((item) => {
      const bounds = boundsByName.get(item.name);
      const share = item.values[stageIndex].share;
      return {
        item,
        desired: y((bounds.lower[stageIndex] + bounds.upper[stageIndex]) / 2),
        share,
      };
    }).filter((entry) => entry.share > 0).sort((a, b) => a.desired - b.desired);
    const gap = 27;
    const minY = margin.top + 8;
    const maxY = height - margin.bottom - 8;
    active.forEach((entry, index) => {
      entry.labelY = Math.max(entry.desired, index ? active[index - 1].labelY + gap : minY);
    });
    for (let index = active.length - 1; index >= 0; index -= 1) {
      const ceiling = index === active.length - 1 ? maxY : active[index + 1].labelY - gap;
      active[index].labelY = Math.min(active[index].labelY, ceiling);
    }
    if (active[0]?.labelY < minY) {
      const shift = minY - active[0].labelY;
      active.forEach((entry) => { entry.labelY += shift; });
    }
    return active.map(({ item, desired, labelY }, activeIndex) => {
      const pips = MANA_BY_ARCHETYPE[item.name] || [];
      const hitTop = activeIndex
        ? (active[activeIndex - 1].labelY + labelY) / 2
        : margin.top;
      const hitBottom = activeIndex < active.length - 1
        ? (labelY + active[activeIndex + 1].labelY) / 2
        : height - margin.bottom;
      if (side === "left") {
        const pipX = 10;
        const nameX = pipX + pips.length * 16 + (pips.length ? 4 : 0);
        const labelRight = nameX + item.name.length * 6.2 + 6;
        return `<g class="edge-label-group" data-archetype="${esc(item.name)}" data-stage-index="${stageIndex}">
          <rect class="edge-hit" x="8" y="${hitTop}" width="${labelRight - 8}" height="${hitBottom - hitTop}" />
          <path class="edge-leader" d="M${margin.left},${desired} L${margin.left - 12},${desired} L${labelRight},${labelY}" />
          ${pipImages(item.name, pipX, labelY)}<text class="edge-label" x="${nameX}" y="${labelY + 4}">${esc(item.name)}</text>
        </g>`;
      }
      const pipX = width - margin.right + 22;
      const nameX = pipX + pips.length * 16 + (pips.length ? 4 : 0);
      const labelWidth = pips.length * 16 + (pips.length ? 4 : 0) + item.name.length * 6.2 + 8;
      return `<g class="edge-label-group" data-archetype="${esc(item.name)}" data-stage-index="${stageIndex}">
        <rect class="edge-hit" x="${pipX - 2}" y="${hitTop}" width="${labelWidth}" height="${hitBottom - hitTop}" />
        <path class="edge-leader" d="M${width - margin.right},${desired} L${width - margin.right + 12},${desired} L${width - margin.right + 20},${labelY}" />
        ${pipImages(item.name, pipX, labelY)}<text class="edge-label" x="${nameX}" y="${labelY + 4}">${esc(item.name)}</text>
      </g>`;
    }).join("");
  };
  const horizontalGrid = [0, 100].map((share) => `
    <line class="grid-line" x1="${margin.left}" x2="${width - margin.right}" y1="${y(share)}" y2="${y(share)}" />
    <text class="axis-label" x="${margin.left - 10}" y="${y(share) + 4}" text-anchor="end">${share}%</text>`).join("");
  const stages = snapshots.map((snapshot, index) => `
    <line class="stage-line" x1="${x(index)}" x2="${x(index)}" y1="${margin.top}" y2="${height - margin.bottom}" />
    <text class="stage-label" x="${x(index)}" y="${height - 34}" text-anchor="middle">${snapshot.round ? `Round ${snapshot.round}` : "Field"}</text>
    <text class="survivor-count" x="${x(index)}" y="${height - 15}" text-anchor="middle">${snapshot.survivors} players</text>`).join("");

  const svg = document.querySelector("#survival-chart");
  svg.innerHTML = `${horizontalGrid}${bands}${stages}${edgeLabels(0, "left")}${edgeLabels(snapshots.length - 1, "right")}<line class="hover-rule" x1="0" x2="0" y1="${margin.top}" y2="${height - margin.bottom}" />`;
  const event = data.event;

  const readout = document.querySelector("#hover-readout");
  const alivePanel = document.querySelector("#alive-panel");
  const rule = svg.querySelector(".hover-rule");
  const seriesByName = new Map(series.map((item) => [item.name, item]));
  const statusById = new Map(data.players.map((player) => [player.id, player]));
  const visibleNameSet = new Set(visibleNames);
  const normalizedByRawArchetype = new Map(eventData.players.map((player) => [
    player.archetype,
    statusById.get(player.id)?.archetype || player.archetype.replaceAll("-", " "),
  ]));
  const fullPlayers = eventData.players.map((player) => ({
    ...player,
    normalizedArchetype: statusById.get(player.id)?.archetype || normalizedByRawArchetype.get(player.archetype),
  }));
  const lastLiveRound = (player) => {
    const status = statusById.get(player.id);
    if (status?.failureRound != null) return Math.max(0, status.failureRound - 1);
    if (status?.censoredRound != null) return Math.max(0, status.censoredRound);
    return event.swissRounds;
  };
  const lastLiveStanding = (player) => player.rounds.find((round) => round.round === lastLiveRound(player))?.standing;
  const survivorOrder = [...fullPlayers].sort((a, b) => lastLiveRound(b) - lastLiveRound(a)
    || (lastLiveStanding(b)?.points ?? 0) - (lastLiveStanding(a)?.points ?? 0)
    || (lastLiveStanding(a)?.rank ?? a.final?.rank ?? 9999) - (lastLiveStanding(b)?.rank ?? b.final?.rank ?? 9999)
    || a.name.localeCompare(b.name));
  const survivorRanks = new Map(survivorOrder.map((player, survivorIndex) => [player.id, survivorIndex + 1]));
  const survivorBands = new Map();
  survivorOrder.forEach((player, survivorIndex) => {
    const round = lastLiveRound(player);
    const rank = survivorIndex + 1;
    const band = survivorBands.get(round) || { round, start: rank, end: rank };
    band.end = rank;
    survivorBands.set(round, band);
  });
  let selectedIndex = null;
  const recordAt = (player, round) => {
    if (!round) return "0-0-0";
    return player.rounds.find((item) => item.round === round)?.standing?.matchRecord || "-";
  };
  const isAliveAt = (player, round) => {
    if (!round) return true;
    const status = statusById.get(player.id);
    return status && (status.failureRound == null || status.failureRound > round)
      && (status.censoredRound == null || status.censoredRound > round);
  };
  const manaPipsHtml = (name) => (MANA_BY_ARCHETYPE[name] || []).map((mana) =>
    `<img src="mana/${mana}.svg" alt="${mana}" width="16" height="16">`
  ).join("");
  const formatTiebreak = (value) => Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "-";
  const archetypeCounts = (players) => {
    const counts = new Map();
    players.forEach((player) => counts.set(player.normalizedArchetype, (counts.get(player.normalizedArchetype) || 0) + 1));
    return counts;
  };
  const comparePopulations = (snapshot, funnelSize) => {
    const alivePlayers = fullPlayers.filter((player) => isAliveAt(player, snapshot.round));
    const funnelPlayers = fullPlayers.filter((player) => player.final?.rank <= funnelSize);
    const aliveCounts = archetypeCounts(alivePlayers);
    const funnelCounts = archetypeCounts(funnelPlayers);
    const names = new Set([...aliveCounts.keys(), ...funnelCounts.keys()]);
    const deltas = [...names].map((name) => {
      const aliveCount = aliveCounts.get(name) || 0;
      const funnelCount = funnelCounts.get(name) || 0;
      const aliveShare = alivePlayers.length ? aliveCount / alivePlayers.length * 100 : 0;
      const funnelShare = funnelPlayers.length ? funnelCount / funnelPlayers.length * 100 : 0;
      return { name, aliveCount, funnelCount, aliveShare, funnelShare, delta: aliveShare - funnelShare };
    }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.name.localeCompare(b.name));
    return {
      snapshot,
      funnelSize,
      aliveSize: alivePlayers.length,
      funnelActualSize: funnelPlayers.length,
      distance: deltas.reduce((sum, row) => sum + Math.abs(row.delta), 0) / 2,
      deltas,
    };
  };
  const renderComparison = () => {
    const nullByRound = new Map(comparisonData.rounds.map((row) => [row.round, row]));
    const comparisons = snapshots.map((snapshot) => ({
      ...comparePopulations(snapshot, snapshot.survivors),
      ...nullByRound.get(snapshot.round),
    }));
    const peak = comparisons.reduce((best, comparison) => comparison.distance > best.distance ? comparison : best);

    const roundsHost = document.querySelector("#round-comparison");
    const detailHost = document.querySelector("#comparison-detail");
    const maxDistance = Math.max(...comparisons.map((comparison) => Math.max(comparison.distance, comparison.null95Pct)), 1);
    const showComparison = (selectedIndex) => {
      const comparison = comparisons[selectedIndex];
      roundsHost.querySelectorAll("button").forEach((button) => {
        button.classList.toggle("active", Number(button.dataset.index) === selectedIndex);
      });
      const meaningful = comparison.deltas.filter((row) => Math.abs(row.delta) >= 0.05).slice(0, 12);
      detailHost.innerHTML = `<div class="detail-heading">
        <div><h3>${comparison.snapshot.round ? `After Round ${comparison.snapshot.round}` : "Starting field"}</h3>
        <p>${comparison.aliveSize} alive vs. final Top ${comparison.funnelSize}</p></div>
        <strong>${comparison.distance.toFixed(1)}% different</strong>
      </div>
      <div class="null-result ${comparison.permutationP < 0.05 ? "notable" : "expected"}">
        <strong>${comparison.permutationP < 0.05 ? "More different than random variation predicts" : "About what random variation predicts"}</strong>
        <span>Random shuffles average ${comparison.nullMeanPct.toFixed(1)}%; a gap this large appears about ${(comparison.permutationP * 100).toFixed(0)}% of the time.</span>
      </div>
      <div class="delta-key"><span>Survivors</span><span>Final Top ${comparison.funnelSize}</span><span>Difference</span></div>
      <div class="delta-list">${meaningful.length ? meaningful.map((row) => `<div class="delta-row">
        <span class="delta-name">${manaPipsHtml(row.name)}<b>${esc(row.name)}</b></span>
        <span>${row.aliveCount} <small>${row.aliveShare.toFixed(1)}%</small></span>
        <span>${row.funnelCount} <small>${row.funnelShare.toFixed(1)}%</small></span>
        <strong class="${row.delta > 0 ? "positive" : row.delta < 0 ? "negative" : ""}">${row.delta > 0 ? "+" : ""}${row.delta.toFixed(1)} pp</strong>
      </div>`).join("") : `<p class="same-composition">The two populations have the same archetype composition.</p>`}</div>`;
    };
    roundsHost.innerHTML = comparisons.map((comparison, index) => `<button type="button" data-index="${index}" class="${comparison === peak ? "active" : ""}">
      <span>${comparison.snapshot.round ? `R${comparison.snapshot.round}` : "Field"}</span>
      <small>${comparison.aliveSize} players</small>
      <i><b style="width:${comparison.distance / maxDistance * 100}%"></b><em style="left:${comparison.nullMeanPct / maxDistance * 100}%" title="${comparison.nullMeanPct.toFixed(1)}% average after random shuffling"></em></i>
      <strong>${comparison.distance.toFixed(1)}%</strong>
    </button>`).join("");
    roundsHost.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-index]");
      if (button) showComparison(Number(button.dataset.index));
    });
    showComparison(comparisons.indexOf(peak));
  };
  const renderAlive = (item, index) => {
    const snapshot = snapshots[index];
    const isOther = item.name === otherName;
    const players = fullPlayers.filter((player) => {
      const archetypeMatches = isOther
        ? !visibleNameSet.has(player.normalizedArchetype)
        : player.normalizedArchetype === item.name;
      return archetypeMatches && isAliveAt(player, snapshot.round);
    }).sort((a, b) => (survivorRanks.get(a.id) ?? 9999) - (survivorRanks.get(b.id) ?? 9999)
      || (a.final?.rank ?? 9999) - (b.final?.rank ?? 9999)
      || a.name.localeCompare(b.name));
    const stageLabel = snapshot.round ? `After round ${snapshot.round}` : "Starting field";
    const titlePips = isOther ? "" : manaPipsHtml(item.name);
    const archetypeHeader = isOther ? "<th>Archetype</th>" : "";
    const rows = players.map((player) => {
      const finalRecord = player.final?.matchRecord || "-";
      const lastStanding = lastLiveStanding(player);
      const survivorBand = survivorBands.get(lastLiveRound(player));
      const decklistUrl = player.decklistId ? `https://melee.gg/Decklist/View/${encodeURIComponent(player.decklistId)}` : "";
      return `<tr>
        <td class="player-name">${esc(player.name)}</td>
        ${isOther ? `<td><span class="archetype-cell">${manaPipsHtml(player.normalizedArchetype)}<span>${esc(player.normalizedArchetype)}</span></span></td>` : ""}
        <td class="survivor-band-cell">R${survivorBand.round} <small>(${survivorBand.start}&ndash;${survivorBand.end})</small></td>
        <td class="rank-cell">${player.final?.rank ? `#${player.final.rank}` : "-"}</td>
        <td class="tiebreak-cell">${formatTiebreak(lastStanding?.omw)}</td>
        <td class="tiebreak-cell">${formatTiebreak(lastStanding?.gw)}</td>
        <td class="tiebreak-cell">${formatTiebreak(lastStanding?.ogw)}</td>
        <td class="record-cell">${esc(recordAt(player, snapshot.round))}</td>
        <td class="final-cell">${esc(finalRecord)}</td>
        <td class="deck-cell">${decklistUrl ? `<a href="${decklistUrl}" target="_blank" rel="noopener">View deck</a>` : "Unavailable"}</td>
      </tr>`;
    }).join("");
    alivePanel.innerHTML = `<div class="alive-heading" style="--active-color:${item.color}">
      <div>
        <div class="alive-title-pips">${titlePips}<h3>${esc(item.name)}</h3></div>
        <p>${stageLabel} · ${players.length} ${players.length === 1 ? "deck" : "decks"} still alive</p>
      </div>
      <button class="alive-close" type="button" aria-label="Close deck list" title="Close">&times;</button>
    </div>
    <div class="alive-table-wrap">
      <table class="alive-table">
        <thead><tr><th>Player</th>${archetypeHeader}<th>Survivor rank</th><th>Tourney rank</th><th title="Opponent match-win percentage">OMW</th><th title="Game-win percentage">GW</th><th title="Opponent game-win percentage">OGW</th><th>${snapshot.round ? `Record after R${snapshot.round}` : "Record"}</th><th>Final record</th><th>Decklist</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="${isOther ? 10 : 9}" class="no-decks">No decks remained alive in this slice.</td></tr>`}</tbody>
      </table>
    </div>
    <p class="rank-note">Survivor rank is grouped by each player&rsquo;s last round alive; the range shows where that round falls in the 248-player survival order. OMW, GW, and OGW are Melee&rsquo;s tiebreakers at the player&rsquo;s last alive standing. Matches after crossing the X-1-1 threshold do not count.</p>`;
    alivePanel.classList.add("visible");
    alivePanel.querySelector(".alive-close").addEventListener("click", () => {
      alivePanel.classList.remove("visible");
      svg.querySelectorAll(".area-band.selected").forEach((band) => band.classList.remove("selected"));
      selectedIndex = null;
      rule.classList.remove("selected");
      rule.classList.remove("visible");
    });
  };
  const showValue = (item, index) => {
    const value = item.values[index];
    const snapshot = snapshots[index];
    readout.style.setProperty("--active-color", item.color);
    readout.classList.add("active");
    readout.innerHTML = `<strong>${esc(item.name)}</strong><span>${snapshot.round ? `Round ${snapshot.round}` : "Starting field"} · ${value.count} of ${snapshot.survivors} players · ${value.share.toFixed(1)}%</span>`;
    rule.setAttribute("x1", x(index));
    rule.setAttribute("x2", x(index));
    rule.classList.add("visible");
    svg.classList.add("chart-hovering");
  };
  const clearHover = () => {
    svg.querySelectorAll(".area-band.highlighted").forEach((band) => band.classList.remove("highlighted"));
    readout.classList.remove("active");
    readout.innerHTML = "<strong>Explore the field</strong><span>Hover a region for its round-by-round share.</span>";
    if (selectedIndex == null) {
      rule.classList.remove("visible");
    } else {
      rule.setAttribute("x1", x(selectedIndex));
      rule.setAttribute("x2", x(selectedIndex));
      rule.classList.add("visible", "selected");
    }
    svg.classList.remove("chart-hovering");
  };
  svg.addEventListener("pointermove", (pointerEvent) => {
    const group = pointerEvent.target.closest(".edge-label-group");
    if (group) {
      const item = seriesByName.get(group.dataset.archetype);
      svg.querySelectorAll(".area-band.highlighted").forEach((band) => band.classList.remove("highlighted"));
      svg.querySelector(`.area-band[data-archetype="${CSS.escape(item.name)}"]`)?.classList.add("highlighted");
      showValue(item, Number(group.dataset.stageIndex));
      return;
    }
    const band = pointerEvent.target.closest(".area-band");
    if (!band) return;
    const rect = svg.getBoundingClientRect();
    const svgX = (pointerEvent.clientX - rect.left) / rect.width * width;
    const index = Math.max(0, Math.min(snapshots.length - 1, Math.round((svgX - margin.left) / step)));
    const item = seriesByName.get(band.dataset.archetype);
    showValue(item, index);
  });
  svg.addEventListener("pointerout", (pointerEvent) => {
    const group = pointerEvent.target.closest(".edge-label-group");
    if (!group || pointerEvent.relatedTarget?.closest?.(".edge-label-group") === group) return;
    clearHover();
  });
  svg.addEventListener("pointerleave", clearHover);
  svg.addEventListener("click", (clickEvent) => {
    const group = clickEvent.target.closest(".edge-label-group");
    const band = clickEvent.target.closest(".area-band");
    if (!group && !band) return;
    const item = seriesByName.get((group || band).dataset.archetype);
    let index = Number(group?.dataset.stageIndex);
    if (!group) {
      const rect = svg.getBoundingClientRect();
      const svgX = (clickEvent.clientX - rect.left) / rect.width * width;
      index = Math.max(0, Math.min(snapshots.length - 1, Math.round((svgX - margin.left) / step)));
    }
    svg.querySelectorAll(".area-band.selected").forEach((selected) => selected.classList.remove("selected"));
    svg.querySelector(`.area-band[data-archetype="${CSS.escape(item.name)}"]`)?.classList.add("selected");
    selectedIndex = index;
    rule.setAttribute("x1", x(index));
    rule.setAttribute("x2", x(index));
    rule.classList.add("visible", "selected");
    renderAlive(item, index);
  });
  renderComparison();
}

function renderVariance(data) {
  const overview = document.querySelector("#variance-overview");
  const select = document.querySelector("#variance-archetype");
  const summary = document.querySelector("#variance-summary");
  const svg = document.querySelector("#variance-umap");
  const readout = document.querySelector("#umap-readout");
  const cardShifts = document.querySelector("#card-shifts");
  const archetypes = data.archetypes;
  const byName = new Map(archetypes.map((archetype) => [archetype.name, archetype]));
  const manaPips = (name) => (MANA_BY_ARCHETYPE[name] || []).map((mana) =>
    `<img src="mana/${mana}.svg" alt="${mana}" width="14" height="14">`
  ).join("");
  const maxDistance = Math.max(15, Math.ceil(Math.max(...archetypes.flatMap((archetype) => [
    archetype.events.Genesis.meanPairSlots,
    archetype.events.Geddon.meanPairSlots,
  ])) / 5) * 5);
  const position = (value) => Math.max(0, Math.min(100, value / maxDistance * 100));
  const axisValues = Array.from({ length: 4 }, (_, index) => maxDistance * index / 3);

  overview.style.setProperty("--distance-max", maxDistance);
  overview.innerHTML = `<div class="variance-axis-row" aria-hidden="true"><span></span><span class="variance-axis-labels">${axisValues.map((value) => `<i>${value.toFixed(0)}</i>`).join("")}</span><span></span></div>${archetypes.map((archetype) => {
    const genesis = archetype.events.Genesis.meanPairSlots;
    const geddon = archetype.events.Geddon.meanPairSlots;
    const left = Math.min(position(genesis), position(geddon));
    const width = Math.abs(position(geddon) - position(genesis));
    return `<button class="variance-row" type="button" data-archetype="${esc(archetype.name)}">
      <span class="variance-name">${manaPips(archetype.name)}<b>${esc(archetype.name)}</b></span>
      <span class="distance-track">
        <span class="distance-axis"><i></i><i></i><i></i><i></i></span>
        <span class="distance-connector" style="left:${left}%;width:${width}%"></span>
        <span class="distance-dot genesis" style="left:${position(genesis)}%"></span>
        <span class="distance-dot geddon" style="left:${position(geddon)}%"></span>
      </span>
      <span class="distance-values"><span>${genesis.toFixed(1)}</span><span>${geddon.toFixed(1)}</span></span>
    </button>`;
  }).join("")}`;
  select.innerHTML = archetypes.map((archetype) => `<option value="${esc(archetype.name)}">${esc(archetype.name)}</option>`).join("");

  const renderCards = (archetype) => {
    const cards = archetype.cards.slice(0, 10);
    cardShifts.innerHTML = `<div class="card-shift-head"><span>Card</span><span>Genesis</span><span>Geddon</span><span>Shift</span></div>${cards.map((card) => {
      const genesis = card.Genesis;
      const geddon = card.Geddon;
      const deltaClass = card.deltaPct > 0 ? "more-genesis" : card.deltaPct < 0 ? "more-geddon" : "";
      return `<div class="card-shift-row">
        <span class="card-shift-name"><strong>${esc(card.name)}</strong><small>${esc(card.type)}</small></span>
        <span class="card-event-value"><strong>${genesis.prevalencePct.toFixed(1)}%</strong><small>${genesis.decks} of ${archetype.events.Genesis.decks} · ${genesis.averageWhenPlayed.toFixed(1)}×</small></span>
        <span class="card-event-value"><strong>${geddon.prevalencePct.toFixed(1)}%</strong><small>${geddon.decks} of ${archetype.events.Geddon.decks} · ${geddon.averageWhenPlayed.toFixed(1)}×</small></span>
        <strong class="card-delta ${deltaClass}">${card.deltaPct > 0 ? "+" : ""}${card.deltaPct.toFixed(1)} pp</strong>
      </div>`;
    }).join("")}`;
  };

  const renderUmap = (archetype) => {
    const width = 720;
    const height = 460;
    const margin = 30;
    const xs = archetype.points.map((point) => point.x);
    const ys = archetype.points.map((point) => point.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const xRange = maxX - minX || 1;
    const yRange = maxY - minY || 1;
    const x = (value) => margin + (value - minX) / xRange * (width - margin * 2);
    const y = (value) => height - margin - (value - minY) / yRange * (height - margin * 2);
    const grid = [0.25, 0.5, 0.75].map((share) => `<line class="umap-grid" x1="${margin + share * (width - margin * 2)}" x2="${margin + share * (width - margin * 2)}" y1="${margin}" y2="${height - margin}" />
      <line class="umap-grid" x1="${margin}" x2="${width - margin}" y1="${margin + share * (height - margin * 2)}" y2="${margin + share * (height - margin * 2)}" />`).join("");
    const ordered = [...archetype.points].sort((a, b) => (a.event === "Geddon" ? -1 : 1) - (b.event === "Geddon" ? -1 : 1) || b.count - a.count);
    const points = ordered.map((point) => {
      const offset = point.event === "Genesis" ? -3 : 3;
      const cx = x(point.x) + offset;
      const cy = y(point.y);
      const radius = Math.min(16, 5 + Math.sqrt(point.count) * 1.55);
      const personal = point.player?.toLowerCase() === "swelden" ? " personal" : "";
      const common = `class="umap-point ${point.event.toLowerCase()}${personal}" data-event="${point.event}" data-label="${esc(point.label)}" data-count="${point.count}" data-player="${esc(point.player || "")}"`;
      if (point.event === "Genesis") {
        return `<circle ${common} cx="${cx}" cy="${cy}" r="${radius}" />`;
      }
      const side = radius * 1.55;
      return `<rect ${common} x="${cx - side / 2}" y="${cy - side / 2}" width="${side}" height="${side}" rx="1" transform="rotate(45 ${cx} ${cy})" />`;
    }).join("");
    svg.innerHTML = `${grid}${points}<text class="umap-axis-note" x="${width - margin}" y="${height - 9}" text-anchor="end">Nearer points use more similar cards</text>`;
    readout.classList.remove("active");
    readout.innerHTML = "<strong>Hover a point</strong><span>Repeated identical lists are drawn larger.</span>";
  };

  const renderStockSuccess = (analysis) => {
    const chart = document.querySelector("#stock-survival-chart");
    const stockKey = document.querySelector("#stock-key");
    const stockReadout = document.querySelector("#stock-readout");
    const styles = [
      { color: "#2167ae", shape: "circle", className: "most" },
      { color: "#758395", shape: "square", className: "middle" },
      { color: "#d65b32", shape: "diamond", className: "least" },
    ];
    const width = 1120;
    const height = 420;
    const margin = { left: 62, right: 28, top: 20, bottom: 52 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const x = (index) => margin.left + index * plotWidth / (analysis.rounds.length - 1);
    const y = (value) => margin.top + (100 - value) * plotHeight / 100;
    const horizontalGrid = [0, 50, 100].map((value) => `<line class="stock-grid" x1="${margin.left}" x2="${width - margin.right}" y1="${y(value)}" y2="${y(value)}" />
      <text class="stock-axis-label" x="${margin.left - 10}" y="${y(value) + 4}" text-anchor="end">${value}%</text>`).join("");
    const verticalGrid = analysis.rounds.map((round, index) => `<line class="stock-grid" x1="${x(index)}" x2="${x(index)}" y1="${margin.top}" y2="${height - margin.bottom}" />
      <text class="stock-axis-label" x="${x(index)}" y="${height - 20}" text-anchor="middle">${round ? `R${round}` : "Field"}</text>`).join("");
    const lines = analysis.groups.map((group, groupIndex) => {
      const style = styles[groupIndex];
      const points = group.alivePctByRound.map((value, index) => [x(index), y(value)]);
      const marks = points.map(([cx, cy]) => {
        if (style.shape === "circle") {
          return `<circle class="stock-point" cx="${cx}" cy="${cy}" r="5" fill="${style.color}" />`;
        }
        if (style.shape === "diamond") {
          return `<rect class="stock-point" x="${cx - 4.5}" y="${cy - 4.5}" width="9" height="9" fill="${style.color}" transform="rotate(45 ${cx} ${cy})" />`;
        }
        return `<rect class="stock-point" x="${cx - 4.5}" y="${cy - 4.5}" width="9" height="9" fill="${style.color}" />`;
      }).join("");
      return `<path class="stock-line ${style.className}" stroke="${style.color}" d="M${points.map((point) => point.join(",")).join(" L")}" />${marks}`;
    }).join("");
    stockKey.innerHTML = analysis.groups.map((group, index) => `<span><i class="${styles[index].shape}" style="--series-color:${styles[index].color}"></i>${esc(group.name)} <small>(${group.decks})</small></span>`).join("");
    chart.innerHTML = `${horizontalGrid}${verticalGrid}${lines}<line class="stock-hover-rule" x1="0" x2="0" y1="${margin.top}" y2="${height - margin.bottom}" />
      <rect class="stock-chart-hit" x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${plotHeight}" />`;
    const rule = chart.querySelector(".stock-hover-rule");
    const showRound = (index) => {
      const round = analysis.rounds[index];
      rule.setAttribute("x1", x(index));
      rule.setAttribute("x2", x(index));
      rule.classList.add("visible");
      stockReadout.innerHTML = `<strong>${round ? `After Round ${round}` : "Starting field"}</strong><span class="stock-readout-values">${analysis.groups.map((group) => `<span><b>${esc(group.name)}:</b> ${group.alivePctByRound[index].toFixed(1)}%</span>`).join("")}</span>`;
    };
    chart.addEventListener("pointermove", (event) => {
      const bounds = chart.getBoundingClientRect();
      const svgX = (event.clientX - bounds.left) / bounds.width * width;
      const index = Math.max(0, Math.min(analysis.rounds.length - 1, Math.round((svgX - margin.left) / plotWidth * (analysis.rounds.length - 1))));
      showRound(index);
    });
    chart.addEventListener("pointerleave", () => {
      rule.classList.remove("visible");
      stockReadout.innerHTML = "<strong>Compare the curves</strong><span>Hover a round for the surviving share of each group.</span>";
    });
  };

  const showArchetype = (name) => {
    const archetype = byName.get(name);
    if (!archetype) return;
    select.value = name;
    overview.querySelectorAll(".variance-row").forEach((row) => {
      row.classList.toggle("active", row.dataset.archetype === name);
    });
    const genesis = archetype.events.Genesis;
    const geddon = archetype.events.Geddon;
    const delta = geddon.meanPairSlots - genesis.meanPairSlots;
    const direction = Math.abs(delta) < 0.05
      ? "The two events are essentially even."
      : `Paupergeddon lists average ${Math.abs(delta).toFixed(1)} ${Math.abs(delta).toFixed(1) === "1.0" ? "slot" : "slots"} ${delta < 0 ? "closer together" : "farther apart"}.`;
    summary.textContent = `${genesis.decks} Genesis decks · ${geddon.decks} Paupergeddon decks. ${direction}`;
    renderUmap(archetype);
    renderCards(archetype);
  };

  overview.addEventListener("click", (event) => {
    const row = event.target.closest(".variance-row");
    if (row) showArchetype(row.dataset.archetype);
  });
  select.addEventListener("change", () => showArchetype(select.value));
  svg.addEventListener("pointermove", (event) => {
    const point = event.target.closest(".umap-point");
    if (!point) return;
    svg.querySelectorAll(".umap-point.active").forEach((item) => item.classList.remove("active"));
    point.classList.add("active");
    svg.classList.add("umap-hovering");
    const eventName = point.dataset.event === "Genesis" ? "Paupergenesis" : "Paupergeddon";
    const personal = point.dataset.player.toLowerCase() === "swelden" ? " · my list" : "";
    readout.style.setProperty("--readout-color", point.dataset.event === "Genesis" ? "#2167ae" : "#d65b32");
    readout.classList.add("active");
    readout.innerHTML = `<strong>${esc(point.dataset.label)}</strong><span>${eventName}${personal}${Number(point.dataset.count) > 1 ? ` · ${point.dataset.count} exact copies` : ""}</span>`;
  });
  svg.addEventListener("pointerleave", () => {
    svg.querySelectorAll(".umap-point.active").forEach((point) => point.classList.remove("active"));
    svg.classList.remove("umap-hovering");
    readout.classList.remove("active");
    readout.innerHTML = "<strong>Hover a point</strong><span>Repeated identical lists are drawn larger.</span>";
  });

  showArchetype(byName.has("Mono Red Madness") ? "Mono Red Madness" : archetypes[0].name);
  renderStockSuccess(data.stockSuccess);
}

Promise.all([DATA_URL, EVENT_DATA_URL, COMPARISON_DATA_URL].map((url) => fetch(url).then((response) => {
  if (!response.ok) throw new Error(`Cached data request failed (${response.status})`);
  return response.json();
})))
  .then(([data, eventData, comparisonData]) => render(data, eventData, comparisonData))
  .catch((error) => {
    document.querySelector(".chart-panel").innerHTML = `<div class="error">Could not load the cached survivorship data: ${esc(error.message)}</div>`;
  });

fetch(VARIANCE_DATA_URL)
  .then((response) => {
    if (!response.ok) throw new Error(`Cached comparison request failed (${response.status})`);
    return response.json();
  })
  .then(renderVariance)
  .catch((error) => {
    document.querySelector(".archetype-explorer").innerHTML = `<div class="variance-error">Could not load the Genesis and Paupergeddon comparison: ${esc(error.message)}</div>`;
  });
