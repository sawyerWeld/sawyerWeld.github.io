// Browser preferences are optional; private browsing or blocked storage must
// never prevent the league pages from loading. Results still come from Sheets.
export function readPreferences(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export function savePreferences(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function preferredValue(params, key, saved, allowed, fallback) {
  const value = params.has(key) ? params.get(key) : saved;
  return allowed.includes(value) ? value : fallback;
}

export function preferredStore(params, saved, stores, fallback = "all") {
  const choices = Object.keys(stores);
  if (fallback === "all") choices.push("all");
  return preferredValue(params, "store", saved, choices, fallback);
}

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : "";
}

export function metagamePreferences(params, saved, stores) {
  // A shared scope is complete: ?store=6696 must not inherit a saved date range.
  const shared = ["store", "from", "to", "fnm"].some(key => params.has(key));
  const scope = shared ? Object.fromEntries(params) : saved;
  let from = validDate(scope.from), to = validDate(scope.to);
  if (!shared && from && to && from > to) from = to = "";
  return {
    store: preferredStore(new URLSearchParams(), scope.store, stores),
    from, to,
    fnm: scope.fnm === true || scope.fnm === "true",
    sort: preferredValue(params, "sort", saved.sort, ["popularity", "winRate", "name"], "popularity"),
    limit: preferredValue(params, "limit", saved.limit, ["8", "12", "all"], "8"),
  };
}
