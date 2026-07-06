(function (global) {
  const COLOR_ORDER = ["W", "U", "B", "R", "G", "C"];
  const PIP_COLOR_MAP = {
    W: "#d4a017",
    U: "#2980b9",
    B: "#7b5ea7",
    R: "#c0392b",
    G: "#27ae60",
    C: "#95a5a6",
  };
  const MULTICOLOR_ACCENT = "#b8860b";
  const currentScript = global.document && global.document.currentScript;
  const DEFAULT_MANA_BASE = currentScript?.src
    ? new URL("mana/", currentScript.src).href
    : "/mtg-mana/mana/";

  const NAME_PATTERNS = [
    [/^mono\s*w\b|^monow\b|mono white/, ["W"]],
    [/^mono\s*u\b|^monou\b|mono blue/, ["U"]],
    [/^mono\s*b\b|^monob\b|mono black/, ["B"]],
    [/^mono\s*r\b|^monor\b|mono red|ruby storm/, ["R"]],
    [/^mono\s*g\b|^monog\b|mono green/, ["G"]],
    [/\bazorius\b|cawgates|\bfamiliars\b|inside out|flicker tron/, ["W", "U"]],
    [/\bdimir\b/, ["U", "B"]],
    [/\brakdos\b|cycling storm/, ["B", "R"]],
    [/\bgruul\b/, ["R", "G"]],
    [/\bselesnya\b|slivers/, ["W", "G"]],
    [/\borzhov\b/, ["W", "B"]],
    [/\bizzet\b/, ["U", "R"]],
    [/\bgolgari\b|x lands spy|dredge/, ["B", "G"]],
    [/\bboros\b/, ["W", "R"]],
    [/\bsimic\b|walls|monster tron|turbo tron fog/, ["U", "G"]],
    [/\bbant\b/, ["W", "U", "G"]],
    [/\besper\b/, ["W", "U", "B"]],
    [/\bgrixis\b/, ["U", "B", "R"]],
    [/\bjund\b/, ["B", "R", "G"]],
    [/\bnaya\b/, ["W", "R", "G"]],
    [/\btemur\b/, ["U", "R", "G"]],
    [/\bsultai\b/, ["U", "B", "G"]],
    [/\bjeskai\b/, ["W", "U", "R"]],
    [/\bmardu\b/, ["W", "B", "R"]],
    [/\btron\b/, ["C"]],
  ];

  const SCRYFALL_SYMBOL_NAMES = new Map([
    ["\u221e", "INFINITY"],
    ["\u00bd", "HALF"],
  ]);

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeName(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function sortedColors(colors) {
    const present = new Set((colors || []).map((color) => String(color).trim().toUpperCase()));
    return COLOR_ORDER.filter((color) => present.has(color));
  }

  function normalizeColorMap(colorMap) {
    const lookup = new Map();
    Object.entries(colorMap || {}).forEach(([name, colors]) => {
      const sorted = sortedColors(colors);
      lookup.set(String(name), sorted);
      lookup.set(normalizeName(name), sorted);
    });
    return lookup;
  }

  function inferColorsFromName(name) {
    const normalized = normalizeName(name);
    for (const [pattern, colors] of NAME_PATTERNS) {
      if (pattern.test(normalized)) return colors;
    }
    return [];
  }

  function colorsForName(name, colorMap) {
    const lookup = normalizeColorMap(colorMap);
    const exact = lookup.get(String(name));
    if (exact) return exact;
    const normalized = lookup.get(normalizeName(name));
    if (normalized) return normalized;
    return inferColorsFromName(name);
  }

  function trimSlash(value) {
    return String(value || DEFAULT_MANA_BASE).replace(/\/+$/, "");
  }

  function manaSymbolFilename(symbol) {
    const normalized = String(symbol || "").trim().toUpperCase();
    const mapped = SCRYFALL_SYMBOL_NAMES.get(normalized) || normalized.replace(/\//g, "");
    return /^[A-Z0-9]+$/.test(mapped) ? mapped : null;
  }

  function manaSymbolSrc(symbol, options = {}) {
    const filename = manaSymbolFilename(symbol);
    if (!filename) return "";
    const base = trimSlash(options.srcPrefix);
    return `${base}/${encodeURIComponent(filename)}.svg`;
  }

  function manaPipsHtml(colors, options = {}) {
    const sorted = sortedColors(colors);
    if (!sorted.length) return "";
    const className = ["mana-pips", options.className].filter(Boolean).join(" ");
    const label = options.label || `Deck colors ${sorted.join("")}`;
    return `
      <span class="${escapeHtml(className)}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
        ${sorted
          .map((color) => `<img class="mana-pip" src="${escapeHtml(manaSymbolSrc(color, options))}" alt="${escapeHtml(color)}" />`)
          .join("")}
      </span>
    `;
  }

  function createPips(colors, options = {}) {
    const template = global.document.createElement("template");
    template.innerHTML = manaPipsHtml(colors, options).trim();
    return template.content.firstElementChild;
  }

  function manaCostSymbols(manaCost, options = {}) {
    const text = String(manaCost || "").trim();
    if (!text) return "";
    const parts = [];
    const pattern = /\{([^}]+)\}|\/\//g;
    let match;
    while ((match = pattern.exec(text))) {
      parts.push(match[0] === "//" ? { kind: "separator" } : { kind: "symbol", value: match[1] });
    }
    if (!parts.length) return "";
    return `
      <span class="mana-cost" aria-label="Mana cost ${escapeHtml(text)}">
        ${parts
          .map((part) => {
            if (part.kind === "separator") return '<span class="mana-cost-separator">/</span>';
            const symbol = String(part.value || "").toUpperCase();
            const src = manaSymbolSrc(symbol, options);
            if (src) {
              return `<img class="mana-cost-pip" src="${escapeHtml(src)}" alt="${escapeHtml(symbol)}" title="${escapeHtml(symbol)}" loading="lazy" referrerpolicy="no-referrer" />`;
            }
            return `<span class="mana-cost-pip mana-cost-text">${escapeHtml(symbol)}</span>`;
          })
          .join("")}
      </span>
    `;
  }

  function accentForColors(colors, fallback = "#386f9f") {
    const sorted = sortedColors(colors);
    if (sorted.length === 1) return PIP_COLOR_MAP[sorted[0]] || fallback;
    if (sorted.length > 1) return MULTICOLOR_ACCENT;
    return fallback;
  }

  const api = {
    COLOR_ORDER,
    PIP_COLOR_MAP,
    accentForColors,
    colorsForName,
    createPips,
    escapeHtml,
    inferColorsFromName,
    manaCostSymbols,
    manaPipsHtml,
    manaSymbolFilename,
    manaSymbolSrc,
    normalizeName,
    sortedColors,
  };

  global.MtgMana = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
