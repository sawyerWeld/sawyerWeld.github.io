import { svgElement } from "./svg.mjs";

/** Caller chooses ticks and baseline; the kit only draws them. */
export function drawYAxis(
  svg,
  { ticks, scale, left, right, baseline, format = String },
) {
  for (const value of ticks) {
    svg.append(
      svgElement("line", {
        x1: left,
        x2: right,
        y1: scale(value),
        y2: scale(value),
        class:
          value === baseline
            ? "ui-chart__grid ui-chart__baseline"
            : "ui-chart__grid",
      }),
    );
    svg.append(
      svgElement(
        "text",
        {
          x: left - 10,
          y: scale(value) + 4,
          "text-anchor": "end",
          class: "ui-chart__axis-label",
        },
        format(value),
      ),
    );
  }
  if (baseline != null && !ticks.includes(baseline)) {
    svg.append(
      svgElement("line", {
        x1: left,
        x2: right,
        y1: scale(baseline),
        y2: scale(baseline),
        class: "ui-chart__baseline",
      }),
    );
  }
}
