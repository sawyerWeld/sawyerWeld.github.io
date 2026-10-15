export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const fmt = (n) => Number(n).toFixed(1);
export const delta = (n) => `${n > 0 ? "+" : ""}${fmt(n)}`;
export const date = (value) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
export const signedClass = (value) =>
  value > 0 ? "positive" : value < 0 ? "negative" : "";
