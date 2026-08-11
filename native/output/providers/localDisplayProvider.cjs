'use strict'

const LOCAL_DISPLAY_PROVIDER_ID = 'local-display'

const ASPECT_RATIOS = Object.freeze({
  '16:9': 16 / 9,
  '16:10': 16 / 10,
  '4:3': 4 / 3,
  '3:2': 3 / 2,
  '1:1': 1,
  '9:16': 9 / 16,
})

function calculateWindowBounds(displayBounds, aspectRatio, scale = 0.72) {
  const ratio = ASPECT_RATIOS[aspectRatio] ?? ASPECT_RATIOS['16:9']
  const availableWidth = Math.max(320, Math.floor(displayBounds.width * scale))
  const availableHeight = Math.max(240, Math.floor(displayBounds.height * scale))
  let width = availableWidth
  let height = Math.round(width / ratio)
  if (height > availableHeight) {
    height = availableHeight
    width = Math.round(height * ratio)
  }
  return {
    x: Math.round(displayBounds.x + (displayBounds.width - width) / 2),
    y: Math.round(displayBounds.y + (displayBounds.height - height) / 2),
    width,
    height,
  }
}

function buildLocalDisplayTargets(displays, primaryDisplayId) {
  return displays.map((display, index) => ({
    id: `display:${display.id}`,
    kind: 'display',
    name: display.label?.trim() || (display.id === primaryDisplayId ? 'This display' : `Display ${index + 1}`),
    detail: `${display.bounds.width} × ${display.bounds.height}${display.id === primaryDisplayId ? ' · Primary' : ''}`,
    available: true,
    displayId: String(display.id),
  }))
}

class LocalDisplayProvider {
  constructor({ screen, createOutputWindow }) {
    if (!screen || typeof screen.getAllDisplays !== 'function') throw new Error('LocalDisplayProvider requires Electron screen')
    this.id = LOCAL_DISPLAY_PROVIDER_ID
    this.label = 'Connected displays'
    this.capabilities = Object.freeze({ targetEnumeration: true, sessions: true, picker: false, actions: [] })
    this.screen = screen
    this.createOutputWindow = createOutputWindow
    this.cleanup = null
    this.onTargetsChanged = () => {}
  }

  start({ onTargetsChanged }) {
    if (this.cleanup) return this.cleanup
    this.onTargetsChanged = typeof onTargetsChanged === 'function' ? onTargetsChanged : () => {}
    const handleDisplayChange = () => this.onTargetsChanged()
    this.screen.on('display-added', handleDisplayChange)
    this.screen.on('display-removed', handleDisplayChange)
    this.screen.on('display-metrics-changed', handleDisplayChange)
    this.cleanup = () => {
      this.screen.removeListener('display-added', handleDisplayChange)
      this.screen.removeListener('display-removed', handleDisplayChange)
      this.screen.removeListener('display-metrics-changed', handleDisplayChange)
      this.cleanup = null
    }
    return this.cleanup
  }

  getStatus() {
    return { state: 'available', message: null }
  }

  listTargets() {
    const displays = this.screen.getAllDisplays()
    if (!Array.isArray(displays)) throw new Error('Electron did not return a display list')
    const primaryDisplay = this.screen.getPrimaryDisplay()
    const primaryDisplayId = primaryDisplay?.id
    return buildLocalDisplayTargets(displays, primaryDisplayId)
  }

  async startSession({ target, request, context }) {
    const displayId = target.displayId ?? target.id.slice('display:'.length)
    const display = this.screen.getAllDisplays().find(item => String(item.id) === String(displayId))
    if (!display) throw new Error('That display is no longer connected')
    if (typeof this.createOutputWindow !== 'function') throw new Error('Local display output is unavailable')
    const outputWindow = this.createOutputWindow({
      display,
      windowMode: request.windowMode,
      aspectRatio: request.aspectRatio,
      sourceUrl: context.sourceUrl,
      onClosed: context.onClosed,
    })
    return { outputWindow }
  }

  async stopSession(handle) {
    if (handle?.outputWindow && !handle.outputWindow.isDestroyed()) handle.outputWindow.close()
  }

  shutdown() {
    this.cleanup?.()
  }
}

module.exports = {
  ASPECT_RATIOS,
  LOCAL_DISPLAY_PROVIDER_ID,
  LocalDisplayProvider,
  buildLocalDisplayTargets,
  calculateWindowBounds,
}
