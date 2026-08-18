(function () {
  'use strict'

  const STORAGE_KEY = 'mana-counter-state-v1'
  const DEFAULT_SELECTED = ['red', 'green', 'colorless', 'storm']
  const counterDefinitions = [
    { id: 'life', label: 'Life', mark: '\u2665', initial: 20, min: -99, color: '#ff7f9c' },
    { id: 'poison', label: 'Poison', mark: '\u2620', initial: 0, min: 0, color: '#b9e260' },
    { id: 'colorless', label: 'Colorless', optionLabel: 'Colorless mana', mark: '\u25C7', initial: 0, min: 0, color: '#d7ddde' },
    { id: 'white', label: 'White', optionLabel: 'White mana', mark: 'W', initial: 0, min: 0, color: '#fff4c8' },
    { id: 'blue', label: 'Blue', optionLabel: 'Blue mana', mark: 'U', initial: 0, min: 0, color: '#71bff2' },
    { id: 'black', label: 'Black', optionLabel: 'Black mana', mark: 'B', initial: 0, min: 0, color: '#bda6ce' },
    { id: 'red', label: 'Red', optionLabel: 'Red mana', mark: 'R', initial: 0, min: 0, color: '#ff7568' },
    { id: 'green', label: 'Green', optionLabel: 'Green mana', mark: 'G', initial: 0, min: 0, color: '#77d99c' },
    { id: 'storm', label: 'Storm', optionLabel: 'Storm count', mark: '\u26A1', initial: 0, min: 0, color: '#cf9bff' }
  ]

  const definitionsById = Object.fromEntries(counterDefinitions.map((counter) => [counter.id, counter]))
  const counterList = document.getElementById('counterList')
  const counterOptions = document.getElementById('counterOptions')
  const settingsDialog = document.getElementById('settingsDialog')
  const settingsButton = document.getElementById('settingsButton')
  const closeSettingsButton = document.getElementById('closeSettingsButton')
  const newTurnButton = document.getElementById('newTurnButton')
  const undoButton = document.getElementById('undoButton')
  const resetButton = document.getElementById('resetButton')
  const wakeLockToggle = document.getElementById('wakeLockToggle')
  const announcement = document.getElementById('announcement')

  const initialValues = Object.fromEntries(counterDefinitions.map((counter) => [counter.id, counter.initial]))
  let state = loadState()
  let history = []
  let wakeLock = null

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
      const selected = Array.isArray(saved.selected)
        ? saved.selected.filter((id) => definitionsById[id])
        : DEFAULT_SELECTED
      return {
        selected: selected.length ? selected : DEFAULT_SELECTED,
        values: { ...initialValues, ...(saved.values || {}) },
        keepAwake: saved.keepAwake !== false
      }
    } catch (_) {
      return { selected: DEFAULT_SELECTED, values: { ...initialValues }, keepAwake: true }
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }

  function snapshot(label) {
    history.push({ values: { ...state.values }, label })
    if (history.length > 30) history.shift()
    undoButton.disabled = false
  }

  function announce(message) {
    announcement.textContent = ''
    window.setTimeout(() => { announcement.textContent = message }, 20)
  }

  function renderCounters() {
    counterList.replaceChildren()

    state.selected.forEach((id) => {
      const definition = definitionsById[id]
      if (!definition) return

      const row = document.createElement('section')
      row.className = `counter counter-${definition.id}`
      row.dataset.counterId = definition.id

      const decrement = document.createElement('button')
      decrement.type = 'button'
      decrement.className = 'step-button'
      decrement.textContent = '\u2212'
      decrement.setAttribute('aria-label', `Decrease ${definition.optionLabel || definition.label}`)
      attachRepeatingAction(decrement, definition.id, -1)

      const readout = document.createElement('div')
      readout.className = 'counter-readout'
      readout.innerHTML = `
        <div class="counter-copy">
          <div class="counter-name"><span class="mana-mark">${definition.mark}</span>${definition.label}</div>
          <output class="counter-value" data-value-for="${definition.id}" aria-label="${definition.label}: ${state.values[id]}">${state.values[id]}</output>
        </div>`

      const increment = document.createElement('button')
      increment.type = 'button'
      increment.className = 'step-button'
      increment.textContent = '+'
      increment.setAttribute('aria-label', `Increase ${definition.optionLabel || definition.label}`)
      attachRepeatingAction(increment, definition.id, 1)

      row.append(decrement, readout, increment)
      counterList.append(row)
    })
  }

  function renderOptions() {
    counterOptions.replaceChildren()
    counterDefinitions.forEach((definition) => {
      const label = document.createElement('label')
      label.className = 'counter-option'
      label.style.setProperty('--option-accent', definition.color)

      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.value = definition.id
      checkbox.checked = state.selected.includes(definition.id)
      checkbox.addEventListener('change', () => updateSelection(definition.id, checkbox.checked, checkbox))

      const text = document.createElement('span')
      text.textContent = definition.optionLabel || definition.label
      label.append(checkbox, text)
      counterOptions.append(label)
    })
  }

  function updateSelection(id, selected, checkbox) {
    if (selected && !state.selected.includes(id)) {
      state.selected.push(id)
    } else if (!selected) {
      if (state.selected.length === 1) {
        checkbox.checked = true
        announce('Keep at least one counter visible')
        return
      }
      state.selected = state.selected.filter((selectedId) => selectedId !== id)
    }
    saveState()
    renderCounters()
  }

  function attachRepeatingAction(button, id, amount) {
    let delayTimer = null
    let repeatTimer = null
    let repeated = false

    const stop = () => {
      window.clearTimeout(delayTimer)
      window.clearInterval(repeatTimer)
      button.classList.remove('is-held')
    }

    button.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      repeated = false
      button.classList.add('is-held')
      delayTimer = window.setTimeout(() => {
        repeated = true
        changeValue(id, amount, false)
        repeatTimer = window.setInterval(() => changeValue(id, amount, true), 95)
      }, 430)
    })

    button.addEventListener('pointerup', stop)
    button.addEventListener('pointercancel', stop)
    button.addEventListener('pointerleave', stop)
    button.addEventListener('click', () => {
      if (!repeated) changeValue(id, amount, false)
      repeated = false
    })
  }

  function changeValue(id, amount, fromRepeat) {
    const definition = definitionsById[id]
    const current = Number(state.values[id]) || 0
    const next = Math.min(999, Math.max(definition.min, current + amount))
    if (next === current) return

    if (!fromRepeat) {
      snapshot(`Change ${definition.label}`)
    }
    state.values[id] = next
    updateReadout(id)
    saveState()
    requestWakeLock()
    if (navigator.vibrate) navigator.vibrate(7)
  }

  function updateReadout(id) {
    const output = document.querySelector(`[data-value-for="${id}"]`)
    if (!output) return
    output.value = state.values[id]
    output.textContent = state.values[id]
    output.setAttribute('aria-label', `${definitionsById[id].label}: ${state.values[id]}`)
  }

  function clearForNewTurn() {
    const clearable = ['white', 'blue', 'black', 'red', 'green', 'colorless', 'storm']
    if (!clearable.some((id) => state.values[id] !== 0)) {
      announce('Mana and storm are already clear')
      return
    }
    snapshot('New turn')
    clearable.forEach((id) => { state.values[id] = 0 })
    renderCounters()
    saveState()
    announce('Mana and storm cleared')
    if (navigator.vibrate) navigator.vibrate([12, 40, 12])
  }

  function undo() {
    const previous = history.pop()
    if (!previous) return
    state.values = previous.values
    renderCounters()
    saveState()
    undoButton.disabled = history.length === 0
    announce(`Undid ${previous.label.toLowerCase()}`)
  }

  function resetGame() {
    if (!window.confirm('Reset every counter? Life returns to 20; everything else returns to 0.')) return
    snapshot('New game')
    state.values = { ...initialValues }
    renderCounters()
    saveState()
    settingsDialog.close()
    announce('Ready for a new game')
  }

  async function requestWakeLock() {
    if (!state.keepAwake || wakeLock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return
    try {
      wakeLock = await navigator.wakeLock.request('screen')
      wakeLock.addEventListener('release', () => { wakeLock = null })
    } catch (_) {
      wakeLock = null
    }
  }

  async function releaseWakeLock() {
    if (!wakeLock) return
    try { await wakeLock.release() } catch (_) { /* already released */ }
    wakeLock = null
  }

  settingsButton.addEventListener('click', () => {
    renderOptions()
    wakeLockToggle.checked = state.keepAwake
    settingsDialog.showModal()
    requestWakeLock()
  })

  closeSettingsButton.addEventListener('click', () => settingsDialog.close())
  settingsDialog.addEventListener('click', (event) => {
    if (event.target === settingsDialog) settingsDialog.close()
  })
  settingsDialog.addEventListener('cancel', () => settingsDialog.close())
  newTurnButton.addEventListener('click', clearForNewTurn)
  undoButton.addEventListener('click', undo)
  resetButton.addEventListener('click', resetGame)
  wakeLockToggle.addEventListener('change', () => {
    state.keepAwake = wakeLockToggle.checked
    saveState()
    if (state.keepAwake) requestWakeLock()
    else releaseWakeLock()
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') requestWakeLock()
  })
  document.addEventListener('pointerdown', requestWakeLock, { once: true })

  renderCounters()
  renderOptions()

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}))
  }
})()
