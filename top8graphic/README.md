# Top 8 generator draft

Unlisted draft at `/top8graphic/`. Do not add it to the homepage or tools listing until Sawyer approves the polished version. The HTML includes `noindex, nofollow`; the URL is publicly accessible, not access-controlled.

Buildless HTML, CSS, and JavaScript. Serve this repository with a static HTTP server. `app.js` renders both the live preview and the exported PNG on the same canvas. The eight sample players are fictional. Example artwork is cached in `assets/`; `cards.json` keeps its card and artist metadata. Live search and alternate art use Scryfall's public API and CORS-enabled images. Artist and copyright credits are rendered into the PNG.

Drafts stay in localStorage under `sawyer-top8-draft-v1`. Nothing is submitted to a server except card searches and artwork requests. New artwork is loaded with anonymous CORS before drawing so PNG exports remain usable. Failed artwork produces a labeled placeholder and a warning.

Check changes with `node --check top8graphic/app.js`. Before promoting the draft, check the editor at desktop and phone widths in a browser, and download a PNG after choosing external artwork. At initial publication, browser automation was unavailable; interactions were checked in jsdom, artwork search against the live API, and PNG compositions with a native Canvas implementation. Browser layout and browser downloads remain to be checked.

The Design → Style control includes **Old border**. Its seven locally bundled frame variants follow card colors, with gold for multicolor and brown for colorless cards. See `assets/old-border/SOURCE.md` for provenance. Frames load on selection and reuse the existing image cache. Fitted frame layers are cached by color, dimensions, hero sizing, and credit placement with a 16 MiB least-recently-used limit, so subsequent edits avoid resampling the 1500 × 2100 textures. Export waits for frames, and a failed frame falls back to the standard treatment with a visible warning. Existing saved drafts retain their selected treatment.

New examples default to Smash style, Paper background, landscape canvas, and Podium layout with the Top 8 cut ranks (`1, 2, 3, 3, 5, 5, 5, 5`). Places remain individually editable in Players; the separate placings preset selector was removed. Existing saved placings and player data are preserved. Interface copy follows the concise controls in Mana Counter and the PPL archetype page. The optional poster footer starts empty.

Design → Art credits switches between **On cards** and **Footer**. Footer is the default and combines unique artist names, Wizards copyright, and source credits in a single compact block at bottom right. Existing drafts migrate once to this default without losing player data; subsequent choices persist. Event → Top-right text edits or clears the poster heading.

Design → Style includes **Smash**, based on the supplied Top 8 reference: large italic placements, red diagonal nameplates, square red outlines, full-bleed card art, and a Magic planeswalker watermark. It supports both layouts/canvas sizes, both backgrounds, player handles/records, editable headings, and either credit placement. Other styles and saved drafts are unchanged.

The page footer links “Sawyer Welden” to `/pauper/`, with expandable credits below. Drafts still save locally, without a status label or Reset control.

The former `/top8-draft/` URL has been removed. The localStorage key is unchanged so existing drafts carry over.

Art position shifts artwork along the cropped axis: horizontally in tall slots, vertically in wide slots. Center remains 50; the same position is used in the preview and PNG export.

Per-player Zoom (100–200%) creates more room for Art position when the source image closely matches its slot. Existing drafts retain their composition at 100%; changing artwork resets zoom and position.
