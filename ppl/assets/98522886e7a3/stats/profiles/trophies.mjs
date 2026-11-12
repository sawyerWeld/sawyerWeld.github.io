const storeLogoPaths = {
  7679: './atomic-empire.svg',
  15582: './dragons-hoard.png',
  6696: '../../img/gamers-haunt.png',
};

function storeLogo(storeId, assetBase) {
  const path = storeLogoPaths[storeId];
  if (!path) return null;
  if (assetBase === undefined) return new URL(path, import.meta.url).href;
  // Server rendering supplies a browser asset directory instead of a file URL.
  const url = new URL(path, new URL(assetBase, 'https://assets.invalid/'));
  return url.origin === 'https://assets.invalid' ? url.pathname : url.href;
}

const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );

export function renderTrophies(trophies, options) {
  return [...trophies]
    .sort((a, b) =>
      a.date.localeCompare(b.date) ||
      String(a.eventId ?? '').localeCompare(String(b.eventId ?? ''), 'en', { numeric: true }),
    )
    .map(trophy => renderTrophy(trophy, options))
    .join('');
}

export function renderTrophy({ storeId, storeName, date, record, showDate = false }, { assetBase } = {}) {
  const formattedDate = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const title = escapeHtml(`${storeName} · ${formattedDate} · ${record}`);
  const logo = storeLogo(storeId, assetBase);
  const icon = logo
    ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(storeName)}">`
    : '<span aria-hidden="true">🏆</span>';
  const label = showDate ? `<span>${formattedDate}</span>` : '';
  return `<span class="award" tabindex="0" aria-label="${title}">${icon}${label}<span class="tip" role="tooltip">${title}</span></span>`;
}
