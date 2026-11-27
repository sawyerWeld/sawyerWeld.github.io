# Top 8 generator draft

Unlisted draft at `/top8graphic/`. Do not add it to the homepage or tools listing until Sawyer approves the polished version. The HTML includes `noindex, nofollow`; the URL is publicly accessible, not access-controlled.

Buildless HTML, CSS, and JavaScript. Serve this repository with a static HTTP server. `app.js` renders both the live preview and the exported PNG on the same canvas. Sample players use fictional Sopranos character names. Example artwork is cached in `assets/`; `cards.json` keeps its card and artist metadata. Live search and alternate art use Scryfall's public API and CORS-enabled images. Artist and copyright credits are rendered into the PNG.

Drafts stay in localStorage under `sawyer-top8-draft-v1`. Nothing is submitted to a server except card searches and artwork requests. New artwork is loaded with anonymous CORS before drawing so PNG exports remain usable. Failed artwork produces a labeled placeholder and a warning.

Check changes with `node --check top8graphic/app.js`. Before promoting the draft, check the editor at desktop and phone widths in a browser, and download a PNG after choosing external artwork. At initial publication, browser automation was unavailable; interactions were checked in jsdom, artwork search against the live API, and PNG compositions with a native Canvas implementation. Browser layout and browser downloads remain to be checked.

The Design → Style control includes **Old border**. Its seven locally bundled frame variants follow card colors, with gold for multicolor and brown for colorless cards. See `assets/old-border/SOURCE.md` for provenance. Frames load on selection and reuse the existing image cache. Fitted frame layers are cached by color, dimensions, hero sizing, and credit placement with a 16 MiB least-recently-used limit, so subsequent edits avoid resampling the 1500 × 2100 textures. Export waits for frames, and a failed frame falls back to the standard treatment with a visible warning. Existing saved drafts retain their selected treatment.

New examples default to Smash style, Paper background, landscape canvas, and Podium layout with the Top 8 cut ranks (`1, 2, 3, 3, 5, 5, 5, 5`). Places remain individually editable in Players; the separate placings preset selector was removed. Existing saved placings and player data are preserved. Interface copy follows the concise controls in Mana Counter and the PPL archetype page. The optional poster footer starts empty.

Design → Art credits switches between **On cards** and **Footer**. Footer is the default and combines unique artist names, Wizards copyright, and source credits in a single compact block at bottom right. Existing drafts migrate once to this default without losing player data; subsequent choices persist. Event → Top-right text edits or clears the poster heading.

Design → Style includes **Smash**, based on the supplied Top 8 reference: large italic placements, red diagonal nameplates, square red outlines, full-bleed card art, and a Magic planeswalker watermark. It supports both layouts/canvas sizes, both backgrounds, player handles/records, editable headings, and either credit placement. Other styles and saved drafts are unchanged.

The page footer links “Sawyer Welden” to `/pauper/`, with expandable credits below. Drafts still save locally, without a status label or Reset control.

The former `/top8-draft/` URL has been removed. The localStorage key is unchanged so existing drafts carry over.

Per-player Zoom (100–200%) enlarges centered artwork in both the preview and PNG export. Previous Art position settings are ignored. Existing drafts without zoom start at 100%; changing artwork resets zoom.

Design → Text size (80–150%) scales all players’ names, decks, ranks, and details. Nameplates grow with the text across every style; artist credits and the event header keep their sizes. Existing drafts start at 100%. The setting persists and applies to PNG exports. Old-border layer cache keys include text size.

Players → Show top supports 2–16 entries, defaulting to 8. Reducing the count hides extra roster entries without deleting their names, artwork, zoom, or other edits. Existing eight-player drafts load unchanged. The standard Top N heading follows the count; custom and blank headings stay as entered. Titles, accessible preview labels, credits, and PNG filenames reflect the visible count. Attendance is independent.

Podium layouts sort visible players by their numeric placing (stable for ties), keep first place strictly largest, and never give a lower placing more tile area. Square layouts keep second place in the wide tile above the two thirds. Grid tiles remain equal size; incomplete rows are centered. Denser cards adapt text sizing so all styles remain usable up to 16 players. Top 8 keeps its existing layout.

Run `node --test top8graphic/tests/layout.test.cjs` for every count, layout, and canvas shape: bounds, overlap, equal grid sizes, podium area ordering, and the Top 8 square second-place regression. The update was also checked with the local jsdom/Canvas harness for state migration, retained edits, customized headings, rank sorting, visible-only credits, 480 rendered combinations at maximum text size, and PNG export. Firefox browser QA was unavailable because its automation listener was not running.

The wider attribution footer puts all unique artists on one line, copyright and artwork sources on the next, and `sawyerwelden.com/top8graphic` last. Long artist lists shrink to fit without truncation. A custom event footer moves to its own row when it cannot fit beside the attribution.
