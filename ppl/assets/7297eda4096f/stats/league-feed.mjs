import { deckImages } from './profiles/deck-images.mjs';

async function readJSON(fetchResponse, url) {
  const response = await fetchResponse(url, {
    credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error('Could not load league data.');
  return response.json();
}

export function createLeagueFeedLoader(fetchResponse = (...args) => fetch(...args)) {
  let cached, pending;
  return function load({ refresh = false } = {}) {
    if (pending) return pending;
    if (cached && !refresh) return Promise.resolve(cached);
    cached = undefined;
    pending = Promise.all([
      readJSON(fetchResponse, '/combined-elo/data.json'),
      readJSON(fetchResponse, '/season-standings/season.json'),
    ]).then(([combined, season]) => {
      cached = { combined, season, images: deckImages };
      return cached;
    }).finally(() => { pending = undefined; });
    return pending;
  };
}

export const loadLeagueFeed = createLeagueFeedLoader();
