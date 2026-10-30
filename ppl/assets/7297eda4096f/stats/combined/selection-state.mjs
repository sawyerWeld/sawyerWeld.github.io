export function selectPlayers(names, players) {
  const available = new Set(players.map((player) => player.player));
  const selected = new Set();
  for (const value of Array.isArray(names) ? names : []) {
    if (typeof value !== "string" || !value.trim()) continue;
    let name = value.trim();
    // Older links and preferences may contain full names.
    if (!available.has(name)) {
      const parts = name.split(/\s+/);
      name =
        parts[0][0].toUpperCase() +
        parts[0].slice(1).toLowerCase() +
        (parts.length > 1 ? " " + parts.at(-1)[0].toUpperCase() : "");
    }
    if (available.has(name)) selected.add(name);
  }
  return selected.size
    ? [...selected]
    : players.slice(0, 5).map((player) => player.player);
}

export function restoreSelection(params, saved, data) {
  const knownStore = (id) =>
    id === "all" || (typeof id === "string" && Object.hasOwn(data.stores, id));
  const savedStore = knownStore(saved?.store) ? saved.store : null;
  let store = savedStore ?? "all";
  if (params.has("store")) {
    const requested = params.get("store");
    store = knownStore(requested) ? requested : "all";
  } else if (params.has("players")) {
    // A shared player list without a store must not inherit a local filter.
    store = "all";
  }
  let names;
  if (params.has("players")) {
    try {
      names = JSON.parse(params.get("players"));
    } catch {}
  } else if (savedStore === store) {
    names = saved.players;
  }
  const players = data.players.filter(
    (player) => store === "all" || player.storeIds.includes(store),
  );
  return { store, players: selectPlayers(names, players) };
}
