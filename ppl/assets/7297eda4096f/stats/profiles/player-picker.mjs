export function createPlayerPicker(root, names, onSelect) {
  const input = root.querySelector('#player');
  const menu = root.querySelector('.player-picker-menu');
  const list = root.querySelector('#player-options');
  const empty = root.querySelector('.player-picker-empty');
  const roster = [...new Set(names)].sort((a, b) => a.localeCompare(b));
  const normalize = (value) => value.trim().toLocaleLowerCase();
  let selected = '';
  let matches = [];
  let activeIndex = -1;
  let composing = false;

  function close() {
    menu.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    activeIndex = -1;
  }

  function setSelected(name) {
    if (!roster.includes(name)) return;
    selected = name;
    input.value = name;
    close();
  }

  function restoreSelection() {
    input.value = selected;
    close();
  }

  function showOptions(query = '') {
    const search = normalize(query);
    matches = roster.filter((name) => normalize(name).includes(search));
    const options = matches.map((name, index) => {
      const option = list.ownerDocument.createElement('li');
      option.id = `${list.id}-${index}`;
      option.dataset.index = String(index);
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      option.textContent = name;
      return option;
    });
    list.replaceChildren(...options);
    activeIndex = -1;
    input.removeAttribute('aria-activedescendant');
    empty.hidden = matches.length > 0;
    menu.hidden = false;
    menu.scrollTop = 0;
    input.setAttribute('aria-expanded', 'true');
  }

  function highlight(index) {
    activeIndex = index;
    for (const [position, option] of [...list.children].entries()) {
      option.setAttribute('aria-selected', String(position === index));
    }
    const option = list.children[index];
    if (!option) return;
    input.setAttribute('aria-activedescendant', option.id);
    const bounds = option.getBoundingClientRect();
    const visible = menu.getBoundingClientRect();
    if (bounds.top < visible.top) menu.scrollTop -= visible.top - bounds.top;
    else if (bounds.bottom > visible.bottom) menu.scrollTop += bounds.bottom - visible.bottom;
  }

  function choose(name) {
    if (!roster.includes(name)) return;
    setSelected(name);
    onSelect(name);
  }

  input.addEventListener('focus', () => {
    input.select();
    showOptions();
  });
  input.addEventListener('click', () => {
    if (input.value === selected) input.select();
    if (menu.hidden) showOptions(input.value === selected ? '' : input.value);
  });
  input.addEventListener('input', (event) => {
    if (!composing && !event.isComposing) showOptions(input.value);
  });
  input.addEventListener('compositionstart', () => {
    composing = true;
  });
  input.addEventListener('compositionend', () => {
    composing = false;
    showOptions(input.value);
  });
  input.addEventListener('blur', restoreSelection);
  input.addEventListener('keydown', (event) => {
    if (composing || event.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      restoreSelection();
    } else if (event.key === 'Tab') {
      restoreSelection();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (menu.hidden) showOptions(input.value === selected ? '' : input.value);
      if (!matches.length) return;
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const index = activeIndex < 0
        ? (direction > 0 ? 0 : matches.length - 1)
        : Math.max(0, Math.min(matches.length - 1, activeIndex + direction));
      highlight(index);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const exact = roster.find((name) => normalize(name) === normalize(input.value));
      const choice = menu.hidden ? exact : matches[activeIndex] || exact ||
        (matches.length === 1 ? matches[0] : undefined);
      if (choice) choose(choice);
    }
  });

  // Keep focus on the input until the option's click commits the selection.
  list.addEventListener('mousedown', (event) => event.preventDefault());
  list.addEventListener('click', (event) => {
    const option = event.target.closest('[role="option"]');
    if (option && list.contains(option)) choose(matches[Number(option.dataset.index)]);
  });
  input.disabled = false;
  return { setSelected };
}
