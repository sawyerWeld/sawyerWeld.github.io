export function svgElement(tag, attributes = {}, text = "") {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [name, value] of Object.entries(attributes))
    element.setAttribute(name, value);
  if (text !== "") element.textContent = text;
  return element;
}
