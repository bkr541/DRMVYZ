import { CinemaRuntime } from '../../components/vyzualz/cinema/runtime/CinemaRuntime'
import type { CinemaNodeId } from '../../components/vyzualz/cinema/CinemaIdentifiers'
import type { CinemaFrameContext, CinemaTargetDescriptor } from '../../components/vyzualz/cinema/CinemaRendererContracts'
import { createCinemaFoundationPersistedState } from '../../components/vyzualz/cinema/CinemaFoundation'

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
      if (snapshot.graph.outputRendered && gl) {
        const pixel = new Uint8Array(4)
        gl.readPixels(480, 270, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
        centerPixel = [...pixel]
      }
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
  runtime.setGraph(foundation.compositions[0] ?? null, null, foundation.definitions)
  runtime.setFrame(createFrame(960, 540))
  runtime.start()
  runtime.start()
  await waitFor(() => runtime.getSnapshot().frameCount >= 2 && runtime.getSnapshot().graph.outputRendered)

  const owner = 'cinema.node.browser-runtime' as CinemaNodeId
  const firstLease = runtime.targets.acquire(owner, targetDescriptor, 'frame')
  const firstView = runtime.targets.getReadTexture(firstLease)
  runtime.targets.clear(firstLease)
  runtime.targets.release(firstLease)
  const secondLease = runtime.targets.acquire(owner, targetDescriptor, 'frame')
  const secondView = runtime.targets.getReadTexture(secondLease)
  const reusedTarget = firstView?.textureViewId === secondView?.textureViewId

  const loseContext = gl.getExtension('WEBGL_lose_context')
  if (!loseContext) throw new Error('WEBGL_lose_context is unavailable; context recovery was not exercised.')
  loseContext.loseContext()
  await waitFor(() => runtime.getSnapshot().phase === 'context-lost')
  loseContext.restoreContext()
  await waitFor(() => runtime.getSnapshot().phase === 'running' && runtime.getSnapshot().contextGeneration === 2)
  await waitFor(() => runtime.getSnapshot().frameCount >= 3 && runtime.getSnapshot().graph.outputRendered)

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
    centerPixel,
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


function createFrame(width: number, height: number): Readonly<CinemaFrameContext> {
  return {
    viewport: { width, height, dpr: 1 },
    transport: {
      trackId: 'cinema-stage-8-browser', audioTimeSec: 0, durationSec: 60, playing: true, paused: false,
      seeking: false, looped: false, visibilitySuspended: false, discontinuity: false,
      discontinuityReasons: [], reset: { required: false, reconstruct: false, generation: 0, reasons: [], actionIds: [], identity: null },
    },
  } as unknown as Readonly<CinemaFrameContext>
}
