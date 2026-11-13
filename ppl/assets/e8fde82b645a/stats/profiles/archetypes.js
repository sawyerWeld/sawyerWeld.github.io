import { element as $, escapeHtml as esc, formatDate, loadLeagueData, loadDeckImages, archetypeUrl } from './ui.mjs';
import { archetypeProfile } from './archetype-stats.mjs';
import { archetype } from './metagame-stats.mjs';

const percent = value => value == null ? '—' : `${(value * 100).toFixed(1)}%`;
const record = ({ wins, losses, draws }) => `${wins}–${losses}–${draws}`;
const playerLink = name => `<a href="/ppl/player.html?player=${encodeURIComponent(name)}">${esc(name)}</a>`;
const pageSize = 10;
let data, images, name, profile, page = 0;

function art(name, className = 'deck-art') {
  const image = Object.hasOwn(images, name) ? images[name] : null;
  if (!image?.url?.startsWith('https://')) return '';
  return `<img class="${className}" src="${esc(image.url)}" alt="" title="${esc(image.card)} · ${esc(image.artist)}"${className === 'deck-art' ? ' loading="lazy"' : ''}>`;
}

function deckLink(name) {
  const label = `${art(name)}<span>${esc(name)}</span>`;
  return name === 'Unknown' ? `<span class="deck-link">${label}</span>`
    : `<a class="deck-link" href="${esc(archetypeUrl(name))}">${label}</a>`;
}

function metric(label, value, detail, title = '') {
  return `<div${title ? ` title="${esc(title)}"` : ''}><dt class="sr-only">${label}</dt><dd>${value}<small>${detail}</small></dd></div>`;
}

function renderOverview() {
  const matchTitle = `${record(profile.matchRecord)}. Played matches only. Draws count as half a win; byes, intentional draws, and administrative results are excluded.`;
  const entries = `${profile.entryCount} ${profile.entryCount === 1 ? 'entry' : 'entries'}`;
  $('overview').innerHTML = `<dl class="headline-metrics">
    ${metric('MW%', percent(profile.mw), record(profile.matchRecord), matchTitle)}
    ${metric('Of field', percent(profile.fieldShare), entries, 'Share of all league entries')}
    ${metric('Pilots', profile.playerCount, profile.playerCount === 1 ? 'pilot' : 'pilots')}
    ${metric('Trophies', profile.trophyCount, profile.trophyCount === 1 ? 'trophy' : 'trophies', 'Trophies earned with this archetype')}</dl>`;
}

function renderHighlights(rows, favorable) {
  if (!rows.length) return '<p class="empty">No qualifying matchups yet.</p>';
  return rows.map(row => `<div class="matchup-highlight">
    ${deckLink(row.name)}<span class="matchup-rate ${favorable ? 'favorable' : 'unfavorable'}">${percent(row.mw)}<small>${row.matchCount} matches · ${record(row.matchRecord)}</small></span>
  </div>`).join('');
}

function renderMatchups() {
  $('best-matchups').innerHTML = renderHighlights(profile.bestMatchups, true);
  $('worst-matchups').innerHTML = renderHighlights(profile.worstMatchups, false);
  $('matchups').innerHTML = profile.matchups.map(row => `<tr>
    <td>${deckLink(row.name)}${row.isMirror ? '<span class="muted mirror-label">mirror</span>' : ''}</td>
    <td>${percent(row.mw)}</td><td>${record(row.matchRecord)}</td>
    <td${row.isMirror ? ' title="Mirror matches appear from both pilots’ perspectives"' : ''}>${row.matchCount}</td>
  </tr>`).join('') || '<tr><td class="empty" colspan="4">No played matches yet.</td></tr>';
}

function renderPilots() {
  $('best-pilots').innerHTML = profile.bestPilots.slice(0, 5).map(pilot => `<tr>
    <td>${playerLink(pilot.name)}</td><td>${percent(pilot.mw)}</td><td>${record(pilot.matchRecord)}</td><td>${pilot.eventCount}</td>
  </tr>`).join('') || '<tr><td class="empty" colspan="4">No qualifying pilots yet.</td></tr>';
  $('dedicated-pilots').innerHTML = profile.dedicatedPilots.slice(0, 5).map(pilot => `<tr>
    <td>${playerLink(pilot.name)}</td><td>${pilot.eventCount}</td><td>${record(pilot.matchRecord)}</td><td>${percent(pilot.mw)}</td>
  </tr>`).join('');
}

function renderAppearances() {
  const entries = profile.entries.slice(page * pageSize, (page + 1) * pageSize);
  $('appearances').innerHTML = entries.map(entry => `<tr>
    <td>${formatDate(entry.date, true)}<small><a href="/ppl/store.html?store=${encodeURIComponent(entry.storeId)}">${esc(data.stores[entry.storeId])}</a></small></td>
    <td>${playerLink(entry.player)}<small class="mobile-deck">${esc(entry.deck || name)}</small></td>
    <td>${esc(entry.deck || name)}</td><td title="Event record includes byes and intentional draws">${record(entry)}</td>
  </tr>`).join('');
  $('appearance-range').textContent = `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, profile.entryCount)} of ${profile.entryCount}`;
  $('previous').disabled = page === 0;
  $('next').disabled = (page + 1) * pageSize >= profile.entryCount;
}

function render() {
  // Profiles always cover the whole league, even when opened from a filtered metagame.
  history.replaceState(null, '', archetypeUrl(name));
  profile = archetypeProfile(data, name);
  $('profile').hidden = !profile;
  $('overview').hidden = !profile;
  $('status').hidden = !!profile;
  if (!profile) {
    $('status').textContent = 'No recorded entries for this archetype.';
    return;
  }
  page = 0;
  renderOverview();
  renderMatchups();
  renderPilots();
  renderAppearances();
}

$('previous').addEventListener('click', () => { page--; renderAppearances(); });
$('next').addEventListener('click', () => { page++; renderAppearances(); });

try {
  [data, images] = await Promise.all([loadLeagueData(), loadDeckImages()]);
  const params = new URLSearchParams(location.search);
  name = params.get('archetype');
  if (!name) {
    const counts = new Map();
    for (const entry of data.results) {
      const deck = archetype(entry);
      if (deck) counts.set(deck, (counts.get(deck) || 0) + 1);
    }
    name = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || 'Unknown';
  }
  document.title = `${name} | Piedmont Pauper League`;
  $('archetype-name').textContent = name;
  $('archetype-art').innerHTML = art(name, 'hero-art');
  $('archetype-art').hidden = !images[name];
  render();
} catch (error) {
  $('status').hidden = true;
  $('error').hidden = false;
  $('error').textContent = error.message;
}
