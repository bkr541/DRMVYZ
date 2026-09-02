import type {
  TrackTimelineBeat,
  TrackTimelineEvent,
  TrackTimelineModel,
  TrackTimelinePoint,
  TrackTimelineSection,
  TrackTimelineWaveformBin,
} from './trackTimelineModel'
import type { TrackTimelineViewport } from './trackTimelineViewport'

export interface TrackTimelineHitRegion {
  x1: number
  x2: number
  y1: number
  y2: number
  text: string
}

type WithViewport<T> = T & { viewport?: TrackTimelineViewport }

export type TrackTimelineCanvasSpec =
  | WithViewport<{ kind: 'waveform' }>
  | WithViewport<{ kind: 'beatGrid' }>
  | WithViewport<{ kind: 'timeRuler' }>
  | WithViewport<{ kind: 'detailRuler' }>
  | WithViewport<{ kind: 'sections'; sections: TrackTimelineSection[] }>
  | WithViewport<{ kind: 'line'; points: TrackTimelinePoint[]; color: PaletteKey; curveName: string; fill: boolean }>
  | WithViewport<{ kind: 'heat'; points: TrackTimelinePoint[]; color: PaletteKey; metric: string }>
  | WithViewport<{ kind: 'events'; events: TrackTimelineEvent[]; eventType: string; color: PaletteKey }>
  | WithViewport<{ kind: 'extrema'; points: TrackTimelinePoint[]; color: PaletteKey; metric: string; style: 'line' | 'heat' }>

export type PaletteKey = keyof TrackTimelinePalette

interface TrackTimelinePalette {
  background: string
  panel: string
  surface: string
  border: string
  text: string
  muted: string
  faint: string
  cyan: string
  teal: string
  green: string
  orange: string
  red: string
  magenta: string
  purple: string
  yellow: string
  slate: string
}

interface CanvasFonts {
  ui: string
  data: string
}

interface DrawContext {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  model: TrackTimelineModel
  palette: TrackTimelinePalette
  fonts: CanvasFonts
  hits: TrackTimelineHitRegion[]
  viewport: TrackTimelineViewport
}

const EVENT_COLOR_KEYS: Record<string, PaletteKey> = {
  beat: 'teal',
  downbeat: 'cyan',
  bar_start: 'slate',
  phrase_boundary: 'purple',
  section_start: 'green',
  section_end: 'slate',
  section_entry: 'green',
  section_exit: 'slate',
  build_start: 'yellow',
  pre_drop_start: 'orange',
  drop_impact: 'red',
  major_impact: 'magenta',
  breakdown_entry: 'orange',
  energy_release: 'yellow',
  fakeout_candidate: 'purple',
  silence_or_stop: 'slate',
  selected_boundary: 'cyan',
  boundary_candidate: 'slate',
  alternative_boundary: 'orange',
  ranked_boundary_alternative: 'purple',
  global_maximum: 'red',
  global_minimum: 'cyan',
  local_peak: 'magenta',
  rgb_bin_peak: 'teal',
  top_bar: 'yellow',
  track_start: 'green',
  track_end: 'red',
  '4_bar_block_start': 'slate',
  '8_bar_block_start': 'cyan',
  '16_bar_block_start': 'teal',
  '32_bar_block_start': 'green',
}

function cssVar(canvas: HTMLCanvasElement, name: string, fallback: string): string {
  const value = getComputedStyle(canvas).getPropertyValue(name).trim()
  return value || fallback
}

function resolvePalette(canvas: HTMLCanvasElement): TrackTimelinePalette {
  return {
    background: cssVar(canvas, '--color-background', '#090d0f'),
    panel: cssVar(canvas, '--color-panel', '#0b1012'),
    surface: cssVar(canvas, '--color-surface', '#1a2024'),
    border: cssVar(canvas, '--color-border-subtle', 'rgba(154,178,188,0.18)'),
    text: cssVar(canvas, '--color-text', 'rgba(232,238,240,0.88)'),
    muted: cssVar(canvas, '--color-text-muted', 'rgba(196,207,211,0.58)'),
    faint: cssVar(canvas, '--color-text-faint', 'rgba(196,207,211,0.32)'),
    cyan: cssVar(canvas, '--color-primary', '#4ac7db'),
    teal: cssVar(canvas, '--color-secondary', '#61d6aa'),
    green: cssVar(canvas, '--az-green', '#61d6aa'),
    orange: '#e89b5e',
    red: cssVar(canvas, '--az-red', '#e05a5a'),
    magenta: cssVar(canvas, '--az-magenta', '#b84fc9'),
    purple: '#9b7de3',
    yellow: cssVar(canvas, '--az-yellow', '#d8b95a'),
    slate: cssVar(canvas, '--color-text-muted', '#78909a'),
  }
}

function resolveFonts(canvas: HTMLCanvasElement): CanvasFonts {
  return {
    ui: cssVar(canvas, '--az-font', "Inter, 'Helvetica Neue', system-ui, sans-serif"),
    data: cssVar(canvas, '--az-font-data', "'Exo 2', Inter, system-ui, sans-serif"),
  }
}

function parseColor(color: string): [number, number, number] | null {
  const value = color.trim()
  if (value.startsWith('#')) {
    const hex = value.slice(1)
    const full = hex.length === 3 ? hex.split('').map(part => part + part).join('') : hex.slice(0, 6)
    if (!/^[0-9a-f]{6}$/i.test(full)) return null
    return [
      Number.parseInt(full.slice(0, 2), 16),
      Number.parseInt(full.slice(2, 4), 16),
      Number.parseInt(full.slice(4, 6), 16),
    ]
  }
  const rgb = value.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i)
  if (!rgb) return null
  return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
}

function rgba(color: string, alpha: number): string {
  const parsed = parseColor(color)
  if (!parsed) return color
  return `rgba(${parsed[0]}, ${parsed[1]}, ${parsed[2]}, ${alpha})`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function prepareCanvas(canvas: HTMLCanvasElement, cssHeight: number) {
  const width = canvas.getBoundingClientRect().width
  if (!width || width < 2) return null
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const pixelWidth = Math.max(1, Math.round(width * dpr))
  const pixelHeight = Math.max(1, Math.round(cssHeight * dpr))
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth
    canvas.height = pixelHeight
  }
  canvas.style.height = `${cssHeight}px`
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, cssHeight)
  return { ctx, width, height: cssHeight }
}

export function drawTrackTimelineCanvas(
  canvas: HTMLCanvasElement,
  spec: TrackTimelineCanvasSpec,
  model: TrackTimelineModel,
  cssHeight: number,
): TrackTimelineHitRegion[] {
  const prepared = prepareCanvas(canvas, cssHeight)
  if (!prepared) return []
  const draw: DrawContext = {
    ...prepared,
    model,
    palette: resolvePalette(canvas),
    fonts: resolveFonts(canvas),
    hits: [],
    viewport: resolveViewport(spec.viewport, model.durationSec),
  }

  switch (spec.kind) {
    case 'waveform':
      drawWaveform(draw)
      break
    case 'beatGrid':
      drawBeatGrid(draw)
      break
    case 'timeRuler':
      drawTimeRuler(draw)
      break
    case 'detailRuler':
      drawDetailRuler(draw)
      break
    case 'sections':
      drawSections(draw, spec.sections)
      break
    case 'line':
      drawLineRow(draw, spec)
      break
    case 'heat':
      drawHeatRow(draw, spec)
      break
    case 'events':
      drawEventRow(draw, spec)
      break
    case 'extrema':
      drawExtremaRow(draw, spec)
      break
  }

  return draw.hits
}

function drawBackground(draw: DrawContext) {
  const { ctx, width, height, palette } = draw
  ctx.fillStyle = palette.background
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = rgba(palette.border, 0.44)
  ctx.lineWidth = 1
  for (let y = 0.5; y < height; y += Math.max(18, height / 3)) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }
}

function resolveViewport(viewport: TrackTimelineViewport | undefined, durationSec: number): TrackTimelineViewport {
  const duration = Math.max(0, finite(durationSec))
  if (!viewport || duration <= 0) return { startSec: 0, endSec: duration }
  const startSec = clamp(finite(viewport.startSec), 0, duration)
  const endSec = clamp(finite(viewport.endSec, duration), startSec, duration)
  if (endSec - startSec < 0.001) return { startSec: 0, endSec: duration }
  return { startSec, endSec }
}

function timeToX(time: number, width: number, viewport: TrackTimelineViewport): number {
  const duration = Math.max(viewport.endSec - viewport.startSec, 0.001)
  return clamp(((finite(time) - viewport.startSec) / duration) * width, 0, width)
}

function overlapsViewport(startSec: number, endSec: number, viewport: TrackTimelineViewport): boolean {
  return endSec >= viewport.startSec && startSec <= viewport.endSec
}

function pointsInViewport(points: TrackTimelinePoint[], viewport: TrackTimelineViewport): TrackTimelinePoint[] {
  if (!points.length) return []
  const firstVisible = points.findIndex(point => point.time >= viewport.startSec)
  if (firstVisible === -1) return []
  if (points[firstVisible]!.time > viewport.endSec) {
    return firstVisible > 0 ? points.slice(firstVisible - 1, firstVisible + 1) : []
  }
  let lastVisible = firstVisible
  while (lastVisible < points.length && points[lastVisible]!.time <= viewport.endSec) lastVisible += 1
  const start = Math.max(0, firstVisible - 1)
  const end = Math.min(points.length, lastVisible + 1)
  return points.slice(start, end)
}

function drawSectionContext(draw: DrawContext) {
  const { ctx, width, height, model, viewport } = draw
  model.sections.forEach(section => {
    if (!overlapsViewport(section.start, section.end, viewport)) return
    const x1 = timeToX(section.start, width, viewport)
    const x2 = Math.max(x1 + 1, timeToX(section.end, width, viewport))
    ctx.fillStyle = rgba(sectionColor(section.type), 0.055)
    ctx.fillRect(x1, 0, x2 - x1, height)
  })
}

function drawWaveform(draw: DrawContext) {
  const { ctx, width, height, model, palette, hits, viewport } = draw
  drawBackground(draw)
  const center = height / 2
  ctx.strokeStyle = rgba(palette.cyan, 0.25)
  ctx.beginPath()
  ctx.moveTo(0, center + 0.5)
  ctx.lineTo(width, center + 0.5)
  ctx.stroke()

  if (!model.waveform.length) {
    drawCenteredMessage(draw, 'Waveform data unavailable')
    return
  }

  const visibleWaveform = model.waveform.filter(bin => overlapsViewport(bin.start, bin.end, viewport))
  const columns = aggregateWaveformToPixels(visibleWaveform, width)
  columns.forEach((column, x) => {
    if (!column) return
    const positive = clamp(column.positive, 0, 1)
    const negative = clamp(column.negative, 0, 1)
    const rms = clamp(column.rms, 0, 1)
    const top = center - positive * (center - 5)
    const bottom = center + negative * (center - 5)

    ctx.strokeStyle = dominantBandColor(draw, column.low, column.mid, column.high, 0.84)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x + 0.5, top)
    ctx.lineTo(x + 0.5, bottom)
    ctx.stroke()

    if (rms > 0.03) {
      ctx.strokeStyle = rgba(palette.text, 0.24)
      ctx.beginPath()
      ctx.moveTo(x + 0.5, center - rms * (center - 8))
      ctx.lineTo(x + 0.5, center + rms * (center - 8))
      ctx.stroke()
    }
  })

  hits.push({
    x1: 0,
    x2: width,
    y1: 0,
    y2: height,
    text: `Waveform\n${visibleWaveform.length.toLocaleString()} visible bins · ${formatTime(viewport.startSec)} → ${formatTime(viewport.endSec)}`,
  })
}

interface AggregatedWaveform {
  positive: number
  negative: number
  rms: number
  low: number
  mid: number
  high: number
}

function aggregateWaveformToPixels(items: TrackTimelineWaveformBin[], width: number): Array<AggregatedWaveform | null> {
  const result = Array.from({ length: Math.max(1, Math.floor(width)) }, () => null as AggregatedWaveform | null)
  if (!items.length) return result
  for (let x = 0; x < result.length; x += 1) {
    const start = Math.floor((x / result.length) * items.length)
    const end = Math.max(start + 1, Math.floor(((x + 1) / result.length) * items.length))
    let aggregate: AggregatedWaveform = { positive: 0, negative: 0, rms: 0, low: 0, mid: 0, high: 0 }
    let count = 0
    for (let index = start; index < Math.min(end, items.length); index += 1) {
      const item = items[index]!
      aggregate.positive = Math.max(aggregate.positive, item.positive)
      aggregate.negative = Math.max(aggregate.negative, item.negative)
      aggregate.rms += item.rms
      aggregate.low += item.low
      aggregate.mid += item.mid
      aggregate.high += item.high
      count += 1
    }
    if (count) {
      aggregate = {
        ...aggregate,
        rms: aggregate.rms / count,
        low: aggregate.low / count,
        mid: aggregate.mid / count,
        high: aggregate.high / count,
      }
      result[x] = aggregate
    }
  }
  return result
}

function dominantBandColor(draw: DrawContext, low: number, mid: number, high: number, alpha: number): string {
  const values = [finite(low), finite(mid), finite(high)]
  const maxIndex = values.indexOf(Math.max(...values))
  if (maxIndex === 0) return rgba(draw.palette.orange, alpha)
  if (maxIndex === 1) return rgba(draw.palette.cyan, alpha)
  return rgba(draw.palette.magenta, alpha)
}

// ── React Track Map beat-grid treatment ────────────────────────────────────
// Mirrors drawBeatGridCanvas in ReactTrackMapStrip: three top-anchored tiers —
// short cyan regular beats, taller green downbeats, tallest red every-fourth-
// downbeat markers — with no bar or time labels, and density reduction so
// regular ticks never crowd below ~3px apart.
const TRACK_MAP_BEAT_COLOR = 'rgba(74, 199, 219, 0.45)'
const TRACK_MAP_DOWNBEAT_COLOR = 'rgba(97, 214, 170, 0.85)'
const TRACK_MAP_FOUR_BAR_COLOR = 'rgba(192, 49, 74, 0.96)'
const TRACK_MAP_BEAT_TICK_H = 5
const TRACK_MAP_DOWNBEAT_TICK_H = 13
const TRACK_MAP_FOUR_BAR_TICK_H = 20

function drawBeatGrid(draw: DrawContext) {
  const { ctx, width, height, model, hits, viewport } = draw
  drawBackground(draw)
  if (!model.beats.length) {
    drawCenteredMessage(draw, 'Beat-grid data unavailable')
    return
  }

  // Promote every fourth downbeat to a four-bar marker, counted across the full
  // grid so panning/zooming never resets the cadence at the visible edge.
  const fourBarBeats = new Set<TrackTimelineBeat>()
  let downbeatCount = 0
  model.beats.forEach(beat => {
    if (!beat.isDownbeat) return
    downbeatCount += 1
    if (downbeatCount % 4 === 0) fourBarBeats.add(beat)
  })

  const visibleBeats = model.beats.filter(
    beat => beat.time >= viewport.startSec - 0.01 && beat.time <= viewport.endSec + 0.01,
  )
  const regularCount = visibleBeats.reduce((total, beat) => total + (beat.isDownbeat ? 0 : 1), 0)
  const pxPerBeat = regularCount > 0 ? width / regularCount : width
  const stride = pxPerBeat < 3 ? Math.max(1, Math.ceil(3 / pxPerBeat)) : 1

  const tickX = (time: number) => Math.floor(timeToX(time, width, viewport)) + 0.5

  // Regular beats — short cyan ruler marks, density-reduced.
  ctx.strokeStyle = TRACK_MAP_BEAT_COLOR
  ctx.lineWidth = 1
  ctx.beginPath()
  let regularIndex = 0
  visibleBeats.forEach(beat => {
    if (beat.isDownbeat) return
    if (regularIndex % stride === 0) {
      const x = tickX(beat.time)
      ctx.moveTo(x, 0)
      ctx.lineTo(x, Math.min(height, TRACK_MAP_BEAT_TICK_H))
    }
    regularIndex += 1
  })
  ctx.stroke()

  // Downbeats — taller, thicker, green (four-bar markers excluded here).
  ctx.strokeStyle = TRACK_MAP_DOWNBEAT_COLOR
  ctx.lineWidth = 2
  ctx.beginPath()
  visibleBeats.forEach(beat => {
    if (!beat.isDownbeat || fourBarBeats.has(beat)) return
    const x = tickX(beat.time)
    ctx.moveTo(x, 0)
    ctx.lineTo(x, Math.min(height, TRACK_MAP_DOWNBEAT_TICK_H))
  })
  ctx.stroke()

  // Four-bar boundaries — the tallest, strongest divider.
  ctx.strokeStyle = TRACK_MAP_FOUR_BAR_COLOR
  ctx.lineWidth = 2
  ctx.beginPath()
  visibleBeats.forEach(beat => {
    if (!fourBarBeats.has(beat)) return
    const x = tickX(beat.time)
    ctx.moveTo(x, 0)
    ctx.lineTo(x, Math.min(height, TRACK_MAP_FOUR_BAR_TICK_H))
  })
  ctx.stroke()

  hits.push({
    x1: 0,
    x2: width,
    y1: 0,
    y2: height,
    text: `Beat Grid\n${model.beats.length} beats · ${model.bars.length} bars`,
  })
}

function drawDetailRuler(draw: DrawContext) {
  const { ctx, width, height, model, hits, viewport } = draw
  drawBackground(draw)
  drawSectionContext(draw)

  // React Track Map ruler treatment: faint cyan hairlines + 10px system font.
  const dividerY = Math.round(height * 0.54) + 0.5
  ctx.strokeStyle = TRACK_MAP_RULER_LINE
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, dividerY)
  ctx.lineTo(width, dividerY)
  ctx.stroke()

  if (!model.bars.length) {
    drawTimeLabels(draw, 8)
    drawCenteredMessage(draw, 'Bar ruler unavailable')
    return
  }

  const visibleBars = model.bars.filter(bar => overlapsViewport(bar.start, bar.end, viewport))
  ctx.font = TRACK_MAP_RULER_FONT
  ctx.textBaseline = 'top'

  visibleBars.forEach(bar => {
    const x1 = timeToX(bar.start, width, viewport)
    const x2 = timeToX(bar.end, width, viewport)
    ctx.strokeStyle = TRACK_MAP_RULER_LINE
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x1 + 0.5, 0)
    ctx.lineTo(x1 + 0.5, height)
    ctx.stroke()

    if (x2 - x1 > 20) {
      ctx.fillStyle = TRACK_MAP_RULER_TEXT
      ctx.fillText(String(bar.barNumber), x1 + 6, 7)
    }
  })

  let lastBeatLabelX = -20
  model.beats.forEach(beat => {
    if (beat.time < viewport.startSec || beat.time > viewport.endSec) return
    const x = timeToX(beat.time, width, viewport)
    ctx.strokeStyle = TRACK_MAP_RULER_LINE
    ctx.lineWidth = beat.isDownbeat ? 1 : 0.8
    ctx.beginPath()
    ctx.moveTo(x + 0.5, dividerY)
    ctx.lineTo(x + 0.5, height)
    ctx.stroke()

    if (x - lastBeatLabelX > 14) {
      lastBeatLabelX = x
      ctx.fillStyle = TRACK_MAP_RULER_TEXT
      ctx.fillText(String(beat.beatWithinBar + 1), x + 3, dividerY + 7)
    }
  })

  ctx.textBaseline = 'alphabetic'
  hits.push({
    x1: 0,
    x2: width,
    y1: 0,
    y2: height,
    text: `Detail ruler\n${visibleBars.length} visible bars · ${formatTime(viewport.startSec)} → ${formatTime(viewport.endSec)}`,
  })
}

// ── React Track Map ruler treatment ──────────────────────────────────────
// Mirrors drawTimelineRuler in ReactTrackMapStrip: six even divisions across
// the visible range, a 10px system font, faint cyan 5px ticks, non-padded
// M:SS labels, first/last labels aligned to the edges.
const TRACK_MAP_RULER_DIVISIONS = 6
const TRACK_MAP_RULER_FONT = '10px sans-serif'
const TRACK_MAP_RULER_TEXT = 'rgba(232, 244, 248, 0.42)'
const TRACK_MAP_RULER_LINE = 'rgba(74, 199, 219, 0.12)'

function formatRulerTime(seconds: number): string {
  const safe = Math.max(0, finite(seconds))
  const minutes = Math.floor(safe / 60)
  const wholeSeconds = Math.floor(safe % 60)
  return `${minutes}:${String(wholeSeconds).padStart(2, '0')}`
}

function drawTimeLabels(draw: DrawContext, y: number) {
  const { ctx, width, viewport } = draw
  const span = viewport.endSec - viewport.startSec
  if (!(span > 0) || width <= 0) return

  ctx.font = TRACK_MAP_RULER_FONT
  ctx.fillStyle = TRACK_MAP_RULER_TEXT
  ctx.strokeStyle = TRACK_MAP_RULER_LINE
  ctx.lineWidth = 1
  ctx.textBaseline = 'top'

  const count = Math.max(2, Math.floor(TRACK_MAP_RULER_DIVISIONS))
  const tickTop = y + 11
  for (let i = 0; i <= count; i += 1) {
    const ratio = i / count
    const x = Math.round(ratio * width) + 0.5
    ctx.beginPath()
    ctx.moveTo(x, tickTop)
    ctx.lineTo(x, tickTop + 5)
    ctx.stroke()

    ctx.textAlign = i === 0 ? 'left' : i === count ? 'right' : 'center'
    ctx.fillText(formatRulerTime(viewport.startSec + ratio * span), clamp(x, 1, width - 1), y)
  }
  ctx.textAlign = 'start'
  ctx.textBaseline = 'alphabetic'
}

// Dedicated time row — a 1:1 port of drawTimelineRuler in ReactTrackMapStrip:
// a flat dark strip (no grid, no horizontal rules), six even divisions, 10px
// system font, faint cyan 5px ticks anchored to the bottom edge, non-padded
// M:SS labels vertically centered, first/last labels aligned to the edges.
function drawTimeRuler(draw: DrawContext) {
  const { ctx, width, height, viewport } = draw
  ctx.fillStyle = 'rgba(4, 10, 15, 0.9)'
  ctx.fillRect(0, 0, width, height)

  const span = viewport.endSec - viewport.startSec
  if (!(span > 0) || width <= 0 || height <= 0) return

  ctx.font = TRACK_MAP_RULER_FONT
  ctx.fillStyle = TRACK_MAP_RULER_TEXT
  ctx.strokeStyle = TRACK_MAP_RULER_LINE
  ctx.lineWidth = 1
  ctx.textBaseline = 'middle'

  const count = Math.max(2, Math.floor(TRACK_MAP_RULER_DIVISIONS))
  for (let i = 0; i <= count; i += 1) {
    const ratio = i / count
    const x = Math.round(ratio * width) + 0.5
    ctx.beginPath()
    ctx.moveTo(x, height - 5)
    ctx.lineTo(x, height)
    ctx.stroke()

    ctx.textAlign = i === 0 ? 'left' : i === count ? 'right' : 'center'
    ctx.fillText(formatRulerTime(viewport.startSec + ratio * span), clamp(x, 1, width - 1), height / 2)
  }
  ctx.textAlign = 'start'
  ctx.textBaseline = 'alphabetic'
}

function drawSections(draw: DrawContext, sections: TrackTimelineSection[]) {
  const { ctx, width, height, palette, fonts, hits, viewport } = draw
  // Flat fill only — no drawBackground horizontal rules (RTM's section lane
  // has none, and one landed exactly between the label and the colour pill).
  ctx.fillStyle = palette.background
  ctx.fillRect(0, 0, width, height)
  if (!sections.length) {
    drawCenteredMessage(draw, 'Section data unavailable')
    return
  }

  // React Track Map section treatment: no region fill and no divider — a
  // centered glowing UPPERCASE label sitting over a thin rounded colour pill
  // that spans the section's range. Bar bottom-anchored (RTM top:25 of 38 =
  // height − 13); label centered in the space above it.
  const barH = 5
  const barY = height - 13
  const labelY = Math.round((height - 13) / 2)

  sections.forEach(section => {
    if (!overlapsViewport(section.start, section.end, viewport)) return
    const x1 = timeToX(section.start, width, viewport)
    const x2 = Math.max(x1 + 1, timeToX(section.end, width, viewport))
    const color = sectionColor(section.type)
    const spanW = x2 - x1

    // Colour pill (rounded, soft glow), inset 2px like .rv-section-color-bar.
    ctx.save()
    ctx.shadowColor = rgba(color, 0.25)
    ctx.shadowBlur = 6
    ctx.fillStyle = rgba(color, 0.9)
    roundedRect(ctx, x1 + 2, barY, Math.max(1, spanW - 4), barH, 1)
    ctx.fill()
    ctx.restore()

    // Centered label with a soft colour glow.
    const available = Math.max(0, spanW - 8)
    if (available > 18) {
      ctx.save()
      ctx.font = `700 9px ${fonts.ui}`
      ctx.letterSpacing = '0.4px'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = rgba(color, 0.24)
      ctx.shadowBlur = 7
      ctx.fillStyle = color
      const label = fitText(ctx, String(section.label || section.type || 'Section').toUpperCase(), available)
      ctx.fillText(label, (x1 + x2) / 2, labelY)
      ctx.restore()
    }

    hits.push({
      x1,
      x2,
      y1: 0,
      y2: height,
      text: `${section.label}\n${formatTime(section.start)} → ${formatTime(section.end)}\nType: ${section.type} · Intensity: ${formatValue(section.intensity)}${section.confidence !== null ? ` · Confidence: ${formatValue(section.confidence)}` : ''}`,
    })
  })
  ctx.textAlign = 'start'
  ctx.textBaseline = 'alphabetic'
}

// React Track Map SECTION_COLORS (ReactTrackMapStrip). Free-form analysis
// section types are normalised onto the same enum palette; anything
// unrecognised falls back to the RTM "unknown" grey (no index cycling).
const TRACK_MAP_SECTION_COLORS: Record<string, string> = {
  intro: '#61d6aa',
  verse: '#4ac7db',
  build: '#d8b95a',
  predrop: '#f0a060',
  drop: '#c0314a',
  breakdown: '#b84fc9',
  bridge: '#5b8def',
  outro: '#80dfc0',
  unknown: '#6a7a8a',
}

function sectionColor(type: string): string {
  const key = type.toLowerCase().replace(/[^a-z]/g, '')
  if (TRACK_MAP_SECTION_COLORS[key]) return TRACK_MAP_SECTION_COLORS[key]!
  if (key.includes('predrop') || key.includes('prebuild')) return TRACK_MAP_SECTION_COLORS.predrop!
  if (key.includes('break')) return TRACK_MAP_SECTION_COLORS.breakdown!
  if (key.includes('drop')) return TRACK_MAP_SECTION_COLORS.drop!
  if (key.includes('build') || key.includes('rise')) return TRACK_MAP_SECTION_COLORS.build!
  if (key.includes('intro')) return TRACK_MAP_SECTION_COLORS.intro!
  if (key.includes('outro')) return TRACK_MAP_SECTION_COLORS.outro!
  if (key.includes('bridge')) return TRACK_MAP_SECTION_COLORS.bridge!
  if (key.includes('verse') || key.includes('chorus') || key.includes('hook')) return TRACK_MAP_SECTION_COLORS.verse!
  return TRACK_MAP_SECTION_COLORS.unknown!
}

function drawLineRow(draw: DrawContext, spec: Extract<TrackTimelineCanvasSpec, { kind: 'line' }>) {
  const { ctx, width, height, palette, hits, viewport } = draw
  drawBackground(draw)
  drawSectionContext(draw)
  const points = pointsInViewport(spec.points, viewport)
  if (!points.length) {
    drawCenteredMessage(draw, 'No curve points')
    return
  }
  const range = valueRange(points)
  const top = 8
  const bottom = height - 10
  const color = palette[spec.color]

  ctx.beginPath()
  points.forEach((point, index) => {
    const x = timeToX(point.time, width, viewport)
    const y = valueToY(point.value, range, top, bottom)
    if (index === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  if (spec.fill) {
    const first = points[0]!
    const last = points[points.length - 1]!
    ctx.lineTo(timeToX(last.time, width, viewport), bottom)
    ctx.lineTo(timeToX(first.time, width, viewport), bottom)
    ctx.closePath()
    const gradient = ctx.createLinearGradient(0, top, 0, bottom)
    gradient.addColorStop(0, rgba(color, 0.24))
    gradient.addColorStop(1, rgba(color, 0.015))
    ctx.fillStyle = gradient
    ctx.fill()
  }

  ctx.beginPath()
  points.forEach((point, index) => {
    const x = timeToX(point.time, width, viewport)
    const y = valueToY(point.value, range, top, bottom)
    if (index === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.strokeStyle = color
  ctx.lineWidth = 1.35
  ctx.stroke()
  drawRangeLabels(draw, range)
  const rangePoints = calculateExtrema(points)
  addPointHit(draw, rangePoints.min, `Minimum · ${spec.curveName}`)
  addPointHit(draw, rangePoints.max, `Maximum · ${spec.curveName}`)
  void hits
}

function drawHeatRow(draw: DrawContext, spec: Extract<TrackTimelineCanvasSpec, { kind: 'heat' }>) {
  const { ctx, width, height, palette, viewport } = draw
  drawBackground(draw)
  drawSectionContext(draw)
  const points = pointsInViewport(spec.points, viewport)
  if (!points.length) {
    drawCenteredMessage(draw, 'No heat-map points')
    return
  }
  const range = valueRange(points)
  const pixels = aggregateTimePoints(points, width, viewport)
  const color = palette[spec.color]
  pixels.forEach((entry, x) => {
    if (!entry) return
    const normalized = normalizeValue(entry.value, range)
    ctx.fillStyle = rgba(color, 0.05 + normalized * 0.64)
    ctx.fillRect(x, 6, 1.25, height - 12)
    const barHeight = Math.max(1, normalized * (height - 14))
    ctx.fillStyle = rgba(color, 0.2 + normalized * 0.68)
    ctx.fillRect(x, height - 7 - barHeight, 1.25, barHeight)
  })
  drawRangeLabels(draw, range)
  const rangePoints = calculateExtrema(points)
  addPointHit(draw, rangePoints.min, `Minimum · ${spec.metric}`)
  addPointHit(draw, rangePoints.max, `Maximum · ${spec.metric}`)
}

function drawEventRow(draw: DrawContext, spec: Extract<TrackTimelineCanvasSpec, { kind: 'events' }>) {
  const { ctx, width, height, palette, fonts, hits, viewport } = draw
  drawBackground(draw)
  drawSectionContext(draw)
  if (!spec.events.length) return
  let lastLabelRight = -100

  spec.events.forEach((item, index) => {
    if (!overlapsViewport(item.time, item.time + Math.max(0, item.duration), viewport)) return
    const x = timeToX(item.time, width, viewport)
    const x2 = item.duration > 0 ? Math.max(x + 2, timeToX(item.time + item.duration, width, viewport)) : x
    const color = palette[EVENT_COLOR_KEYS[item.type] ?? spec.color]
    if (item.duration > 0) {
      ctx.fillStyle = rgba(color, 0.15)
      ctx.fillRect(x, 9, x2 - x, height - 18)
    }
    ctx.strokeStyle = rgba(color, 0.82)
    ctx.lineWidth = item.type === 'downbeat' || item.type === 'major_impact' ? 1.6 : 1
    ctx.beginPath()
    ctx.moveTo(x + 0.5, 5)
    ctx.lineTo(x + 0.5, height - 6)
    ctx.stroke()

    const diamondY = height / 2
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(x, diamondY - 4)
    ctx.lineTo(x + 4, diamondY)
    ctx.lineTo(x, diamondY + 4)
    ctx.lineTo(x - 4, diamondY)
    ctx.closePath()
    ctx.fill()

    if (spec.events.length <= 45 && x > lastLabelRight + 8) {
      ctx.font = `9px ${fonts.data}`
      const clipped = fitText(ctx, item.label, 120)
      ctx.fillStyle = rgba(color, 0.94)
      ctx.fillText(clipped, x + 5, 11 + (index % 2) * 13)
      lastLabelRight = x + 5 + ctx.measureText(clipped).width
    }

    hits.push({
      x1: x - 5,
      x2: Math.max(x + 6, x2),
      y1: 0,
      y2: height,
      text: `${item.label}\n${formatTime(item.time)}${item.duration ? ` · duration ${item.duration.toFixed(3)}s` : ''}${item.confidence !== null ? `\nConfidence: ${formatValue(item.confidence)}` : ''}${item.value !== null && item.value !== undefined ? `\nValue: ${formatValue(item.value)}` : ''}`,
    })
  })
}

function drawExtremaRow(draw: DrawContext, spec: Extract<TrackTimelineCanvasSpec, { kind: 'extrema' }>) {
  const { ctx, width, height, palette, viewport } = draw
  drawBackground(draw)
  drawSectionContext(draw)
  const points = pointsInViewport(spec.points, viewport)
  if (!points.length) return
  const range = valueRange(points)
  const color = palette[spec.color]

  if (spec.style === 'line') {
    ctx.beginPath()
    points.forEach((point, index) => {
      const x = timeToX(point.time, width, viewport)
      const y = valueToY(point.value, range, 8, height - 9)
      if (index === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.strokeStyle = rgba(color, 0.68)
    ctx.lineWidth = 1
    ctx.stroke()
  } else {
    const pixels = aggregateTimePoints(points, width, viewport)
    pixels.forEach((entry, x) => {
      if (!entry) return
      const normalized = normalizeValue(entry.value, range)
      ctx.fillStyle = rgba(color, 0.05 + normalized * 0.34)
      ctx.fillRect(x, 6, 1.2, height - 12)
    })
  }

  const rangePoints = calculateExtrema(points)
  drawExtremaBadge(draw, rangePoints.min, 'MIN', 'cyan', 8)
  drawExtremaBadge(draw, rangePoints.max, 'MAX', 'red', height - 23)
}

function drawExtremaBadge(
  draw: DrawContext,
  point: TrackTimelinePoint,
  label: 'MIN' | 'MAX',
  colorKey: PaletteKey,
  y: number,
) {
  const { ctx, width, height, palette, fonts, hits, viewport } = draw
  const x = timeToX(point.time, width, viewport)
  const color = palette[colorKey]
  const text = `${label} ${formatValue(point.value)}`
  ctx.font = `700 9px ${fonts.data}`
  const badgeWidth = ctx.measureText(text).width + 10
  const badgeX = clamp(x - badgeWidth / 2, 2, width - badgeWidth - 2)
  ctx.fillStyle = rgba(color, 0.18)
  ctx.strokeStyle = rgba(color, 0.82)
  ctx.lineWidth = 1
  roundedRect(ctx, badgeX, y, badgeWidth, 16, 4)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = color
  ctx.textBaseline = 'top'
  ctx.fillText(text, badgeX + 5, y + 4)
  ctx.textBaseline = 'alphabetic'
  ctx.strokeStyle = rgba(color, 0.72)
  ctx.beginPath()
  ctx.moveTo(x + 0.5, label === 'MIN' ? y + 16 : 4)
  ctx.lineTo(x + 0.5, label === 'MIN' ? height - 4 : y)
  ctx.stroke()
  hits.push({
    x1: badgeX,
    x2: badgeX + badgeWidth,
    y1: y,
    y2: y + 16,
    text: `${label} · ${formatValue(point.value)}\n${formatTime(point.time)}`,
  })
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function aggregateTimePoints(points: TrackTimelinePoint[], width: number, viewport: TrackTimelineViewport) {
  const columns = Array.from({ length: Math.max(1, Math.floor(width)) }, () => null as { value: number; count: number } | null)
  points.forEach(point => {
    if (point.time < viewport.startSec || point.time > viewport.endSec) return
    const index = clamp(Math.floor(((point.time - viewport.startSec) / Math.max(viewport.endSec - viewport.startSec, 0.001)) * columns.length), 0, columns.length - 1)
    const existing = columns[index] ?? { value: 0, count: 0 }
    existing.value += point.value
    existing.count += 1
    columns[index] = existing
  })
  columns.forEach(column => {
    if (column) column.value /= column.count
  })
  return columns
}

function valueRange(points: TrackTimelinePoint[]) {
  const values = points.map(point => point.value).filter(Number.isFinite)
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 }
  if (min === max) {
    const padding = Math.abs(min || 1) * 0.1
    min -= padding
    max += padding
  }
  return { min, max }
}

function calculateExtrema(points: TrackTimelinePoint[]) {
  let min = points[0]!
  let max = points[0]!
  points.forEach(point => {
    if (point.value < min.value) min = point
    if (point.value > max.value) max = point
  })
  return { min, max }
}

function valueToY(value: number, range: { min: number; max: number }, top: number, bottom: number): number {
  return bottom - normalizeValue(value, range) * (bottom - top)
}

function normalizeValue(value: number, range: { min: number; max: number }): number {
  return clamp((value - range.min) / Math.max(range.max - range.min, 1e-9), 0, 1)
}

function drawRangeLabels(draw: DrawContext, range: { min: number; max: number }) {
  const { ctx, height, palette, fonts } = draw
  ctx.font = `9px ${fonts.data}`
  ctx.fillStyle = rgba(palette.muted, 0.72)
  ctx.textBaseline = 'top'
  ctx.fillText(formatValue(range.max), 4, 3)
  ctx.fillText(formatValue(range.min), 4, height - 13)
  ctx.textBaseline = 'alphabetic'
}

function addPointHit(draw: DrawContext, point: TrackTimelinePoint, label: string) {
  const x = timeToX(point.time, draw.width, draw.viewport)
  draw.hits.push({
    x1: x - 7,
    x2: x + 7,
    y1: 0,
    y2: draw.height,
    text: `${label}\n${formatTime(point.time)} · ${formatValue(point.value)}`,
  })
}

function drawCenteredMessage(draw: DrawContext, message: string) {
  const { ctx, width, height, palette, fonts } = draw
  ctx.fillStyle = rgba(palette.muted, 0.82)
  ctx.font = `11px ${fonts.data}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(message, width / 2, height / 2)
  ctx.textAlign = 'start'
  ctx.textBaseline = 'alphabetic'
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (maxWidth <= 0) return ''
  if (ctx.measureText(text).width <= maxWidth) return text
  let clipped = text
  while (clipped.length > 1 && ctx.measureText(`${clipped}…`).width > maxWidth) clipped = clipped.slice(0, -1)
  return clipped ? `${clipped}…` : ''
}

export function formatTime(seconds: number, milliseconds = true): string {
  const safe = Math.max(0, finite(seconds))
  const minutes = Math.floor(safe / 60)
  const wholeSeconds = Math.floor(safe % 60)
  const ms = Math.round((safe - Math.floor(safe)) * 1000)
  return `${String(minutes).padStart(2, '0')}:${String(wholeSeconds).padStart(2, '0')}${milliseconds ? `.${String(ms).padStart(3, '0')}` : ''}`
}

function formatValue(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a'
  if (Math.abs(value) >= 100) return value.toFixed(1)
  if (Math.abs(value) >= 10) return value.toFixed(2)
  if (Math.abs(value) >= 1) return value.toFixed(3)
  return value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}
