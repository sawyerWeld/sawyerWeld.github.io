# Sawyer Welden site style

Use this as the default visual language for new tools and reports on
`sawyerwelden.com`. The canonical working example is
[Paupergenesis 2026 Survivorship](https://sawyerwelden.com/paupergenesis2026/survivorship/).
Individual projects may depart from this when their subject or explicit product
requirements call for it.

## Character

The site should feel like a clear, restrained research notebook: editorial
rather than corporate, dense when the information requires it, and quiet enough
that data, card art, and Magic symbols provide the color. Prefer clarity over
decoration.

## Core palette

```css
:root {
  color-scheme: light;
  --ink: #182231;
  --muted: #64748b;
  --line: #d9e1ea;
  --panel: #ffffff;
  --page: #f3f6f8;
  --blue: #2167ae;
}
```

- Use `--page` for the canvas and white for content panels.
- Use navy `--ink` for primary text, never pure black.
- Use `--blue` for links, eyebrows, selected controls, and primary accents.
- Bring in additional color only when it encodes data, identity, or state.
- Use pale blue-gray hover and selected backgrounds such as `#edf3f8`.
- Use warm red sparingly for destructive or adverse states.

## Type

- Primary stack: `Inter, ui-sans-serif, system-ui, -apple-system,
  BlinkMacSystemFont, "Segoe UI", sans-serif`.
- Headings are compact, bold, and sentence case.
- Eyebrows are small, blue, heavy-weight uppercase labels.
- Supporting copy uses slate text and comfortable line height.
- Tabular data and counters use tabular numerals.

## Surfaces and spacing

- Panels are white with a 1px `--line` border.
- Corners are modest: usually 5–7px for report panels and controls. Larger
  radii are reserved for mobile sheets or clearly touch-oriented interfaces.
- Avoid heavy shadows and gradients. A subtle shadow is acceptable for a modal
  or floating layer that needs depth.
- Use thin rules and spacing to establish hierarchy. Do not add dashboard
  chrome that does not serve the content.
- Keep mobile controls at least 44px tall and make primary touch targets larger
  when the interface will be used during play.

## Magic assets

Use the canonical mana SVGs in:

`paupergenesis2026/survivorship/mana/{W,U,B,R,G,C}.svg`

Do not recreate mana symbols with letters, emoji, or newly drawn SVGs. Mana pips
should normally be circular, 14–28px depending on context, with their original
colors intact.

## Interaction

- Hover, focus, and selected states should be obvious without changing layout.
- Use `--blue` for keyboard focus rings.
- Persist device-local preferences when doing so saves repeated setup.
- Respect reduced-motion preferences and provide text labels for icon-only
  actions.
- Use native controls and semantic HTML where practical.

## Quick implementation check

Before shipping a new page, confirm that it uses the shared palette, system sans
type, white bordered panels, restrained radii, blue interaction states, and the
canonical mana assets where applicable. Check both a narrow phone viewport and
a desktop viewport when the user asks for visual QA.
