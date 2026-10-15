const storeLogos = {
  7679: new URL('./atomic-empire.svg', import.meta.url).href,
  15582: new URL('./dragons-hoard.png', import.meta.url).href,
};

const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );

export function renderTrophy({ storeId, storeName, date, record, showDate = false }) {
  const formattedDate = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const title = escapeHtml(`${storeName} · ${formattedDate} · ${record}`);
  const logo = storeLogos[storeId];
  const icon = logo
    ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(storeName)}">`
    : '<span aria-hidden="true">🏆</span>';
  const label = showDate ? `<span>${formattedDate}</span>` : '';
  return `<span class="award" tabindex="0" aria-label="${title}">${icon}${label}<span class="tip" role="tooltip">${title}</span></span>`;
}
