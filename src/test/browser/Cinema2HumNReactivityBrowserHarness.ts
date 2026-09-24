import {
  CINEMA2_HUMN_PRESET_ID,
  Cinema2AudioIntelligenceBridge,
  Cinema2Runtime,
  cinema2NativePresetRegistry,
} from '../../components/vyzualz/cinema2'
import { humMusicFrame, type HumFrameInput } from '../../components/vyzualz/cinema2/__tests__/support/Cinema2HumNFrameFactory'

type ParameterValue = number | boolean | string | readonly number[]

type FrameStep = Omit<HumFrameInput, 'frameId' | 'timeSec'> & {
  frames?: number
  dt?: number
  timeSec?: number
  pause?: boolean
  /** Persistent parameter edits applied before this step's frames (mid-run user changes). */
  state?: Record<string, ParameterValue>
}

interface ScenarioInput {
  /** Persistent parameter values keyed by canonical parameter id. */
  state?: Record<string, ParameterValue>
  steps: readonly FrameStep[]
  /** Render size; defaults to 640x360. */
  size?: { width: number; height: number }
  /** Host (Audio Dock) Sync preference; preset-level BPM Sync only narrows it. Defaults to off. */
  hostSync?: boolean
}

interface Region {
  x0: number
  y0: number
  x1: number
  y1: number
}

interface Inspection {
  history: { activeBufferCount: number; validBufferCount: number; lastResetReason: string; resetCount: number; buffers: readonly { name: string; valid: boolean; width: number; height: number }[] }
  effects: readonly { effectId: string; status: string }[]
  executedPassCount: number
  resources: { activeLeaseCount: number; activeSurfaceCount: number; estimatedGpuMemoryBytes: number }
  /** Resource ownership after runtime.dispose(): everything must be released. */
  resourcesAfterDispose: { activeLeaseCount: number; activeSurfaceCount: number; estimatedGpuMemoryBytes: number; disposed: boolean }
  historyAfterDispose: { activeBufferCount: number; disposed: boolean }
}

interface RenderedFrame {
  width: number
  height: number
  pixels: number[]
  diagnostics: string
  failedPassCount: number
  inspection: Inspection
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
  const transport = { sourcePresent: true, playing: true, analysisActive: true, paused: false, trackId: 'hum-n-reactivity-track' as string | null, timeSec: 10, bpmSync: input.hostSync === true }
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
  let disposed = false
  try {
    runtime.resize({ width: WIDTH, height: HEIGHT, dpr: 1 })
    runtime.start()
    const applyState = (values: Record<string, ParameterValue> | undefined) => {
      for (const [id, value] of Object.entries(values ?? {})) {
        const result = runtime.getParameterState().setPersistentValue(id as never, value as never)
        if (!(result as { ok?: boolean }).ok) throw new Error(`Could not set ${id}`)
      }
    }
    applyState(input.state)
    let frameId = 1
    let timeSec = 10
    const sticky: Partial<HumFrameInput> = {}
    for (const step of input.steps) {
      applyState(step.state)
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
    const history = runtime.getHistoryServiceSnapshot()
    const resources = runtime.getResourceManagerSnapshot()
    const inspection: Inspection = {
      history: {
        activeBufferCount: history.activeBufferCount,
        validBufferCount: history.validBufferCount,
        lastResetReason: history.lastResetReason,
        resetCount: history.resetCount,
        buffers: history.buffers.map(buffer => ({ name: buffer.name, valid: buffer.valid, width: buffer.width, height: buffer.height })),
      },
      effects: runtime.getEffectRuntimeSnapshot().effects.map(effect => ({ effectId: String(effect.effectId), status: effect.status })),
      executedPassCount: executor.executedPassCount,
      resources: { activeLeaseCount: resources.activeLeaseCount, activeSurfaceCount: resources.activeSurfaceCount, estimatedGpuMemoryBytes: resources.estimatedGpuMemoryBytes },
      resourcesAfterDispose: { activeLeaseCount: 0, activeSurfaceCount: 0, estimatedGpuMemoryBytes: 0, disposed: false },
      historyAfterDispose: { activeBufferCount: 0, disposed: false },
    }
    runtime.dispose()
    disposed = true
    const after = runtime.getResourceManagerSnapshot()
    inspection.resourcesAfterDispose = { activeLeaseCount: after.activeLeaseCount, activeSurfaceCount: after.activeSurfaceCount, estimatedGpuMemoryBytes: after.estimatedGpuMemoryBytes, disposed: after.disposed }
    const historyAfter = runtime.getHistoryServiceSnapshot()
    inspection.historyAfterDispose = { activeBufferCount: historyAfter.activeBufferCount, disposed: historyAfter.disposed }
    return { width: WIDTH, height: HEIGHT, pixels: Array.from(data), diagnostics, failedPassCount: executor.failedPassCount, inspection }
  } finally {
    if (!disposed) runtime.dispose()
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
  /** True when every byte of both frames matches. */
  identical: boolean
  /** Pixels that were black (<=4) before and visibly lit (>30) after: halo/echo reaching negative space. */
  blackLifted: number
  /** Share of the lit-before pixels that are still lit after (structure survival). */
  litSurvival: number
  /** Sum of channel values, used to compare light energy. */
  energyBefore: number
  energyAfter: number
  hashBefore: string
  hashAfter: string
  inspectionBefore: Inspection
  inspectionAfter: Inspection
}

function hashPixels(pixels: readonly number[]): string {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let index = 0; index < pixels.length; index++) {
    const value = pixels[index]!
    h1 = Math.imul(h1 ^ value, 0x01000193) >>> 0
    h2 = Math.imul(h2 + value + index, 0x85ebca6b) >>> 0
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`
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
  let identical = true
  let blackLifted = 0
  let litBefore = 0
  let litStill = 0
  let energyBefore = 0
  let energyAfter = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4
      const beforeMax = Math.max(a.pixels[offset]!, a.pixels[offset + 1]!, a.pixels[offset + 2]!)
      const afterMax = Math.max(b.pixels[offset]!, b.pixels[offset + 1]!, b.pixels[offset + 2]!)
      energyBefore += a.pixels[offset]! + a.pixels[offset + 1]! + a.pixels[offset + 2]!
      energyAfter += b.pixels[offset]! + b.pixels[offset + 1]! + b.pixels[offset + 2]!
      if (beforeMax <= 4 && afterMax > 30) blackLifted += 1
      if (beforeMax > LIT_LUMA) {
        litBefore += 1
        if (afterMax > LIT_LUMA) litStill += 1
      }
      let pixelMax = 0
      for (let channel = 0; channel < 3; channel++) {
        const diff = Math.abs(a.pixels[offset + channel]! - b.pixels[offset + channel]!)
        sum += diff
        if (diff !== 0) identical = false
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
    identical,
    blackLifted,
    litSurvival: litBefore === 0 ? 1 : litStill / litBefore,
    energyBefore,
    energyAfter,
    hashBefore: hashPixels(a.pixels),
    hashAfter: hashPixels(b.pixels),
    inspectionBefore: a.inspection,
    inspectionAfter: b.inspection,
  }
}

function contactSheet(
  scenarios: readonly { label: string; scenario: ScenarioInput }[],
  size: { width: number; height: number } = DEFAULT_SIZE,
  /** Optional normalized crop, drawn 2x for close inspection of edges. */
  crop?: Region,
): string {
  const { width: WIDTH, height: HEIGHT } = size
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
    const frame = render({ ...entry.scenario, size })
    const image = new ImageData(new Uint8ClampedArray(frame.pixels), WIDTH, HEIGHT)
    const x = (index % columns) * WIDTH
    const y = Math.floor(index / columns) * (HEIGHT + 22)
    if (crop) {
      const scratch = document.createElement('canvas')
      scratch.width = WIDTH
      scratch.height = HEIGHT
      scratch.getContext('2d')!.putImageData(image, 0, 0)
      context.imageSmoothingEnabled = false
      context.drawImage(scratch, crop.x0 * WIDTH, crop.y0 * HEIGHT, (crop.x1 - crop.x0) * WIDTH, (crop.y1 - crop.y0) * HEIGHT, x, y + 22, WIDTH, HEIGHT)
    } else {
      context.putImageData(image, x, y + 22)
    }
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
      /** Renders a scenario once and reports its pixel hash, luminous bounds and engine resource/history state. */
      inspect(scenario: ScenarioInput): { hash: string; inspection: Inspection; failedPassCount: number; litBounds: Bounds | null; meanLuma: number }
      /** Debug/visual review: renders scenarios into one labelled contact sheet PNG. */
      contactSheet(scenarios: readonly { label: string; scenario: ScenarioInput }[], size?: { width: number; height: number }, crop?: Region): string
    }
  }
}

window.__DRMVYZ_CINEMA2_HUMN_ACCEPTANCE__ = {
  compare: (before, after, regions) => analyze(render(before), render(after), regions),
  inspect: scenario => {
    const frame = render(scenario)
    let luma = 0
    for (let offset = 0; offset < frame.pixels.length; offset += 4) luma += 0.2126 * frame.pixels[offset]! + 0.7152 * frame.pixels[offset + 1]! + 0.0722 * frame.pixels[offset + 2]!
    return { hash: hashPixels(frame.pixels), inspection: frame.inspection, failedPassCount: frame.failedPassCount, litBounds: boundsOf(frame), meanLuma: luma / (frame.width * frame.height) }
  },
  contactSheet,
}
const status = document.querySelector<HTMLElement>('[data-cinema2-humn-status]')
if (status) {
  status.dataset.result = 'ready'
  status.textContent = 'ready'
}
