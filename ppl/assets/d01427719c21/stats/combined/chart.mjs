import { svgElement } from "/ppl/assets/d01427719c21/ui/charts/svg.mjs";
import { linearScale } from "/ppl/assets/d01427719c21/ui/charts/scales.mjs";
import { drawYAxis } from "/ppl/assets/d01427719c21/ui/charts/axes.mjs";
import { positionLabels } from "/ppl/assets/d01427719c21/ui/charts/labels.mjs";
import { date, fmt } from "./format.mjs";
import { bindPointInteraction } from "./chart-interactions.mjs";
export function renderEloChart(
  svg,
  container,
  model,
  { compact, color, onInspect, showEndLabels = true, height: requestedHeight },
) {
  svg.replaceChildren();
  const width = Math.max(300, container.clientWidth - (compact ? 8 : 24));
  const height = requestedHeight ?? (compact ? 365 : 420);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const { players, slots, bands, min, max, mode } = model;
  const endpoints = showEndLabels && width > 610 && players.length <= 6;
  const margin = { left: 43, right: endpoints ? 115 : 22, top: 47, bottom: 51 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const x = linearScale(
    [0, Math.max(1, slots.length - 1)],
    [margin.left, margin.left + plotW],
  );
  const y = linearScale([min, max], [margin.top + plotH, margin.top]);
  drawEventHighlights(svg, bands, { mode, plotW, plotH, slots, x, margin });
  const increment = max - min > 200 ? 50 : 25;
  const ticks = [];
  for (
    let value = Math.ceil(min / increment) * increment;
    value <= max;
    value += increment
  )
    ticks.push(value);
  drawYAxis(svg, {
    ticks,
    scale: y,
    left: margin.left,
    right: width - margin.right,
    baseline: 1200,
  });
  drawDateAxis(svg, bands, { mode, width, height, plotW, x, margin });
  const labels = [];
  for (const { player, samples, segments, endpoint } of players) {
    drawPlayer(svg, {
      player,
      samples,
      segments,
      x,
      y,
      mode,
      color,
      onInspect,
    });
    if (endpoint)
      labels.push({
        p: player,
        x: x(endpoint.position),
        targetY: y(endpoint.rating),
      });
  }
  if (endpoints)
    drawPlayerLabels(svg, labels, { width, height, margin, color });
  if (!players.length)
    svg.append(
      svgElement(
        "text",
        {
          x: width / 2,
          y: height / 2,
          "text-anchor": "middle",
          class: "ui-chart__axis-label",
        },
        "Choose players to explore their ratings.",
      ),
    );
}

function drawPlayer(
  svg,
  { player, samples, segments, x, y, mode, color, onInspect },
) {
  for (const segment of segments) {
    const attributes = {
      d: `M${x(segment.from)},${y(segment.startRating)} L${x(segment.to)},${y(segment.endRating)}`,
      stroke: color(player.player),
      class: "ui-chart__line",
    };
    if (segment.inactive)
      Object.assign(attributes, { "stroke-dasharray": "4 5", opacity: ".55" });
    svg.append(svgElement("path", attributes));
  }
  const points = [];
  for (const sample of samples) {
    const point = svgElement("circle", {
      cx: x(sample.position),
      cy: y(sample.rating),
      r: mode === "round" ? 3.1 : 4,
      fill: color(player.player),
      class: "ui-chart__point",
      tabindex: points.length === 0 ? "0" : "-1",
      role: "button",
      "aria-label": `${player.player}, ${date(sample.date)}, ${sample.label}, Elo ${fmt(sample.rating)}`,
    });
    point.append(
      svgElement(
        "title",
        {},
        `${player.player} · ${date(sample.date)} · ${fmt(sample.rating)}`,
      ),
    );
    bindPointInteraction(point, points, () => onInspect(player, sample.index));
    points.push(point);
    svg.append(point);
  }
}

function drawEventHighlights(
  svg,
  bands,
  { mode, plotW, plotH, slots, x, margin },
) {
  for (const band of bands) {
    if (!band.special) continue;
    const first = band.positions[0],
      last = band.positions.at(-1);
    const padding =
      mode === "event" ? (plotW / Math.max(1, slots.length - 1)) * 0.35 : 0;
    const start = x(first) - padding,
      end = x(last) + padding;
    svg.append(
      svgElement("rect", {
        x: start,
        y: margin.top - 6,
        width: end - start,
        height: plotH + 6,
        fill: "#eef3f8",
      }),
    );
    svg.append(
      svgElement(
        "text",
        {
          x: (start + end) / 2,
          y: 24,
          "text-anchor": "middle",
          class: "ui-chart__axis-label",
        },
        "Win-a-Box",
      ),
    );
  }
}

function drawDateAxis(svg, bands, { mode, width, height, plotW, x, margin }) {
  const small = width < 520;
  bands.forEach((band, e) => {
    const first = band.positions[0],
      last = band.positions.at(-1);
    const pos = mode === "event" ? last : (first + last) / 2;
    const labelY = height - 24 + (small && e % 2 ? 14 : 0);
    const labelEvery = Math.max(1, Math.ceil(bands.length / (plotW / 65)));
    if (e % labelEvery === 0 || e === bands.length - 1)
      svg.append(
        svgElement(
          "text",
          {
            x: x(pos),
            y: labelY,
            "text-anchor": "middle",
            class: "ui-chart__axis-label",
          },
          date(band.date),
        ),
      );
    if (mode === "round")
      svg.append(
        svgElement("line", {
          x1: x(first),
          x2: x(first),
          y1: margin.top,
          y2: height - margin.bottom,
          stroke: "#d9e1ea",
          "stroke-dasharray": "2 5",
        }),
      );
  });
}

function drawPlayerLabels(svg, labels, { width, height, margin, color }) {
  const labelX = width - margin.right + 22;
  const placedLabels = positionLabels(labels, {
    top: margin.top + 13,
    bottom: height - margin.bottom - 14,
  });
  for (const label of placedLabels) {
    svg.append(
      svgElement("path", {
        d: `M${label.x + 5},${label.targetY} L${labelX - 10},${label.y} L${labelX - 5},${label.y}`,
        stroke: color(label.p.player),
        fill: "none",
        "stroke-width": 1,
        opacity: 0.5,
      }),
    );
    svg.append(
      svgElement(
        "text",
        {
          x: labelX,
          y: label.y - 3,
          fill: color(label.p.player),
          class: "ui-chart__end-label",
        },
        label.p.player,
      ),
    );
    svg.append(
      svgElement(
        "text",
        { x: labelX, y: label.y + 11, class: "ui-chart__axis-label" },
        fmt(label.p.elo),
      ),
    );
  }
}
