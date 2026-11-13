/** One keyboard tab stop per series; arrows traverse its points. */
export function bindPointInteraction(point, points, open) {
  point.addEventListener("pointerenter", open);
  point.addEventListener("focus", open);
  point.addEventListener("click", open);
  point.addEventListener("keydown", (event) => {
    const at = points.indexOf(point);
    let next =
      event.key === "ArrowRight"
        ? at + 1
        : event.key === "ArrowLeft"
          ? at - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? points.length - 1
              : null;
    if (next != null) {
      event.preventDefault();
      next = Math.max(0, Math.min(points.length - 1, next));
      point.setAttribute("tabindex", "-1");
      points[next].setAttribute("tabindex", "0");
      points[next].focus();
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  });
}
