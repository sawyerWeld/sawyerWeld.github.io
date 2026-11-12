import { esc } from "../combined/format.mjs";

const percent = (rate) => rate == null ? "—" : `${(rate * 100).toFixed(1)}%`;
const record = ({ wins, losses, draws }) => `${wins}–${losses}–${draws}`;
const eventCount = (count) => `${count} ${count === 1 ? "event" : "events"}`;

function rateCell(rate, results, label, title, className = "") {
  return `<td${className ? ` class="${className}"` : ""} title="${esc(title)}">
    ${percent(rate)}${rate == null ? "" : `<span class="deck-rate-record"><span class="sr-only">${label} record: </span>${record(results)}</span>`}
  </td>`;
}

function rateCells(period, recent = false) {
  if (!period) {
    return `<td class="recent-start" title="No events with this archetype in the last 30 days">—</td>
      <td title="No events with this archetype in the last 30 days">—</td>`;
  }
  const matchCount = period.matchRecord.wins + period.matchRecord.losses + period.matchRecord.draws;
  const matchTitle = `${eventCount(period.eventCount)}; byes, intentional draws, and administrative results excluded`;
  const gameTitle = `Recorded games from ${period.scoredMatches} of ${matchCount} played matches; missing or inferred scores excluded`;
  return rateCell(period.mw, period.matchRecord, "Match", matchTitle, recent ? "recent-start" : "")
    + rateCell(period.gw, period.gameRecord, "Game", gameTitle);
}

function deckArt(images, name) {
  const image = Object.hasOwn(images, name) ? images[name] : null;
  if (!image?.url?.startsWith("https://")) {
    return '<span class="personal-deck-art" aria-hidden="true"></span>';
  }
  return `<img class="personal-deck-art" src="${esc(image.url)}" alt="" loading="lazy"
    title="${esc(image.card)} · ${esc(image.artist)}" width="44" height="34">`;
}

export function renderDeckStats({ rows, from, to }, playerName, images = {}) {
  if (!rows.length) return "";
  return `<section class="personal-decks" aria-labelledby="personal-decks-heading">
    <h2 id="personal-decks-heading">Deck stats</h2>
    <div class="personal-decks-frame">
      <table class="personal-decks-table" aria-label="${esc(playerName)}'s stats by archetype">
        <colgroup><col class="deck-name-column"><col><col><col><col></colgroup>
        <thead>
          <tr>
            <th class="deck-heading" scope="col" rowspan="2">Archetype</th>
            <th class="deck-period" scope="colgroup" colspan="2">All events</th>
            <th class="deck-period recent-start" scope="colgroup" colspan="2" title="Last 30 days: ${esc(from)}–${esc(to)}">Last month</th>
          </tr>
          <tr>
            <th scope="col"><abbr title="Match win percentage">MW%</abbr></th>
            <th scope="col"><abbr title="Game win percentage">GW%</abbr></th>
            <th class="recent-start" scope="col"><abbr title="Match win percentage over the last 30 days">MW%</abbr></th>
            <th scope="col"><abbr title="Game win percentage over the last 30 days">GW%</abbr></th>
          </tr>
        </thead>
        <tbody>${rows.map(row => `<tr>
          <th scope="row"><span class="personal-deck-label">
            ${deckArt(images, row.archetype)}
            <span>${esc(row.archetype)}<span class="personal-deck-events">${eventCount(row.all.eventCount)}</span></span>
          </span></th>
          ${rateCells(row.all)}${rateCells(row.recent, true)}
        </tr>`).join("")}</tbody>
      </table>
    </div>
  </section>`;
}
