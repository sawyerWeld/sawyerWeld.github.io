# Top 8 generator draft

Unlisted draft at `/top8-draft/`. Do not add it to the homepage or tools listing until Sawyer approves the polished version. The HTML includes `noindex, nofollow`; the URL is publicly accessible, not access-controlled.

Buildless HTML, CSS, and JavaScript. Serve this repository with a static HTTP server. `app.js` renders both the live preview and the exported PNG on the same canvas. The eight sample players are fictional. Example artwork is cached in `assets/`; `cards.json` keeps its card and artist metadata. Live search and alternate art use Scryfall's public API and CORS-enabled images. Artist and copyright credits are rendered into the PNG.

Drafts stay in localStorage under `sawyer-top8-draft-v1`. Nothing is submitted to a server except card searches and artwork requests. New artwork is loaded with anonymous CORS before drawing so PNG exports remain usable. Failed artwork produces a labeled placeholder and a warning.

Check changes with `node --check top8-draft/app.js`. Before promoting the draft, check the editor at desktop and phone widths in a browser, and download a PNG after choosing external artwork. At initial publication, browser automation was unavailable; interactions were checked in jsdom, artwork search against the live API, and PNG compositions with a native Canvas implementation. Browser layout and browser downloads remain to be checked.

The Design → Style control includes **Old border**. Its seven locally bundled frame variants follow card colors, with gold for multicolor and brown for colorless cards. See `assets/old-border/SOURCE.md` for provenance. Frames load on selection; export waits for them, and a failed frame falls back to the standard treatment with a visible warning. Existing saved drafts retain their selected treatment.

New and reset examples use the Top 8 cut ranks (`1, 2, 3, 3, 5, 5, 5, 5`). Places remain individually editable in Players; the separate placings preset selector was removed. Existing saved placings and player data are preserved. Interface copy follows the concise controls in Mana Counter and the PPL archetype page. The optional poster footer starts empty.

Design → Art credits switches between **On cards** and **Footer**. Footer is the default and combines unique artist names, Wizards copyright, and source credits in a single compact block at bottom right. Existing drafts migrate once to this default without losing player data; subsequent choices persist. Event → Top-right text edits or clears the poster heading.

Design → Style includes **Smash**, based on the supplied Top 8 reference: large italic placements, red diagonal nameplates, square red outlines, full-bleed card art, and a Magic planeswalker watermark. It supports both layouts/canvas sizes, both backgrounds, player handles/records, editable headings, and either credit placement. Other styles and saved drafts are unchanged.
