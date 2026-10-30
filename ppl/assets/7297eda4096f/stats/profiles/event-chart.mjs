import { playerChartPoints } from "./profile-data.mjs";
import { eventRatingChange } from "../combined/event-rating.mjs";
import { escapeHtml as esc, formatDate as date } from "./ui.mjs?v=d6ea6427d4b5";
import { fmt, delta as signed } from "../combined/format.mjs";

export function renderProfileEventChart(
  svg,
  container,
  inspection,
  data,
  player,
) {
  const points = playerChartPoints(data, player);
  const entries = points
    .filter((point) => !point.start)
    .map((point) => point.event);
  if (!points.length) {
    svg.replaceChildren();
    svg.setAttribute("aria-label", `${player.player} has no Elo history`);
    inspection.textContent = "";
    return;
  }
  const compact = innerWidth <= 760;
  const width = Math.max(300, container.clientWidth - (compact ? 8 : 24)),
    height = svg.getBoundingClientRect().height;
  const left = 42,
    right = width - 16,
    top = 14,
    bottom = height - 30;
  const min =
    Math.floor((Math.min(...points.map((p) => p.value)) - 10) / 25) * 25;
  const max =
    Math.ceil((Math.max(...points.map((p) => p.value)) + 10) / 25) * 25;
  const x = (i) => left + (i / Math.max(1, points.length - 1)) * (right - left);
  const y = (value) => bottom - ((value - min) / (max - min)) * (bottom - top);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute(
    "aria-label",
    `${player.player} Elo by event, ${date(entries[0].date)} through ${date(entries.at(-1).date)}`,
  );
  const ticks = Array.from(
    { length: 5 },
    (_, i) => min + ((max - min) * i) / 4,
  );
  let content = ticks
    .map(
      (v) =>
        `<line x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}" stroke="#e8edf2"/><text x="${left - 8}" y="${y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`,
    )
    .join("");
  content += `<path d="${points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ")}" fill="none" stroke="#2167ae" stroke-width="2"/>`;
  const interval = Math.max(
    1,
    Math.ceil(entries.length / (width < 500 ? 3 : 6)),
  );
  points.forEach((p, i) => {
    const label = `${date(p.event.date)} · ${data.stores[p.event.storeId]} · ${p.start ? "Start" : "Finish"} · ${fmt(p.value)} Elo${p.start ? "" : ` (${signed(eventRatingChange(data, player, p.event.eventId))})`}`;
    content += `<circle cx="${x(i)}" cy="${y(p.value)}" r="${p.start ? 3 : 4}" tabindex="0" data-label="${esc(label)}" aria-label="${esc(label)}"><title>${esc(label)}</title></circle>`;
    if (!p.start && ((i - 1) % interval === 0 || i === points.length - 1))
      content += `<text x="${x(i)}" y="${height - 7}" text-anchor="${i === points.length - 1 ? "end" : "middle"}">${date(p.event.date)}</text>`;
  });
  svg.innerHTML = content;
  inspection.textContent = "";
}
