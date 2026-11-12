# Top 8 studio draft

Unlisted draft at `/top8-draft/`. Do not add it to the homepage or tools listing until Sawyer approves the polished version. The HTML includes `noindex, nofollow`; the URL is publicly accessible, not access-controlled.

Buildless HTML, CSS, and JavaScript. Serve this repository with a static HTTP server. `app.js` renders both the live preview and the exported PNG on the same canvas. The eight sample players are fictional. Example artwork is cached in `assets/`; `cards.json` keeps its card and artist metadata. Live search and alternate art use Scryfall's public API and CORS-enabled images. Artist and copyright credits are rendered into the PNG.

Drafts stay in localStorage under `sawyer-top8-draft-v1`. Nothing is submitted to a server except card searches and artwork requests. New artwork is loaded with anonymous CORS before drawing so PNG exports remain usable. Failed artwork produces a labeled placeholder and a warning.

Check changes with `node --check top8-draft/app.js`. Before promoting the draft, check the editor at desktop and phone widths in a browser, and download a PNG after choosing external artwork. At initial publication, browser automation was unavailable; interactions were checked in jsdom, artwork search against the live API, and PNG compositions with a native Canvas implementation. Browser layout and browser downloads remain to be checked.
