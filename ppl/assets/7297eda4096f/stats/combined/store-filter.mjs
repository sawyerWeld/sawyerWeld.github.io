import { esc } from "./format.mjs";

export function renderStoreFilter(container, stores, selected) {
  const sortedStores = Object.entries(stores).sort(([, a], [, b]) => a.localeCompare(b));
  container.innerHTML = [["all", "All stores"], ...sortedStores]
    .map(
      ([id, name]) =>
        `<button type="button" data-store="${esc(id)}" aria-pressed="${id === selected}">${esc(name)}</button>`,
    )
    .join("");
}
