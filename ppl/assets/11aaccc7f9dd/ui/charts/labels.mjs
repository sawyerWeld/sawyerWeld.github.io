/** Returns positioned copies. Too many labels must be handled by the caller. */
export function positionLabels(labels, { top, bottom, gap = 42 }) {
  if (bottom < top || gap < 0) throw new RangeError("Invalid label bounds");
  if ((labels.length - 1) * gap > bottom - top)
    throw new RangeError("Labels do not fit");
  const placed = labels
    .map((label) => ({ ...label }))
    .sort((a, b) => a.targetY - b.targetY);
  if (!placed.length) return placed;
  placed[0].y = placed[0].targetY;
  for (let i = 1; i < placed.length; i++) {
    placed[i].y = Math.max(placed[i].targetY, placed[i - 1].y + gap);
  }
  const centerShift =
    placed.reduce((sum, label) => sum + label.targetY - label.y, 0) /
    placed.length;
  const shift = Math.max(
    top - placed[0].y,
    Math.min(centerShift, bottom - placed.at(-1).y),
  );
  return placed.map((label) => ({ ...label, y: label.y + shift }));
}
