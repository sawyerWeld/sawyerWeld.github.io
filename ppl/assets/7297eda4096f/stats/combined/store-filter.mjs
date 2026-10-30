import { esc } from "./format.mjs";

export function renderStoreFilter(container, stores, selected) {
  container.innerHTML = [["all", "All stores"], ...Object.entries(stores)]
    .map(
      ([id, name]) =>
        `<button type="button" data-store="${esc(id)}" aria-pressed="${id === selected}">${esc(name)}</button>`,
    )
    .join("");
}
