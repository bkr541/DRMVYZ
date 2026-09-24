import {
  CINEMA2_HUMN_PRESET_ID,
  Cinema2AudioIntelligenceBridge,
  Cinema2Runtime,
  cinema2NativePresetRegistry,
} from '../../components/vyzualz/cinema2'
import { humMusicFrame, type HumFrameInput } from '../../components/vyzualz/cinema2/__tests__/support/Cinema2HumNFrameFactory'

type FrameStep = Omit<HumFrameInput, 'frameId' | 'timeSec'> & { frames?: number; dt?: number; timeSec?: number; pause?: boolean }

interface ScenarioInput {
  /** Persistent parameter values keyed by canonical parameter id. */
  state?: Record<string, number | boolean | string>
  steps: readonly FrameStep[]
  /** Render size; defaults to 640x360. */
  size?: { width: number; height: number }
}

interface Region {
  x0: number
  y0: number
  x1: number
  y1: number
}

interface RenderedFrame {
  width: number
  height: number
  pixels: number[]
  diagnostics: string
  failedPassCount: number
}

const DEFAULT_SIZE = { width: 640, height: 360 }
const STICKY_KEYS = ['dropMoments', 'phrases', 'sectionType', 'sectionStartSec', 'sectionEndSec', 'dropConfidence'] as const

/** Renders a scenario through the production Cinema 2.0 runtime on a real WebGL2 canvas. */
function render(input: ScenarioInput): RenderedFrame {
  const { width: WIDTH, height: HEIGHT } = input.size ?? DEFAULT_SIZE
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  document.body.append(canvas)
  const callbacks = new Map<number, FrameRequestCallback>()
  let nextRafId = 1
  let rafClock = 0
  let sequence = 0
  let upstream = humMusicFrame({ frameId: 1, timeSec: 10 })
  const transport = { sourcePresent: true, playing: true, analysisActive: true, paused: false, trackId: 'hum-n-reactivity-track' as string | null, timeSec: 10 }
  const bridge = new Cinema2AudioIntelligenceBridge({
    getFrame: () => upstream,
    getPublicationMeta: () => ({ sequence, publishedAtMs: upstream.timeSec * 1000, publisherId: 'hum-n-browser', kind: 'frame' as const }),
  })
  const created = Cinema2Runtime.create(canvas, {
    presetId: CINEMA2_HUMN_PRESET_ID,
    presetRegistry: cinema2NativePresetRegistry,
    audioIntelligenceBridge: bridge,
    transportSource: { getState: () => transport },
    randomness: { mode: 'deterministic', seed: 'hum-n-reactivity-seed' },
    renderQuality: 'high',
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      const id = nextRafId++
      callbacks.set(id, callback)
      return id
    },
    cancelAnimationFrame: (id: number) => { callbacks.delete(id) },
  })
  if (!created.runtime) {
    canvas.remove()
    throw new Error(`HUM:N runtime failed: ${created.error}`)
  }
  const runtime = created.runtime
  try {
    runtime.resize({ width: WIDTH, height: HEIGHT, dpr: 1 })
    runtime.start()
    for (const [id, value] of Object.entries(input.state ?? {})) {
      const result = runtime.getParameterState().setPersistentValue(id as never, value as never)
      if (!(result as { ok?: boolean }).ok) throw new Error(`Could not set ${id}`)
    }
    let frameId = 1
    let timeSec = 10
    const sticky: Partial<HumFrameInput> = {}
    for (const step of input.steps) {
      for (const key of STICKY_KEYS) {
        if (key in step) (sticky as Record<string, unknown>)[key] = (step as Record<string, unknown>)[key]
      }
      if (step.pause !== undefined) transport.paused = step.pause
      const frames = step.frames ?? 1
      const dt = step.dt ?? 1 / 30
      for (let index = 0; index < frames; index++) {
        frameId += 1
        timeSec = step.timeSec != null && index === 0 ? step.timeSec : transport.paused ? timeSec : timeSec + dt
        transport.timeSec = timeSec
        transport.trackId = step.trackId ?? 'hum-n-reactivity-track'
        const first = index === 0
        upstream = humMusicFrame({
          ...sticky,
          ...step,
          frameId,
          timeSec,
          beat: first && step.beat,
          downbeat: first && step.downbeat,
          kick: first ? step.kick : 0,
          snare: first ? step.snare : 0,
        })
        sequence += 1
        rafClock += dt * 1000
        const entry = [...callbacks.entries()][0]
        if (!entry) throw new Error('No HUM:N frame scheduled')
        callbacks.delete(entry[0])
        entry[1](rafClock)
      }
    }
    // Read back in the same task as the last draw, before the canvas is presented.
    const scratch = document.createElement('canvas')
    scratch.width = WIDTH
    scratch.height = HEIGHT
    const context = scratch.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('2D context unavailable')
    context.drawImage(canvas, 0, 0)
    const data = context.getImageData(0, 0, WIDTH, HEIGHT).data
    const snapshot = runtime.getSnapshot()
    const executor = runtime.getRenderGraphExecutorSnapshot()
    const diagnostics = JSON.stringify({ phase: snapshot.phase, frameCount: snapshot.frameCount, executor, status: snapshot.statusMessage, modules: runtime.getModuleRuntimeSnapshot() })
    return { width: WIDTH, height: HEIGHT, pixels: Array.from(data), diagnostics, failedPassCount: executor.failedPassCount }
  } finally {
    runtime.dispose()
    canvas.remove()
  }
}

interface Bounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

interface DiffMetrics {
  width: number
  height: number
  changedPixels: number
  totalPixels: number
  meanAbsDiff: number
  maxChannelDiff: number
  /** Pixels that changed inside four 48x48 corner blocks. */
  changedInCorners: number
  /** Share of all changed pixels that lie inside the central figure region. */
  figureRegionShare: number
  meanLuma: number
  failedPassCount: number
  /** Bounding box of all changed pixels (null when identical). */
  changedBounds: Bounds | null
  /** Changed-pixel count per requested normalized region (x0,y0,x1,y1 in 0..1). */
  regionChanges: number[]
  /** Bounding box of lit (figure/limb) pixels in the second frame and in the first. */
  litBoundsAfter: Bounds | null
  litBoundsBefore: Bounds | null
  /** Bounding box of lit pixels in the upper half of the second frame (head/crown, not the torso). */
  headBoundsAfter: Bounds | null
  /** Width of lit pixels inside the head band (y 8%..48%) for both frames. */
  headBandWidthBefore: number
  headBandWidthAfter: number
}

const LIT_LUMA = 95
const CHANGE_THRESHOLD = 6

function boundsOf(frame: RenderedFrame, region?: { y0: number; y1: number }): Bounds | null {
  const { width, height, pixels } = frame
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  const y0 = Math.floor((region?.y0 ?? 0) * height)
  const y1 = Math.ceil((region?.y1 ?? 1) * height)
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4
      const luma = 0.2126 * pixels[offset]! + 0.7152 * pixels[offset + 1]! + 0.0722 * pixels[offset + 2]!
      if (luma > LIT_LUMA) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  return maxX < 0 ? null : { minX, maxX, minY, maxY }
}

function analyze(a: RenderedFrame, b: RenderedFrame, regions: readonly Region[] = []): DiffMetrics {
  const { width, height } = a
  let changed = 0
  let sum = 0
  let max = 0
  let corners = 0
  let inFigure = 0
  let luma = 0
  const regionChanges = regions.map(() => 0)
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  const total = width * height
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4
      let pixelMax = 0
      for (let channel = 0; channel < 3; channel++) {
        const diff = Math.abs(a.pixels[offset + channel]! - b.pixels[offset + channel]!)
        sum += diff
        if (diff > pixelMax) pixelMax = diff
      }
      if (pixelMax > max) max = pixelMax
      luma += 0.2126 * b.pixels[offset]! + 0.7152 * b.pixels[offset + 1]! + 0.0722 * b.pixels[offset + 2]!
      if (pixelMax > CHANGE_THRESHOLD) {
        changed += 1
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
        const inCorner = (x < 48 || x >= width - 48) && (y < 48 || y >= height - 48)
        if (inCorner) corners += 1
        if (x > width * 0.25 && x < width * 0.75 && y > height * 0.05 && y < height * 0.95) inFigure += 1
        regions.forEach((region, index) => {
          if (x >= region.x0 * width && x < region.x1 * width && y >= region.y0 * height && y < region.y1 * height) regionChanges[index] += 1
        })
      }
    }
  }
  const headBand = { y0: 0.08, y1: 0.48 }
  const beforeBand = boundsOf(a, headBand)
  const afterBand = boundsOf(b, headBand)
  return {
    width,
    height,
    changedPixels: changed,
    totalPixels: total,
    meanAbsDiff: sum / (total * 3),
    maxChannelDiff: max,
    changedInCorners: corners,
    figureRegionShare: changed === 0 ? 1 : inFigure / changed,
    meanLuma: luma / total,
    failedPassCount: a.failedPassCount + b.failedPassCount,
    changedBounds: changed === 0 ? null : { minX, maxX, minY, maxY },
    regionChanges,
    litBoundsAfter: boundsOf(b),
    litBoundsBefore: boundsOf(a),
    headBoundsAfter: boundsOf(b, { y0: 0, y1: 0.5 }),
    headBandWidthBefore: beforeBand ? beforeBand.maxX - beforeBand.minX : 0,
    headBandWidthAfter: afterBand ? afterBand.maxX - afterBand.minX : 0,
  }
}

function contactSheet(scenarios: readonly { label: string; scenario: ScenarioInput }[]): string {
  const { width: WIDTH, height: HEIGHT } = DEFAULT_SIZE
  const columns = 2
  const rows = Math.ceil(scenarios.length / columns)
  const sheet = document.createElement('canvas')
  sheet.width = WIDTH * columns
  sheet.height = (HEIGHT + 22) * rows
  const context = sheet.getContext('2d')
  if (!context) throw new Error('2D context unavailable')
  context.fillStyle = '#111'
  context.fillRect(0, 0, sheet.width, sheet.height)
  scenarios.forEach((entry, index) => {
    const frame = render({ ...entry.scenario, size: DEFAULT_SIZE })
    const image = new ImageData(new Uint8ClampedArray(frame.pixels), WIDTH, HEIGHT)
    const x = (index % columns) * WIDTH
    const y = Math.floor(index / columns) * (HEIGHT + 22)
    context.putImageData(image, x, y + 22)
    context.fillStyle = '#9ff'
    context.font = '13px sans-serif'
    context.fillText(entry.label, x + 6, y + 15)
  })
  return sheet.toDataURL('image/png')
}

declare global {
  interface Window {
    __DRMVYZ_CINEMA2_HUMN_ACCEPTANCE__?: {
      compare(before: ScenarioInput, after: ScenarioInput, regions?: readonly Region[]): DiffMetrics
      /** Debug/visual review: renders scenarios into one labelled contact sheet PNG. */
      contactSheet(scenarios: readonly { label: string; scenario: ScenarioInput }[]): string
    }
  }
}

window.__DRMVYZ_CINEMA2_HUMN_ACCEPTANCE__ = {
  compare: (before, after, regions) => analyze(render(before), render(after), regions),
  contactSheet,
}
const status = document.querySelector<HTMLElement>('[data-cinema2-humn-status]')
if (status) {
  status.dataset.result = 'ready'
  status.textContent = 'ready'
}
