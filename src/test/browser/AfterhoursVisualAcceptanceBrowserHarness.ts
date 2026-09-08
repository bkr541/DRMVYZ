import {
  CINEMA_FOUNDATION_INPUT_PORT_ID,
  CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
  createCinemaFoundationPersistedState,
} from '../../components/vyzualz/cinema/CinemaFoundation'
import {
  createCinemaCinematicWorldComposition,
  createCinemaCinematicWorldParameterValues,
} from '../../components/vyzualz/cinema/CinemaCinematicWorldAdapter'
import { cinemaStableId, type CinemaCompositionId, type CinemaEventId, type CinemaParameterId } from '../../components/vyzualz/cinema/CinemaIdentifiers'
import type { CinemaParameterValue } from '../../components/vyzualz/cinema/CinemaDomain'
import type { CinemaFrameContext } from '../../components/vyzualz/cinema/CinemaRendererContracts'
import { CinemaRuntime } from '../../components/vyzualz/cinema/runtime/CinemaRuntime'
import { createCinematicWorldConfig } from '../../components/vyzualz/react/CinematicWorldConfig'
import type { AfterhoursSettings } from '../../components/vyzualz/react/CinematicWorldSettings'
import {
  AFTERHOURS_VISUAL_ACCEPTANCE_CHECKPOINTS,
  getAfterhoursVisualAcceptanceCheckpoint,
  type AfterhoursVisualAcceptanceCheckpoint,
  type AfterhoursVisualAcceptanceCheckpointId,
  type AfterhoursVisualAcceptanceMusicState,
} from '../../components/vyzualz/react/renderers/cinematic/worlds/AfterhoursVisualAcceptanceHarness'
import {
  setAfterhoursVisualAcceptanceObserver,
  type AfterhoursVisualAcceptanceMetadata,
} from '../../components/vyzualz/react/renderers/cinematic/worlds/AfterhoursVisualAcceptanceDiagnostics'

interface BrowserReport {
  readonly checkpointId: string
  readonly metadata: Readonly<AfterhoursVisualAcceptanceMetadata>
  readonly graph: ReturnType<CinemaRuntime['getSnapshot']>['graph']
}

type MusicOverride = Partial<Omit<AfterhoursVisualAcceptanceMusicState, 'impulses'>> & Readonly<{
  impulses?: Partial<AfterhoursVisualAcceptanceMusicState['impulses']>
}>

interface BrowserScenario {
  readonly id: string
  readonly checkpointId: AfterhoursVisualAcceptanceCheckpointId
  readonly settings?: Partial<AfterhoursSettings>
  readonly music?: MusicOverride
  readonly clockHits?: Partial<Record<'bar' | 'bar4' | 'bar8' | 'phrase', boolean>>
  readonly transport?: Readonly<{
    discontinuity?: boolean
    seeking?: boolean
    looped?: boolean
  }>
  /** Keep the current production graph/world instance and only advance the frame. */
  readonly reuseGraph?: boolean
}

interface BrowserPixelSample {
  readonly width: number
  readonly height: number
  readonly maxRgb: number
  readonly meanRgb: number
  readonly litPixelRatio: number
}

declare global {
  interface Window {
    __DRMVYZ_AFTERHOURS_VISUAL_ACCEPTANCE__?: {
      readonly checkpointIds: readonly AfterhoursVisualAcceptanceCheckpointId[]
      renderCheckpoint(id: AfterhoursVisualAcceptanceCheckpointId): Promise<BrowserReport>
      renderScenario(scenario: BrowserScenario): Promise<BrowserReport>
      sampleCanvasPixels(): Promise<BrowserPixelSample>
      resize(width: number, height: number): void
      getLatest(): BrowserReport | null
    }
  }
}

const canvas = document.querySelector<HTMLCanvasElement>('[data-afterhours-acceptance-canvas]')
const select = document.querySelector<HTMLSelectElement>('[data-afterhours-acceptance-select]')
const status = document.querySelector<HTMLElement>('[data-afterhours-acceptance-status]')
if (!canvas || !select || !status) throw new Error('Afterhours visual acceptance page is incomplete.')

const foundation = createCinemaFoundationPersistedState()
const created = CinemaRuntime.create(canvas)
if (!created.runtime) throw new Error(created.error)
const runtime = created.runtime
runtime.resize({
  valid: true,
  cssWidth: 960,
  cssHeight: 540,
  backingWidth: 960,
  backingHeight: 540,
  effectiveDpr: 1,
  resolutionScale: 1,
  quality: 'high',
  cappedByDpr: false,
  cappedByPixelBudget: false,
  cappedByDimension: false,
})
runtime.start()

let latestMetadata: Readonly<AfterhoursVisualAcceptanceMetadata> | null = null
let latestReport: BrowserReport | null = null
let generation = 0
const clearAcceptanceObserver = setAfterhoursVisualAcceptanceObserver(metadata => { latestMetadata = metadata })

for (const checkpoint of AFTERHOURS_VISUAL_ACCEPTANCE_CHECKPOINTS) {
  const option = document.createElement('option')
  option.value = checkpoint.id
  option.textContent = checkpoint.label
  select.append(option)
}

function waitFor(predicate: () => boolean, timeoutMs = 15_000): Promise<void> {
  const started = performance.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) return resolve()
      if (performance.now() - started >= timeoutMs) return reject(new Error('Timed out waiting for Afterhours acceptance render.'))
      requestAnimationFrame(tick)
    }
    tick()
  })
}

function compositionFor(checkpoint: AfterhoursVisualAcceptanceCheckpoint, identity: string) {
  const config = createCinematicWorldConfig('afterhours', checkpoint.settings, {
    seed: 0x7a71cafe,
    audioMapping: { enabled: false },
  })
  const base = createCinemaCinematicWorldComposition(
    'afterhours',
    CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
    CINEMA_FOUNDATION_INPUT_PORT_ID,
    { compositionId: cinemaStableId<CinemaCompositionId>(`afterhours-acceptance-${identity}`, 'composition') },
  )
  const values = createCinemaCinematicWorldParameterValues(config)
  return {
    ...base,
    nodes: base.nodes.map(node => node.family === 'procedural'
      ? { ...node, parameterValues: values as Record<CinemaParameterId, CinemaParameterValue> }
      : node),
  }
}

function scenarioCheckpoint(scenario: BrowserScenario): AfterhoursVisualAcceptanceCheckpoint {
  const base = getAfterhoursVisualAcceptanceCheckpoint(scenario.checkpointId)
  const musicOverrides = scenario.music ?? {}
  return Object.freeze({
    ...base,
    settings: Object.freeze({ ...base.settings, ...scenario.settings }),
    music: Object.freeze({
      ...base.music,
      ...musicOverrides,
      impulses: Object.freeze({ ...base.music.impulses, ...musicOverrides.impulses }),
    }),
  })
}

function frameFor(
  checkpoint: AfterhoursVisualAcceptanceCheckpoint,
  identity: string,
  clockHits: BrowserScenario['clockHits'] = {},
  transportOptions: BrowserScenario['transport'] = {},
): Readonly<CinemaFrameContext> {
  const m = checkpoint.music
  const eventId = (name: string, active: boolean): CinemaEventId | null => active ? `afterhours-acceptance:${identity}:${name}` as CinemaEventId : null
  const clock = (spanBeats: number, index: number, phase: number, hit = false, id: CinemaEventId | null = null) => ({ available: true, spanBeats, index, phase, hit, eventId: id })
  const bar4Index = Math.floor(m.barIndex / 4)
  const bar8Index = Math.floor(m.barIndex / 8)
  const phraseIndex = Math.floor(m.barIndex / 8)
  const barHit = clockHits.bar ?? m.impulses.downbeat
  const bar4Hit = clockHits.bar4 ?? false
  const bar8Hit = clockHits.bar8 ?? false
  const phraseHit = clockHits.phrase ?? false
  const discontinuity = transportOptions.discontinuity ?? true
  const seeking = transportOptions.seeking ?? discontinuity
  const looped = transportOptions.looped ?? false
  generation += 1
  return {
    version: 1,
    viewport: { width: 960, height: 540, dpr: 1 },
    timing: {
      frameIndex: generation,
      elapsedTimeSec: m.timeSec,
      deltaTimeSec: 1 / 60,
      seeds: { composition: 0x71, track: 0x72, musicalPosition: 0x73, event: 0x74 },
    },
    transport: {
      trackId: 'afterhours-visual-acceptance',
      audioTimeSec: m.timeSec,
      durationSec: 120,
      playing: true,
      paused: false,
      seeking,
      looped,
      visibilitySuspended: false,
      discontinuity,
      discontinuityReasons: discontinuity ? ['seek'] : [],
      reset: {
        required: discontinuity,
        reconstruct: discontinuity,
        generation,
        reasons: discontinuity ? ['seek'] : [],
        actionIds: discontinuity ? ['cinema.reset.seek'] : [],
        identity: `afterhours-acceptance:${identity}`,
      },
    },
    audio: {
      available: true,
      volume: m.energy,
      rms: m.energy,
      energy: m.energy,
      bass: m.bass,
      mid: m.mid,
      high: m.high,
      sub: m.bass,
      centroid: 0.45,
      flux: m.impulses.transient ? 1 : 0.12,
      harmonicity: 0.65,
      complexity: 0.42,
      tension: m.buildProgress,
      buildProgress: m.buildProgress,
      dropImpact: m.dropImpact,
      vocalPresence: m.vocalPresence,
      fft: new Uint8Array(512).fill(Math.round(48 + m.energy * 160)),
      waveform: new Uint8Array(1024).fill(128),
    },
    music: {
      available: true,
      source: 'music-intelligence',
      bpm: m.bpm,
      beatIndex: m.beatIndex,
      beatPhase: m.beatPhase,
      beatInBar: m.beatIndex % 4,
      barIndex: m.barIndex,
      phraseIndex,
      sectionId: m.sectionId,
      sectionType: m.sectionType,
      sectionProgress: m.sectionProgress,
      clocks: {
        beat: m.impulses.beat,
        beat2: false,
        beat4: false,
        bar: barHit,
        bar4: bar4Hit,
        bar8: bar8Hit,
        phrase: phraseHit,
        states: {
          beat: clock(1, m.beatIndex, m.beatPhase, m.impulses.beat, eventId('beat', m.impulses.beat)),
          beat2: clock(2, Math.floor(m.beatIndex / 2), (m.beatIndex % 2 + m.beatPhase) / 2),
          beat4: clock(4, Math.floor(m.beatIndex / 4), (m.beatIndex % 4 + m.beatPhase) / 4),
          bar: clock(4, m.barIndex, m.barPhase, barHit, eventId('bar', barHit)),
          bar4: clock(16, bar4Index, (m.barIndex % 4 + m.barPhase) / 4, bar4Hit, eventId('bar4', bar4Hit)),
          bar8: clock(32, bar8Index, (m.barIndex % 8 + m.barPhase) / 8, bar8Hit, eventId('bar8', bar8Hit)),
          phrase: clock(32, phraseIndex, (m.barIndex % 8 + m.barPhase) / 8, phraseHit, eventId('phrase', phraseHit)),
        },
      },
    },
    impulses: {
      ...m.impulses,
      lyricCue: false,
      lyricWord: false,
      phrase4: false,
      phrase8: false,
      eventIds: {
        beat: eventId('beat', m.impulses.beat),
        downbeat: eventId('downbeat', m.impulses.downbeat),
        kick: eventId('kick', m.impulses.kick),
        snare: eventId('snare', m.impulses.snare),
        transient: eventId('transient', m.impulses.transient),
        sectionStart: eventId('section-start', m.impulses.sectionStart),
        dropStart: eventId('drop-start', m.impulses.dropStart),
        lyricCue: null,
        lyricWord: null,
        phrase4: null,
        phrase8: null,
      },
    },
    lyrics: {
      available: false,
      sourceIdentity: null,
      lineId: null,
      lineText: null,
      wordId: null,
      wordText: null,
      lineProgress: 0,
      wordProgress: 0,
      vocalsActive: false,
    },
    performance: { actionIds: [], toggleStates: {} },
    brand: {
      available: true,
      colors: {
        primary: [0.455, 0.961, 1, 1],
        secondary: [0.15, 0.55, 0.9, 1],
        accent: [1, 1, 1, 1],
        background: [0, 0, 0, 1],
      },
    },
    capabilities: {
      analyser: true,
      musicIntelligence: true,
      beatGrid: true,
      authoritativeSections: true,
      lyrics: false,
      brandKit: true,
      sharedPerformance: true,
      mediaAssets: false,
    },
    activeCameraId: null,
    camera: null,
  }
}

async function renderScenario(scenario: BrowserScenario): Promise<BrowserReport> {
  const checkpoint = scenarioCheckpoint(scenario)
  latestMetadata = null
  latestReport = null
  status.dataset.result = 'rendering'
  status.dataset.checkpoint = scenario.id
  status.textContent = `rendering ${scenario.id}`
  if (!scenario.reuseGraph) runtime.setGraph(compositionFor(checkpoint, scenario.id), null, foundation.definitions)
  const before = runtime.getSnapshot().frameCount
  runtime.setFrame(frameFor(checkpoint, scenario.id, scenario.clockHits, scenario.transport))
  await waitFor(() => runtime.getSnapshot().frameCount > before && runtime.getSnapshot().graph.outputRendered && latestMetadata != null)
  const snapshot = runtime.getSnapshot()
  if (snapshot.graph.failedNodeCount !== 0) throw new Error(`Afterhours scenario ${scenario.id} failed in the production graph.`)
  latestReport = { checkpointId: scenario.id, metadata: latestMetadata!, graph: snapshot.graph }
  select.value = scenario.checkpointId
  status.dataset.result = 'ready'
  status.dataset.checkpoint = scenario.id
  status.textContent = JSON.stringify(latestReport, null, 2)
  return latestReport
}

async function renderCheckpoint(id: AfterhoursVisualAcceptanceCheckpointId): Promise<BrowserReport> {
  return renderScenario({ id, checkpointId: id })
}

async function sampleCanvasPixels(): Promise<BrowserPixelSample> {
  // Sample on the next animation frame so CinemaRuntime has rendered the live
  // production framebuffer immediately before readPixels, even when the WebGL
  // context does not preserve its drawing buffer between composites.
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  const gl = canvas.getContext('webgl2')
  if (!gl) throw new Error('WebGL2 is unavailable for Afterhours pixel sampling.')
  const width = canvas.width
  const height = canvas.height
  const pixels = new Uint8Array(width * height * 4)
  gl.finish()
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
  let maxRgb = 0
  let sumRgb = 0
  let litPixels = 0
  const pixelCount = Math.max(1, width * height)
  for (let index = 0; index < pixels.length; index += 4) {
    const r = pixels[index] ?? 0
    const g = pixels[index + 1] ?? 0
    const b = pixels[index + 2] ?? 0
    const localMax = Math.max(r, g, b)
    maxRgb = Math.max(maxRgb, localMax)
    sumRgb += r + g + b
    if (localMax > 4) litPixels += 1
  }
  return Object.freeze({
    width,
    height,
    maxRgb,
    meanRgb: sumRgb / (pixelCount * 3),
    litPixelRatio: litPixels / pixelCount,
  })
}

window.__DRMVYZ_AFTERHOURS_VISUAL_ACCEPTANCE__ = {
  checkpointIds: AFTERHOURS_VISUAL_ACCEPTANCE_CHECKPOINTS.map(checkpoint => checkpoint.id),
  renderCheckpoint,
  renderScenario,
  sampleCanvasPixels,
  resize(width, height) {
    const safeWidth = Math.max(1, Math.round(width))
    const safeHeight = Math.max(1, Math.round(height))
    runtime.resize({
      valid: true,
      cssWidth: safeWidth,
      cssHeight: safeHeight,
      backingWidth: safeWidth,
      backingHeight: safeHeight,
      effectiveDpr: 1,
      resolutionScale: 1,
      quality: 'high',
      cappedByDpr: false,
      cappedByPixelBudget: false,
      cappedByDimension: false,
    })
  },
  getLatest: () => latestReport,
}

window.addEventListener('beforeunload', () => {
  clearAcceptanceObserver()
  runtime.dispose()
}, { once: true })

select.addEventListener('change', () => {
  renderCheckpoint(select.value as AfterhoursVisualAcceptanceCheckpointId).catch(fail)
})

function fail(error: unknown): void {
  status.dataset.result = 'failed'
  status.textContent = error instanceof Error ? error.stack ?? error.message : String(error)
}

renderCheckpoint(AFTERHOURS_VISUAL_ACCEPTANCE_CHECKPOINTS[0]!.id).catch(fail)
