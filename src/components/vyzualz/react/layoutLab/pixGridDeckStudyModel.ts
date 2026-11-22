import { PIX_GRID_DECK_MAX_ITEMS, PIX_GRID_DECK_MIN_ITEMS } from '../pixGrid/PixGridDeckDomain'
import { newPopoverDeck, type PopoverDeck, type PopoverItem, type PopoverReadiness } from '../pixGrid/pixGridDeckPopoverModel'

/** Local fixtures for the PixGrid Deck popover study. Nothing here touches the store, the Media Library or the compiler. */
export const DECK_STUDY_MAX_ITEMS = PIX_GRID_DECK_MAX_ITEMS
export const DECK_STUDY_MIN_ITEMS = PIX_GRID_DECK_MIN_ITEMS

export type DeckStudyScenario = 'new' | 'editing' | 'compiling' | 'error'

export const SAMPLE_IMAGE_NAMES = ['neon-skyline.png', 'crystal-mask.webp', 'logo-mark.svg', 'portrait-03.jpg', 'sunset-grid.png', 'chrome-wave.png'] as const

let counter = 0
export const newStudyItemId = () => `study-item-${++counter}`

export function studyItem(name: string, patch: Partial<PopoverItem> = {}): PopoverItem {
  return { id: newStudyItemId(), name, enabled: true, duration: null, revision: 1, ...patch }
}

export function createStudyDeck(scenario: DeckStudyScenario): PopoverDeck {
  const base = newPopoverDeck(scenario === 'new' ? 'Untitled Deck' : 'Afterhours Skyline')
  if (scenario === 'new') return base
  // One image has its own duration and, while editing, one is switched off, so those states are visible straight away.
  const items = SAMPLE_IMAGE_NAMES.slice(0, 5).map((name, index) => studyItem(name, { duration: index === 2 ? 8 : null, enabled: !(scenario === 'editing' && index === 4) }))
  return { ...base, items }
}

/** What the compiler would report. The study moves progress on a timer so every state can be seen. */
export function studyReadiness(deck: PopoverDeck, scenario: DeckStudyScenario, elapsed: number): PopoverReadiness {
  const enabled = deck.items.filter(item => item.enabled).length
  if (enabled < DECK_STUDY_MIN_ITEMS) return { level: 'invalid', frameProgress: 0, transitionProgress: 0, message: 'Enable at least two images.', errors: [] }
  if (scenario === 'error') {
    return {
      level: 'error', frameProgress: 1, transitionProgress: 0.34, message: 'Required image compilation failed.',
      errors: ['chrome-wave.png: The image could not be decoded (corrupt PNG data).'],
    }
  }
  const frames = scenario === 'compiling' ? Math.min(0.72, elapsed / 4000) : Math.min(1, elapsed / 1800)
  const transitions = scenario === 'compiling' ? Math.min(0.38, elapsed / 7000) : Math.min(1, Math.max(0, (elapsed - 900) / 2200))
  if (frames >= 1 && transitions >= 1) return { level: 'ready', frameProgress: 1, transitionProgress: 1, message: 'Ready to create Preset.', errors: [] }
  return { level: 'preparing', frameProgress: frames, transitionProgress: transitions, message: 'Preparing required images and transitions…', errors: [] }
}

// ── Pixel frames ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const PREVIEW_COLUMNS = 64
export const PREVIEW_ROWS = 36
const PALETTES: ReadonlyArray<readonly [number, number, number][]> = [
  [[0, 217, 255], [0, 217, 130], [255, 62, 209]],
  [[255, 176, 64], [255, 90, 80], [255, 240, 200]],
  [[130, 110, 255], [60, 200, 255], [240, 250, 255]],
  [[97, 214, 170], [20, 120, 140], [232, 255, 240]],
  [[255, 120, 190], [255, 210, 90], [120, 220, 255]],
  [[210, 220, 235], [100, 140, 190], [30, 60, 110]],
]

/** A stand-in for one converted image: bold shapes on the 64 x 36 grid, in an LED palette. RGBA, row-major. */
export function studyFrame(seed: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(PREVIEW_COLUMNS * PREVIEW_ROWS * 4)
  const palette = PALETTES[Math.abs(seed) % PALETTES.length]!
  const variant = Math.abs(seed) % 5
  const cx = PREVIEW_COLUMNS / 2, cy = PREVIEW_ROWS / 2
  for (let y = 0; y < PREVIEW_ROWS; y += 1) {
    for (let x = 0; x < PREVIEW_COLUMNS; x += 1) {
      const dx = (x + 0.5 - cx) / (PREVIEW_ROWS / 2), dy = (y + 0.5 - cy) / (PREVIEW_ROWS / 2)
      const radius = Math.hypot(dx, dy)
      let on = 0
      let tone = 0
      if (variant === 0) { on = radius < 0.9 && Math.floor(radius * 6) % 2 === 0 ? 1 : 0; tone = Math.floor(radius * 6) % 3 }
      else if (variant === 1) { on = Math.abs(dx) + Math.abs(dy) < 0.85 ? 1 : 0; tone = Math.abs(dx) + Math.abs(dy) < 0.4 ? 2 : 0 }
      else if (variant === 2) { on = y % 6 < 3 && Math.abs(dx) < 1.4 ? 1 : 0; tone = Math.floor(y / 6) % 3 }
      else if (variant === 3) { on = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0 && radius < 1 ? 1 : 0; tone = Math.floor((x + y) / 12) % 3 }
      else { on = radius < 0.95 && (Math.atan2(dy, dx) * 5 / Math.PI + radius * 4) % 2 < 1 ? 1 : 0; tone = Math.floor(radius * 3) % 3 }
      const index = (y * PREVIEW_COLUMNS + x) * 4
      const color = palette[tone % palette.length]!
      pixels[index] = color[0]; pixels[index + 1] = color[1]; pixels[index + 2] = color[2]; pixels[index + 3] = on ? 255 : 0
    }
  }
  return pixels
}

/** Draws two frames blended by `progress` as round LED cells with dark gaps, the way PixGrid presents them. */
export function drawStudyFrame(canvas: HTMLCanvasElement, from: Uint8ClampedArray, to: Uint8ClampedArray, progress: number): void {
  const context = canvas.getContext('2d')
  if (!context) return
  const { width, height } = canvas
  context.fillStyle = '#04080b'
  context.fillRect(0, 0, width, height)
  const cell = Math.min(width / PREVIEW_COLUMNS, height / PREVIEW_ROWS)
  const offsetX = (width - cell * PREVIEW_COLUMNS) / 2, offsetY = (height - cell * PREVIEW_ROWS) / 2
  const radius = cell * 0.36
  for (let y = 0; y < PREVIEW_ROWS; y += 1) {
    for (let x = 0; x < PREVIEW_COLUMNS; x += 1) {
      const index = (y * PREVIEW_COLUMNS + x) * 4
      const alpha = (from[index + 3]! * (1 - progress) + to[index + 3]! * progress) / 255
      const px = offsetX + x * cell + cell / 2, py = offsetY + y * cell + cell / 2
      if (alpha < 0.03) {
        context.fillStyle = 'rgba(40,58,66,0.28)'
      } else {
        const r = from[index]! * (1 - progress) + to[index]! * progress
        const g = from[index + 1]! * (1 - progress) + to[index + 1]! * progress
        const b = from[index + 2]! * (1 - progress) + to[index + 2]! * progress
        context.fillStyle = `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha.toFixed(3)})`
      }
      context.beginPath()
      context.arc(px, py, radius, 0, Math.PI * 2)
      context.fill()
    }
  }
}
