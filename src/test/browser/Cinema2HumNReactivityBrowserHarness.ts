import { DEFAULT_MI_FRAME } from '../../features/musicIntelligence/constants'
import {
  CINEMA2_HUMN_PRESET_ID,
  Cinema2AudioIntelligenceBridge,
  Cinema2Runtime,
  cinema2NativePresetRegistry,
} from '../../components/vyzualz/cinema2'
import { humMusicFrame, type HumFrameInput } from '../../components/vyzualz/cinema2/__tests__/support/Cinema2HumNFrameFactory'

void DEFAULT_MI_FRAME

type FrameStep = Omit<HumFrameInput, 'frameId' | 'timeSec'> & { frames?: number; dt?: number; timeSec?: number }

interface ScenarioInput {
  /** Persistent parameter values keyed by canonical parameter id. */
  state?: Record<string, number | boolean | string>
  steps: readonly FrameStep[]
}

const WIDTH = 640
const HEIGHT = 360

/** Renders a scenario through the production Cinema 2.0 runtime on a real WebGL2 canvas. */
function render(input: ScenarioInput): { width: number; height: number; pixels: number[]; diagnostics: string; failedPassCount: number } {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  document.body.append(canvas)
  const callbacks = new Map<number, FrameRequestCallback>()
  let nextRafId = 1
  let rafClock = 0
  let sequence = 0
  let upstream = humMusicFrame({ frameId: 1, timeSec: 10 })
  const transport = { sourcePresent: true, playing: true, analysisActive: true, paused: false, trackId: 'hum-n-browser-track' as string | null, timeSec: 10 }
  const bridge = new Cinema2AudioIntelligenceBridge({
    getFrame: () => upstream,
    getPublicationMeta: () => ({ sequence, publishedAtMs: upstream.timeSec * 1000, publisherId: 'hum-n-browser', kind: 'frame' as const }),
  })
  const created = Cinema2Runtime.create(canvas, {
    presetId: CINEMA2_HUMN_PRESET_ID,
    presetRegistry: cinema2NativePresetRegistry,
    audioIntelligenceBridge: bridge,
    transportSource: { getState: () => transport },
    randomness: { mode: 'deterministic', seed: 'hum-n-browser-acceptance' },
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
    for (const step of input.steps) {
      const frames = step.frames ?? 1
      const dt = step.dt ?? 1 / 30
      for (let index = 0; index < frames; index++) {
        frameId += 1
        timeSec = step.timeSec != null && index === 0 ? step.timeSec : timeSec + dt
        transport.timeSec = timeSec
        const first = index === 0
        upstream = humMusicFrame({
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

interface DiffMetrics {
  changedPixels: number
  totalPixels: number
  meanAbsDiff: number
  maxChannelDiff: number
  /** Pixels that changed inside four 48x48 corner blocks (stage/grid only, no figure). */
  changedInCorners: number
  /** Share of all changed pixels that lie inside the central figure region. */
  figureRegionShare: number
  /** Number of pixels whose color is dominated by the second (magenta) skin role. */
  magentaPixels: number
  /** Mean luminance of the second frame, for gross "did the whole frame flash" checks. */
  meanLuma: number
  /** Render-graph pass failures across both renders (must be 0). */
  failedPassCount: number
}

function analyze(a: { pixels: number[]; failedPassCount: number }, b: { pixels: number[]; failedPassCount: number }): DiffMetrics {
  let changed = 0
  let sum = 0
  let max = 0
  let corners = 0
  let inFigure = 0
  let magenta = 0
  let luma = 0
  const total = WIDTH * HEIGHT
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const offset = (y * WIDTH + x) * 4
      let pixelMax = 0
      for (let channel = 0; channel < 3; channel++) {
        const diff = Math.abs(a.pixels[offset + channel]! - b.pixels[offset + channel]!)
        sum += diff
        if (diff > pixelMax) pixelMax = diff
      }
      if (pixelMax > max) max = pixelMax
      const r = b.pixels[offset]!
      const g = b.pixels[offset + 1]!
      const bl = b.pixels[offset + 2]!
      luma += 0.2126 * r + 0.7152 * g + 0.0722 * bl
      if (r > 150 && bl > 120 && g < 110) magenta += 1
      if (pixelMax > 6) {
        changed += 1
        const inCorner = (x < 48 || x >= WIDTH - 48) && (y < 48 || y >= HEIGHT - 48)
        if (inCorner) corners += 1
        if (x > WIDTH * 0.25 && x < WIDTH * 0.75 && y > HEIGHT * 0.05 && y < HEIGHT * 0.95) inFigure += 1
      }
    }
  }
  return {
    changedPixels: changed,
    totalPixels: total,
    meanAbsDiff: sum / (total * 3),
    maxChannelDiff: max,
    changedInCorners: corners,
    figureRegionShare: changed === 0 ? 1 : inFigure / changed,
    magentaPixels: magenta,
    meanLuma: luma / total,
    failedPassCount: a.failedPassCount + b.failedPassCount,
  }
}

declare global {
  interface Window {
    __DRMVYZ_CINEMA2_HUMN_ACCEPTANCE__?: {
      compare(before: ScenarioInput, after: ScenarioInput): DiffMetrics
      /** Debug/visual review: renders scenarios into one labelled contact sheet PNG. */
      contactSheet(scenarios: readonly { label: string; scenario: ScenarioInput }[]): string
    }
  }
}

function contactSheet(scenarios: readonly { label: string; scenario: ScenarioInput }[]): string {
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
    const frame = render(entry.scenario)
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

window.__DRMVYZ_CINEMA2_HUMN_ACCEPTANCE__ = {
  compare: (before, after) => analyze(render(before), render(after)),
  contactSheet,
}
const status = document.querySelector<HTMLElement>('[data-cinema2-humn-status]')
if (status) {
  status.dataset.result = 'ready'
  status.textContent = 'ready'
}
