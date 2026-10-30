/** Linear mapping; a single-valued domain maps to the center of the range. */
export function linearScale([domainStart, domainEnd], [rangeStart, rangeEnd]) {
  if (![domainStart, domainEnd, rangeStart, rangeEnd].every(Number.isFinite)) {
    throw new TypeError("Scale endpoints must be finite numbers");
  }
  if (domainStart === domainEnd) return () => (rangeStart + rangeEnd) / 2;
  return (value) =>
    rangeStart +
    ((value - domainStart) / (domainEnd - domainStart)) *
      (rangeEnd - rangeStart);
}
