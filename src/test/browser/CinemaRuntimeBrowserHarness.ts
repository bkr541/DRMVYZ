import {
  CINEMA_FOUNDATION_INPUT_PORT_ID,
  CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
  CINEMA_SHADER_REFERENCE_COMPOSITION,
  createCinemaFoundationPersistedState,
} from '../../components/vyzualz/cinema/CinemaFoundation'
import { createCinemaShaderSceneComposition } from '../../components/vyzualz/cinema/CinemaShaderSceneAdapter'
import { cinemaStableId, type CinemaActionId, type CinemaCompositionId, type CinemaNodeId } from '../../components/vyzualz/cinema/CinemaIdentifiers'
import type { CinemaFrameContext, CinemaTargetDescriptor } from '../../components/vyzualz/cinema/CinemaRendererContracts'
import { CinemaRuntime } from '../../components/vyzualz/cinema/runtime/CinemaRuntime'
import { REACTOR_SCENE_ID } from '../../components/vyzualz/react/shaders/scenes/reactor'

const canvasElement = document.querySelector<HTMLCanvasElement>('[data-cinema-runtime-canvas]')
const statusElement = document.querySelector<HTMLElement>('[data-cinema-runtime-status]')
if (!canvasElement || !statusElement) throw new Error('Cinema runtime browser harness is incomplete.')
const canvas: HTMLCanvasElement = canvasElement
const status: HTMLElement = statusElement

const targetDescriptor: CinemaTargetDescriptor = {
  colorSpace: 'srgb',
  alphaMode: 'premultiplied',
  colorFormat: 'rgba8',
  hasDepth: true,
  hasMask: true,
  widthScale: 1,
  heightScale: 1,
  filter: 'linear',
  wrap: 'clamp',
  clearColor: [0, 0, 0, 0],
}

async function waitFor(predicate: () => boolean, timeoutMs = 15_000): Promise<void> {
  const deadline = performance.now() + timeoutMs
  while (!predicate()) {
    if (performance.now() >= deadline) throw new Error('Timed out waiting for Cinema runtime state.')
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  }
}

async function run(): Promise<void> {
  const phases: string[] = []
  let gl: WebGL2RenderingContext | null = null
  let centerPixel = [0, 0, 0, 0]
  const nativeGetContext = canvas.getContext.bind(canvas)
  let webgl2GetContextCount = 0
  canvas.getContext = ((contextId: string, options?: unknown) => {
    if (contextId === 'webgl2') webgl2GetContextCount += 1
    return nativeGetContext(contextId as 'webgl2', options as WebGLContextAttributes)
  }) as typeof canvas.getContext

  const nativeRequestFrame = window.requestAnimationFrame.bind(window)
  const nativeCancelFrame = window.cancelAnimationFrame.bind(window)
  const pendingRuntimeFrames = new Set<number>()
  let maximumPendingRuntimeFrames = 0
  const requestRuntimeFrame: typeof requestAnimationFrame = callback => {
    let id = 0
    id = nativeRequestFrame(nowMs => {
      pendingRuntimeFrames.delete(id)
      callback(nowMs)
    })
    pendingRuntimeFrames.add(id)
    maximumPendingRuntimeFrames = Math.max(maximumPendingRuntimeFrames, pendingRuntimeFrames.size)
    return id
  }
  const cancelRuntimeFrame: typeof cancelAnimationFrame = id => {
    pendingRuntimeFrames.delete(id)
    nativeCancelFrame(id)
  }

  const created = CinemaRuntime.create(canvas, {
    requestAnimationFrame: requestRuntimeFrame,
    cancelAnimationFrame: cancelRuntimeFrame,
    onSnapshot: snapshot => {
      phases.push(snapshot.phase)
      if (snapshot.graph.outputRendered && gl) centerPixel = readCenterPixel(gl, 480, 270)
    },
  })
  if (!created.runtime) throw new Error(created.error)
  const runtime = created.runtime
  gl = nativeGetContext('webgl2') as WebGL2RenderingContext | null
  if (!gl) throw new Error('Cinema browser harness lost its WebGL2 context reference.')

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
  const foundation = createCinemaFoundationPersistedState()
  runtime.setGraph(CINEMA_SHADER_REFERENCE_COMPOSITION, null, foundation.definitions)
  runtime.setFrame(createFrame(960, 540, 0))
  runtime.start()
  runtime.start()
  await waitFor(() => runtime.getSnapshot().frameCount >= 2 && runtime.getSnapshot().graph.outputRendered)
  const singlePassPixel = [...centerPixel]

  const reactorComposition = createCinemaShaderSceneComposition(
    REACTOR_SCENE_ID,
    CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
    CINEMA_FOUNDATION_INPUT_PORT_ID,
    { compositionId: cinemaStableId<CinemaCompositionId>('reactor-browser-adapter', 'composition') },
  )
  const beforeReactorFrame = runtime.getSnapshot().frameCount
  runtime.setGraph(reactorComposition, null, foundation.definitions)
  runtime.setFrame(createFrame(960, 540, 1))
  await waitFor(() => runtime.getSnapshot().frameCount >= beforeReactorFrame + 2 && runtime.getSnapshot().graph.outputRendered)
  const reactorPixel = [...centerPixel]
  const reactorLeaseCount = runtime.targets.getDiagnostics().activeLeaseCount

  const beforeResetFrame = runtime.getSnapshot().frameCount
  runtime.setFrame(createFrame(960, 540, 2, true))
  await waitFor(() => runtime.getSnapshot().frameCount > beforeResetFrame && runtime.getSnapshot().graph.outputRendered)

  const loseContext = gl.getExtension('WEBGL_lose_context')
  if (!loseContext) throw new Error('WEBGL_lose_context is unavailable; context recovery was not exercised.')
  loseContext.loseContext()
  await waitFor(() => runtime.getSnapshot().phase === 'context-lost')
  loseContext.restoreContext()
  await waitFor(() => runtime.getSnapshot().phase === 'running' && runtime.getSnapshot().contextGeneration === 2)
  const beforeRestoredFrame = runtime.getSnapshot().frameCount
  runtime.setFrame(createFrame(960, 540, 3))
  await waitFor(() => runtime.getSnapshot().frameCount > beforeRestoredFrame && runtime.getSnapshot().graph.outputRendered)
  const postRestorePixel = [...centerPixel]

  const beforeReferenceReturn = runtime.getSnapshot().frameCount
  runtime.setGraph(CINEMA_SHADER_REFERENCE_COMPOSITION, null, foundation.definitions)
  runtime.setFrame(createFrame(960, 540, 4))
  await waitFor(() => runtime.getSnapshot().frameCount > beforeReferenceReturn && runtime.getSnapshot().graph.outputRendered)

  const owner = 'cinema.node.browser-runtime' as CinemaNodeId
  const firstLease = runtime.targets.acquire(owner, targetDescriptor, 'frame')
  const firstView = runtime.targets.getReadTexture(firstLease)
  runtime.targets.clear(firstLease)
  runtime.targets.release(firstLease)
  const secondLease = runtime.targets.acquire(owner, targetDescriptor, 'frame')
  const secondView = runtime.targets.getReadTexture(secondLease)
  const reusedTarget = firstView?.textureViewId === secondView?.textureViewId
  runtime.targets.release(secondLease)

  const poolBeforeDispose = runtime.targets.getDiagnostics()
  const finalSnapshot = runtime.getSnapshot()
  const frameCountBeforeDispose = finalSnapshot.frameCount
  runtime.dispose()
  await new Promise<void>(resolve => nativeRequestFrame(() => resolve()))
  const disposedSnapshot = runtime.getSnapshot()

  status.dataset.result = 'ready'
  status.textContent = JSON.stringify({
    reusedTarget,
    phase: finalSnapshot.phase,
    contextGeneration: finalSnapshot.contextGeneration,
    frameCount: finalSnapshot.frameCount,
    phases,
    poolBeforeDispose,
    graph: finalSnapshot.graph,
    singlePassPixel,
    reactorPixel,
    reactorLeaseCount,
    postRestorePixel,
    webgl2GetContextCount,
    maximumPendingRuntimeFrames,
    pendingRuntimeFrameCountAfterDispose: pendingRuntimeFrames.size,
    disposedPhase: disposedSnapshot.phase,
    frameCountStableAfterDispose: disposedSnapshot.frameCount === frameCountBeforeDispose,
  })
}

run().catch(error => {
  status.dataset.result = 'failed'
  status.textContent = error instanceof Error ? error.stack ?? error.message : String(error)
})

function readCenterPixel(gl: WebGL2RenderingContext, x: number, y: number): number[] {
  const pixel = new Uint8Array(4)
  gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
  return [...pixel]
}

function createFrame(width: number, height: number, generation: number, reset = false): Readonly<CinemaFrameContext> {
  const clock = (spanBeats: number) => ({
    available: true,
    spanBeats,
    index: 0,
    phase: 0.25,
    hit: false,
    eventId: null,
  })
  return {
    version: 1,
    viewport: { width, height, dpr: 1 },
    timing: {
      frameIndex: generation,
      elapsedTimeSec: generation / 60,
      deltaTimeSec: 1 / 60,
      seeds: { composition: 1, track: 2, musicalPosition: 3, event: 4 },
    },
    transport: {
      trackId: 'cinema-stage-9-browser',
      audioTimeSec: generation / 60,
      durationSec: 60,
      playing: true,
      paused: false,
      seeking: reset,
      looped: false,
      visibilitySuspended: false,
      discontinuity: reset,
      discontinuityReasons: reset ? ['seek'] : [],
      reset: {
        required: reset,
        reconstruct: reset,
        generation,
        reasons: reset ? ['seek'] : [],
        actionIds: reset ? ['cinema.reset.seek'] : [],
        identity: reset ? `seek-${generation}` : null,
      },
    },
    audio: {
      available: true,
      volume: 0.6,
      rms: 0.5,
      energy: 0.7,
      bass: 0.8,
      mid: 0.5,
      high: 0.4,
      sub: 0.6,
      centroid: 0.45,
      flux: 0.2,
      harmonicity: 0.7,
      complexity: 0.4,
      tension: 0.3,
      buildProgress: 0.2,
      dropImpact: 0,
      vocalPresence: 0.1,
      fft: new Uint8Array(512).fill(96),
      waveform: new Uint8Array(1024).fill(128),
    },
    music: {
      available: true,
      source: 'bpm-derived',
      bpm: 150,
      beatIndex: 0,
      beatPhase: 0.25,
      beatInBar: 0,
      barIndex: 0,
      phraseIndex: 0,
      sectionId: 'intro',
      sectionType: 'intro',
      sectionProgress: 0.1,
      clocks: {
        beat: false,
        beat2: false,
        beat4: false,
        bar: false,
        bar4: false,
        bar8: false,
        phrase: false,
        states: {
          beat: clock(1),
          beat2: clock(2),
          beat4: clock(4),
          bar: clock(4),
          bar4: clock(16),
          bar8: clock(32),
          phrase: clock(16),
        },
      },
    },
    impulses: {
      beat: false,
      downbeat: false,
      kick: false,
      snare: false,
      transient: false,
      sectionStart: false,
      dropStart: false,
      lyricCue: false,
      lyricWord: false,
      phrase4: false,
      phrase8: false,
      eventIds: {
        beat: null,
        downbeat: null,
        kick: null,
        snare: null,
        transient: null,
        sectionStart: null,
        dropStart: null,
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
    performance: { actionIds: [] as CinemaActionId[], toggleStates: {} },
    brand: {
      available: true,
      colors: {
        primary: [0.05, 0.75, 1, 1],
        secondary: [0.1, 0.95, 0.55, 1],
        accent: [1, 0.2, 0.4, 1],
        background: [0.002, 0.004, 0.01, 1],
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
