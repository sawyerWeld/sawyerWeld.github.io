const SHEET_ID = '111CAIRE3rBO09LT3w2a543IUUP35iEt4GI5LcjLqd5M';
const FEED_GID = '206767915';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateImages(images) {
  if (!isObject(images)) throw Error('League artwork is missing.');
  for (const image of Object.values(images)) {
    if (
      !isObject(image) ||
      !['url', 'card', 'artist', 'source'].every((key) => typeof image[key] === 'string') ||
      !image.url.startsWith('https://')
    )
      throw Error('Invalid league artwork.');
  }
}

export async function parseLeagueFeed(text) {
  // Google wraps JSON in a fixed callback. Read the JSON without executing it.
  const wrapper = text.trim().match(
    /^(?:\/\*O_o\*\/\s*)?google\.visualization\.Query\.setResponse\(([\s\S]*)\);?$/,
  );
  if (!wrapper) throw Error('Unexpected Google Sheets response.');
  const response = JSON.parse(wrapper[1]);
  if (response.status !== 'ok' || !Array.isArray(response.table?.rows))
    throw Error('League feed is unavailable.');
  const columns = response.table.cols;
  if (
    !Array.isArray(columns) || columns.length !== 3 ||
    ['Section', 'Position', 'JSON'].some((name, index) => columns[index]?.label !== name)
  )
    throw Error('League feed columns have changed.');

  let manifest, end;
  const chunks = new Map();
  for (const row of response.table.rows) {
    if (!Array.isArray(row?.c) || row.c.length > 3) throw Error('Invalid league feed row.');
    const [section, position, value] = row.c.map((cell) => cell?.v);
    if (section == null && position == null && value == null) continue;
    if (!Number.isSafeInteger(position) || position < 0 || typeof value !== 'string')
      throw Error('Invalid league feed row.');
    if (section === 'manifest') {
      if (position !== 0 || manifest !== undefined) throw Error('Invalid league feed manifest.');
      manifest = JSON.parse(value);
    } else if (section === 'end') {
      if (position !== 0 || end !== undefined) throw Error('Invalid league feed footer.');
      end = JSON.parse(value);
    } else if (section === 'chunk') {
      if (chunks.has(position)) throw Error('Duplicate league feed chunk.');
      chunks.set(position, value);
    } else {
      throw Error('Unknown league feed section.');
    }
  }
  if (
    manifest?.schemaVersion !== 1 ||
    !/^[a-f0-9]{64}$/.test(manifest.revision) ||
    !Number.isSafeInteger(manifest.chunkCount) || manifest.chunkCount < 1 ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)$/.test(manifest.updatedAt) ||
    !Number.isFinite(Date.parse(manifest.updatedAt))
  )
    throw Error('Unsupported league feed manifest.');
  if (end?.revision !== manifest.revision || end?.chunkCount !== manifest.chunkCount)
    throw Error('League feed update is incomplete.');
  if (chunks.size !== manifest.chunkCount)
    throw Error('League feed chunk count does not match.');

  const ordered = [];
  for (let index = 0; index < manifest.chunkCount; index++) {
    if (!chunks.has(index)) throw Error('League feed chunk is missing.');
    ordered.push(chunks.get(index));
  }
  const content = ordered.join('');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  const digest = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (digest !== manifest.revision) throw Error('League feed checksum does not match.');

  const bundle = JSON.parse(content);
  if (!isObject(bundle) || !isObject(bundle.combined) || !isObject(bundle.season))
    throw Error('League feed data is incomplete.');
  validateImages(bundle.images);
  return bundle;
}

async function fetchLeagueFeed(fetchResponse) {
  const url = new URL(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq`);
  url.search = new URLSearchParams({
    gid: FEED_GID, headers: '1', tqx: 'out:json',
    tq: 'select A,B,C where A is not null', _ts: String(Date.now()),
  });
  const response = await fetchResponse(url, {
    credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error('Could not load the league feed.');
  return parseLeagueFeed(await response.text());
}

export function createLeagueFeedLoader(fetchResponse = (...args) => fetch(...args)) {
  let cached, pending;
  return function load({ refresh = false } = {}) {
    if (pending) return pending;
    if (cached && !refresh) return Promise.resolve(cached);
    // A failed refresh must not turn the previous response into a live result.
    cached = undefined;
    pending = fetchLeagueFeed(fetchResponse)
      .then((bundle) => { cached = bundle; return bundle; })
      .finally(() => { pending = undefined; });
    return pending;
  };
}

export const loadLeagueFeed = createLeagueFeedLoader();
